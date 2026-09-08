// Unit tests for lib/cellarMatch.js — the single matching rule behind
// "in your cellar" (#117/#140) and duplicate-tasting awareness (#93/#153).
// Matching is deliberately conservative; the cases pinned here are the ones the
// research doc calls out: the producer gate, the two-cuvées trap, blend
// intersection, and NV-vs-unknown vintages.
import {
  TIER,
  canMatchWine,
  findPriorTastings,
  isSameWine,
  matchWineToCellar,
  sameVintage,
} from '../lib/cellarMatch';

// A tasted wine (logging-session shape) and a cellar bottle (cellar shape)
// describing the same physical wine under different column names.
const tasted = (over = {}) => ({
  winemaker: 'Barboursville',
  wine_name: 'Octagon',
  wine_varietal: ['Merlot', 'Cabernet Franc'],
  wine_year: '2019',
  ...over,
});
const bottle = (over = {}) => ({
  producer: 'Barboursville',
  wine_name: 'Octagon',
  varietal: 'Merlot',
  vintage: '2019',
  ...over,
});

describe('isSameWine', () => {
  it('matches the same wine across tasted-wine and cellar-bottle shapes', () => {
    expect(isSameWine(tasted(), bottle())).toBe(true);
  });

  it('requires a producer on both sides — never matches on name alone', () => {
    expect(isSameWine(tasted({ winemaker: '' }), bottle())).toBe(false);
    expect(isSameWine(tasted(), bottle({ producer: null }))).toBe(false);
    expect(isSameWine(tasted({ winemaker: 'Linden' }), bottle())).toBe(false);
  });

  it('compares producers and names case- and whitespace-insensitively', () => {
    expect(
      isSameWine(
        tasted({ winemaker: '  barboursville ', wine_name: 'OCTAGON' }),
        bottle()
      )
    ).toBe(true);
  });

  it('does not link two different named cuvées that share producer and varietal', () => {
    // The two-cuvées trap: same winery, both Merlot-based, different wines.
    expect(isSameWine(tasted(), bottle({ wine_name: 'Reserve Merlot' }))).toBe(false);
  });

  it('falls back to varietal intersection when one side is nameless', () => {
    // A blend logged once fully and once as just its lead grape still matches.
    expect(isSameWine(tasted({ wine_name: '' }), bottle({ wine_name: null }))).toBe(true);
    expect(
      isSameWine(
        tasted({ wine_name: '', wine_varietal: ['Viognier'] }),
        bottle({ wine_name: null })
      )
    ).toBe(false);
  });

  it('never gates on vintage — a different year is still the same wine', () => {
    expect(isSameWine(tasted({ wine_year: '2021' }), bottle())).toBe(true);
  });
});

describe('sameVintage', () => {
  it('extracts a 4-digit year from noisy values', () => {
    expect(sameVintage(tasted({ wine_year: 'Vintage 2019' }), bottle())).toBe(true);
  });

  it('treats all NV spellings as one real vintage value', () => {
    expect(
      sameVintage(tasted({ wine_year: 'N.V.' }), bottle({ vintage: 'non-vintage' }))
    ).toBe(true);
  });

  it('does not conflate NV with unknown', () => {
    expect(sameVintage(tasted({ wine_year: 'NV' }), bottle({ vintage: '2019' }))).toBe(
      false
    );
  });

  it('answers true when either side is unknown — only a known disagreement differs', () => {
    expect(sameVintage(tasted({ wine_year: null }), bottle())).toBe(true);
    expect(sameVintage(tasted({ wine_year: '2018' }), bottle())).toBe(false);
  });
});

describe('matchWineToCellar', () => {
  it('returns null when the cellar has no match', () => {
    expect(matchWineToCellar(tasted(), [bottle({ producer: 'Linden' })])).toBeNull();
    expect(matchWineToCellar(tasted(), [])).toBeNull();
    expect(matchWineToCellar(tasted(), undefined)).toBeNull();
  });

  it('prefers a same-vintage lot and sums physical bottles across those lots', () => {
    const sameA = bottle({ quantity: 2 });
    const sameB = bottle({ quantity: 1 });
    const other = bottle({ vintage: '2016', quantity: 5 });
    const res = matchWineToCellar(tasted(), [other, sameA, sameB]);
    expect(res.relation).toBe('same');
    expect(res.primary).toBe(sameA);
    expect(res.count).toBe(3); // the 2016 lot is not counted
    expect(res.differentVintage).toBeNull();
  });

  it("reports a different vintage using the bottle's own spelling", () => {
    const res = matchWineToCellar(tasted(), [bottle({ vintage: 'NV' })]);
    expect(res.relation).toBe('different');
    expect(res.differentVintage).toBe('NV'); // display copy, not the normalised 'nv'
  });
});

describe('canMatchWine', () => {
  it('needs a producer plus a name or varietal before a duplicate check may fire', () => {
    expect(canMatchWine({ winemaker: 'Barboursville' })).toBe(false);
    expect(canMatchWine({ wine_name: 'Octagon' })).toBe(false);
    expect(canMatchWine({ winemaker: 'Barboursville', wine_name: 'Octagon' })).toBe(true);
    expect(
      canMatchWine({ winemaker: 'Barboursville', wine_varietal: ['Merlot'] })
    ).toBe(true);
  });
});

describe('findPriorTastings', () => {
  const prior = (over = {}) => ({
    id: 1,
    visitDate: '2025-05-01',
    ...tasted(),
    ...over,
  });

  it('returns null for an unmatchable draft or when nothing matches', () => {
    expect(findPriorTastings({ winemaker: 'Barboursville' }, [prior()])).toBeNull();
    expect(findPriorTastings(tasted(), [prior({ winemaker: 'Linden' })])).toBeNull();
  });

  it('reports CERTAIN when identity matches and both vintages are known and equal', () => {
    const res = findPriorTastings(tasted(), [prior()]);
    expect(res.tier).toBe(TIER.CERTAIN);
    expect(res.count).toBe(1);
    expect(res.otherVintage).toBeNull();
  });

  it('hedges to LIKELY when a vintage is unknown on one side', () => {
    const res = findPriorTastings(tasted({ wine_year: '' }), [prior()]);
    expect(res.tier).toBe(TIER.LIKELY);
  });

  it("reports RELATED with the prior wine's own vintage when years differ", () => {
    const res = findPriorTastings(tasted({ wine_year: '2021' }), [prior()]);
    expect(res.tier).toBe(TIER.RELATED);
    expect(res.otherVintage).toBe('2019');
  });

  it('puts the closest match first: same vintage ahead of different, then most recent', () => {
    const older = prior({ id: 1, visitDate: '2023-01-01' });
    const newer = prior({ id: 2, visitDate: '2025-05-01' });
    const otherYear = prior({ id: 3, visitDate: '2026-01-01', wine_year: '2016' });
    const res = findPriorTastings(tasted(), [otherYear, older, newer]);
    expect(res.matches.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(res.mostRecent.id).toBe(2);
  });

  it('ignores excluded ids, e.g. the row currently being edited', () => {
    expect(
      findPriorTastings(tasted(), [prior({ id: 7 })], { excludeIds: [7] })
    ).toBeNull();
  });
});
