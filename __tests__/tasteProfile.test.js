// lib/tasteProfile.js: the numbers behind "My taste" are computed in code, so
// they are tested in code. Zero sentinels, distinct counting, tier thresholds,
// aggregate math, revision hashing, evidence bounding and report validation.
import { aiService } from '../lib/ai';
import { supabase } from '../lib/supabase';
import {
  buildAggregates,
  buildTasteSystemPrompt,
  buildTasteRequest,
  buildTasteUserMessage,
  collectRatedWines,
  distinctRatedCount,
  distinctWineKey,
  MIN_DISTINCT_FOR_REPORT,
  pickEvidenceSample,
  reportTier,
  MAX_TASTE_MESSAGE_CHARS,
  sourceRevision,
  tasteReportService,
  validateReport,
} from '../lib/tasteProfile';

jest.mock('../lib/ai', () => ({
  aiService: {
    sendMessage: jest.fn(),
    parseFencedJson: jest.requireActual('../lib/ai').aiService.parseFencedJson,
  },
}));
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn(), functions: {} },
}));
jest.mock('../lib/visits', () => ({ visitsService: {} }));
jest.mock('../lib/cellar', () => ({ cellarService: {}, describeBottleForPrompt: () => '' }));
jest.mock('../lib/aiConsent', () => ({
  aiConsentError: () => new Error('consent'),
  getAiConsent: jest.fn(),
  requireAiConsent: jest.fn(),
}));

const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);

const wine = (id, over = {}) => ({
  id,
  wine_name: `Wine ${id}`,
  winemaker: 'Maker',
  wine_year: 2021,
  wine_type: 'Red',
  wine_varietal: ['Cabernet Franc'],
  overall_rating: 4,
  sweetness: 0,
  tannin: 3,
  acidity: 0,
  body: 4,
  alcohol: 0,
  additional_notes: null,
  wine_flavor_notes: [{ flavor_notes: { name: 'Pepper', category: 'Spice' } }],
  ...over,
});

const visit = (id, date, wines, over = {}) => ({
  id,
  visit_date: date,
  wineries: { name: `Winery ${id}` },
  place_name: null,
  wines,
  ...over,
});

// Six distinct wines over three sessions, one unrated, one repeat.
const FIXTURE = [
  visit('v1', '2026-09-01', [
    wine('a', { overall_rating: 5, wine_varietal: ['Cabernet Franc'] }),
    wine('b', { overall_rating: 4.5, wine_type: 'White', wine_varietal: 'Viognier', sweetness: 1 }),
    wine('c', { overall_rating: 0, wine_varietal: ['Merlot'] }), // unrated sentinel
  ]),
  visit('v2', '2026-06-15', [
    wine('d', { overall_rating: 3, wine_varietal: ['Merlot'], wine_flavor_notes: [] }),
    wine('e', { overall_rating: 4, wine_varietal: ['Cabernet Franc', 'Merlot'] }),
  ]),
  visit('v3', '2025-12-01', [
    wine('f', { overall_rating: 2, wine_type: null, wine_varietal: null, tannin: 0, body: 0 }),
    // Same wine as 'a', rated again: must not count as a new distinct wine.
    wine('g', { wine_name: 'Wine a', overall_rating: 4.5 }),
  ], { wineries: null, place_name: 'Home' }),
];

describe('collectRatedWines', () => {
  const rated = collectRatedWines(FIXTURE);

  it('drops unrated wines and treats slider zeros as unrated', () => {
    expect(rated.map((w) => w.id)).toEqual(['a', 'b', 'd', 'e', 'f', 'g']);
    const a = rated.find((w) => w.id === 'a');
    expect(a.sliders).toEqual({ sweetness: null, tannin: 3, acidity: null, body: 4, alcohol: null });
    expect(a.varietals).toEqual(['Cabernet Franc']);
    expect(a.flavors).toEqual([{ name: 'Pepper', category: 'Spice' }]);
    expect(a.visitId).toBe('v1');
    expect(a.place).toBe('Winery v1');
  });

  it('accepts a legacy string varietal and a place name without a winery', () => {
    expect(rated.find((w) => w.id === 'b').varietals).toEqual(['Viognier']);
    expect(rated.find((w) => w.id === 'f').place).toBe('Home');
    expect(rated.find((w) => w.id === 'f').varietals).toEqual([]);
  });

  it('tolerates missing input', () => {
    expect(collectRatedWines(null)).toEqual([]);
    expect(collectRatedWines([{ id: 'x' }])).toEqual([]);
  });
});

describe('distinct counting', () => {
  it('normalizes producer, name and year', () => {
    expect(distinctWineKey({ producer: ' Maker ', name: 'WINE  A', year: 2021 })).toBe(
      distinctWineKey({ winemaker: 'maker', wine_name: 'wine a', wine_year: '2021' })
    );
  });

  it('does not let a repeat rating inflate breadth', () => {
    const rated = collectRatedWines(FIXTURE);
    expect(rated).toHaveLength(6);
    expect(buildAggregates(rated, { now: NOW }).counts).toEqual({
      rated: 6,
      distinctWines: 5,
      sessions: 3,
      places: 3,
    });
    // Raw rows straight from the Journal tab, same answer.
    expect(distinctRatedCount(FIXTURE.flatMap((v) => v.wines))).toBe(5);
  });
});

describe('reportTier', () => {
  it.each([
    [0, 0, 'progress'],
    [4, 4, 'progress'],
    [5, 1, 'first_impressions'],
    [9, 3, 'first_impressions'],
    [10, 2, 'first_impressions'],
    [10, 3, 'full'],
    [25, 10, 'full'],
  ])('%i distinct over %i sessions is %s', (distinctWines, sessions, tier) => {
    expect(reportTier({ distinctWines, sessions })).toBe(tier);
  });
});

describe('buildAggregates', () => {
  const agg = buildAggregates(collectRatedWines(FIXTURE), { now: NOW });

  it('splits by type with averages over rated wines only', () => {
    expect(agg.byType.map((t) => [t.type, t.count, t.avgRating])).toEqual([
      ['Red', 4, 4.1],
      ['White', 1, 4.5],
      ['Not set', 1, 2],
    ]);
    expect(agg.byType[0].pct).toBeCloseTo(66.7, 0);
  });

  it('counts a blend under each grape and flags what stands out', () => {
    const cf = agg.byVarietal.find((v) => v.varietal === 'Cabernet Franc');
    const merlot = agg.byVarietal.find((v) => v.varietal === 'Merlot');
    expect(cf).toEqual({ varietal: 'Cabernet Franc', count: 3, avgRating: 4.5, standsOut: true });
    expect(merlot).toEqual({ varietal: 'Merlot', count: 2, avgRating: 3.5, standsOut: false });
    expect(agg.byVarietal[0].varietal).toBe('Cabernet Franc');
  });

  it('only counts flavors on wines rated 4 or more', () => {
    // a, b, e, g carry Pepper and are rated >= 4; d has no notes; f is a 2.
    expect(agg.topFlavors).toEqual([{ name: 'Pepper', category: 'Spice', count: 4 }]);
  });

  it('averages sliders over filled-in values, ignoring zero sentinels', () => {
    expect(agg.sliders.sweetness).toEqual({ avg: 1, n: 1 });
    expect(agg.sliders.tannin).toEqual({ avg: 3, n: 5 });
    expect(agg.sliders.acidity).toEqual({ avg: null, n: 0 });
  });

  it('ranks top rated by rating then recency and reports the period', () => {
    expect(agg.topRated.slice(0, 3).map((w) => w.id)).toEqual(['a', 'b', 'g']);
    // Sept 1 and June 15 sessions fall inside 90 days of Sept 11; Dec does not.
    expect(agg.recent90Days).toBe(4);
    expect(agg.analyzedFrom).toBe('2025-12-01');
    expect(agg.analyzedTo).toBe('2026-09-01');
  });

  it('handles an empty journal without dividing by zero', () => {
    const empty = buildAggregates([], { now: NOW });
    expect(empty.counts.distinctWines).toBe(0);
    expect(empty.byType).toEqual([]);
    expect(empty.analyzedFrom).toBeNull();
  });
});

describe('sourceRevision', () => {
  const rated = collectRatedWines(FIXTURE);

  it('is stable across ordering', () => {
    expect(sourceRevision(rated)).toBe(sourceRevision([...rated].reverse()));
  });

  it('changes when a rating is edited, added or removed', () => {
    const base = sourceRevision(rated);
    const edited = rated.map((w) => (w.id === 'd' ? { ...w, rating: 4 } : w));
    expect(sourceRevision(edited)).not.toBe(base);
    expect(sourceRevision(rated.slice(1))).not.toBe(base);
    expect(sourceRevision([...rated, { id: 'z', rating: 3 }])).not.toBe(base);
  });
});

describe('pickEvidenceSample', () => {
  const big = [];
  for (let i = 0; i < 120; i++) {
    big.push({
      id: `w${i}`,
      rating: 1 + (i % 5),
      varietals: [`Grape ${i % 15}`],
      visitDate: `2026-0${1 + (i % 9)}-01`,
    });
  }

  it('is bounded, deduped and varied', () => {
    const sample = pickEvidenceSample(big, 40);
    expect(sample).toHaveLength(40);
    expect(new Set(sample.map((w) => w.id)).size).toBe(40);
    // Every grape is represented, not just the top-rated ones.
    expect(new Set(sample.map((w) => w.varietals[0])).size).toBe(15);
    // Something recent made it in, not only 5-star rows.
    expect(sample.some((w) => w.rating < 5)).toBe(true);
  });

  it('returns everything when the journal is small', () => {
    expect(pickEvidenceSample(big.slice(0, 7), 40)).toHaveLength(7);
  });
});

describe('prompt', () => {
  it('describes the numbers and lists evidence ids without the tasting place', () => {
    const rated = collectRatedWines(FIXTURE);
    const msg = buildTasteUserMessage({
      aggregates: buildAggregates(rated, { now: NOW }),
      evidence: pickEvidenceSample(rated),
    });
    expect(msg).toContain('5 distinct wines over 3 sessions');
    expect(msg).toContain('Cabernet Franc *: 3, avg 4.5');
    expect(msg).toContain('id a |');
    expect(msg).not.toContain('Winery v1');
    expect(msg).not.toContain('Home');
    expect(buildTasteSystemPrompt()).toContain('```taste_report');
  });

  it('keeps verbose journals below the chat endpoint message limit', () => {
    const verbose = [];
    for (let i = 0; i < 80; i++) {
      verbose.push({
        id: `verbose-${i}`,
        name: `Wine ${i} ${'N'.repeat(180)}`,
        producer: `Producer ${'P'.repeat(180)}`,
        year: 2020,
        type: `Red ${'T'.repeat(80)}`,
        varietals: Array.from({ length: 8 }, (_, j) => `Grape ${j} ${'V'.repeat(80)}`),
        rating: 1 + (i % 5),
        sliders: { sweetness: 2, tannin: 3, acidity: 4, body: 3, alcohol: 2 },
        flavors: Array.from({ length: 12 }, (_, j) => ({ name: `Flavor ${j} ${'F'.repeat(80)}` })),
        notes: `Line one\n${'A very detailed note. '.repeat(20)}`,
        visitId: `visit-${i % 4}`,
        visitDate: `2026-0${1 + (i % 9)}-01`,
        place: null,
      });
    }

    const request = buildTasteRequest({
      rated: verbose,
      aggregates: buildAggregates(verbose, { now: NOW }),
    });

    expect(request.message.length).toBeLessThanOrEqual(MAX_TASTE_MESSAGE_CHARS);
    expect(request.message).toContain('Rated tastings: 80');
    expect(request.evidence.length).toBeGreaterThanOrEqual(MIN_DISTINCT_FOR_REPORT);
    expect(request.evidence.length).toBeLessThan(40);
    request.evidence.forEach((w) => expect(request.message).toContain(`id ${w.id} |`));
  });
});

describe('validateReport', () => {
  const good = {
    headline: 'You like grip.',
    observations: [
      { title: 'One', body: 'Body one.', evidence_wine_ids: ['a', 'zzz', 'a'] },
      { title: 'Two', body: 'Body two.', evidence_wine_ids: [] },
      { title: 'Three', body: 'Body three.', evidence_wine_ids: ['b'] },
      { title: 'Four', body: 'Too many.', evidence_wine_ids: ['b'] },
    ],
    try_next: [{ title: 'Mencía', body: 'Why.' }, { title: 'Riesling', body: 'Why.' }, { title: 'Extra', body: 'No.' }],
    caveat: 'Thin data.',
  };

  it('drops unknown and duplicate evidence ids and caps the lists', () => {
    const out = validateReport(good, ['a', 'b']);
    expect(out.observations).toHaveLength(3);
    expect(out.observations[0].evidence_wine_ids).toEqual(['a']);
    expect(out.try_next).toHaveLength(2);
    expect(out.caveat).toBe('Thin data.');
  });

  it('rejects an unusable reply', () => {
    expect(validateReport(null, ['a'])).toBeNull();
    expect(validateReport({ headline: '' , observations: [] }, ['a'])).toBeNull();
    expect(validateReport({ headline: 'x', observations: [{ title: 'no body' }] }, ['a'])).toBeNull();
  });
});

describe('tasteReportService.generate', () => {
  const rated = collectRatedWines(FIXTURE);

  const chain = (result) => {
    const c = {};
    ['insert', 'select', 'single', 'delete', 'eq', 'order', 'limit', 'maybeSingle'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return c;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // The service logs refusals; the refusal itself is the thing under test.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });
  afterEach(() => console.error.mockRestore());

  it('sends the taste_report task, validates, and saves the row', async () => {
    aiService.sendMessage.mockResolvedValue({
      response:
        '```taste_report\n' +
        JSON.stringify({
          headline: 'H',
          observations: [{ title: 'T', body: 'B', evidence_wine_ids: ['a', 'nope'] }],
          try_next: [{ title: 'X', body: 'Y' }],
          caveat: 'C',
        }) +
        '\n```',
    });
    const inserted = chain({ data: { id: 'r1', report: { headline: 'H' } }, error: null });
    supabase.from.mockReturnValue(inserted);

    const res = await tasteReportService.generate({ rated, now: NOW });
    expect(res.success).toBe(true);
    expect(aiService.sendMessage).toHaveBeenCalledWith(
      [expect.objectContaining({ role: 'user' })],
      expect.stringContaining('taste_report'),
      { task: 'taste_report' }
    );
    const row = inserted.insert.mock.calls[0][0];
    expect(row.user_id).toBe('u1');
    expect(row.tier).toBe('first_impressions');
    expect(row.wine_count).toBe(5);
    expect(row.source_revision).toBe(sourceRevision(rated));
    expect(row.report.observations[0].evidence_wine_ids).toEqual(['a']);
    expect(row.evidence_ids).toContain('a');
  });

  it('passes the server refusal code through so the screen can open the paywall', async () => {
    const err = new Error('Your taste report is part of Pro.');
    err.code = 'free_limit_reached';
    aiService.sendMessage.mockRejectedValue(err);
    const res = await tasteReportService.generate({ rated, now: NOW });
    expect(res).toEqual({ success: false, error: err.message, code: 'free_limit_reached' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('refuses a truncated reply rather than saving half a report', async () => {
    aiService.sendMessage.mockResolvedValue({ response: '```taste_report\n{"headline": "cut' });
    const res = await tasteReportService.generate({ rated, now: NOW });
    expect(res.success).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('does not call the model below the threshold', async () => {
    const res = await tasteReportService.generate({ rated: rated.slice(0, 2), now: NOW });
    expect(res.code).toBe('not_enough_data');
    expect(aiService.sendMessage).not.toHaveBeenCalled();
  });
});
