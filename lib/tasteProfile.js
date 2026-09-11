// lib/tasteProfile.js: the "My taste" Pro tool (research doc 2026-09-11, §5).
//
// Everything numeric happens here, in code, from the user's own rated tastings.
// The model only turns the finished numbers plus a bounded evidence sample into
// three plain-language observations and two directions to explore. It never
// counts, never scores, and can only cite tasting ids we handed it.
//
// Data model reminders (lib/visits.js):
//   - a tasting is a row in `wines` nested under a `visits` row
//   - unrated sliders AND an unrated overall_rating are stored as 0, not null,
//     so 0 is treated as "unrated" everywhere below
//   - there is no wine-origin column; where a wine was tasted says nothing
//     about where it was made, so place is never shown to the model
import { aiService } from './ai';
import { parseVarietals } from './varietals';
import { supabase } from './supabase';
import { softenDashes } from './text';

export const PROMPT_VERSION = 'taste_report_v1';
export const MIN_DISTINCT_FOR_REPORT = 5;
export const FULL_REPORT_DISTINCT = 10;
export const FULL_REPORT_SESSIONS = 3;

const SLIDER_KEYS = ['sweetness', 'tannin', 'acidity', 'body', 'alcohol'];

// ── Helpers ────────────────────────────────────────────────────────────────

const norm = (v) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// A rating of 0 is the "not rated" sentinel; anything non-numeric is too.
function ratedValue(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const round1 = (n) => Math.round(n * 10) / 10;

function avg(nums) {
  if (!nums.length) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function dateMs(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
}

const byRatingThenRecency = (a, b) =>
  b.rating - a.rating || dateMs(b.visitDate) - dateMs(a.visitDate) || String(a.id).localeCompare(String(b.id));
const byRecency = (a, b) =>
  dateMs(b.visitDate) - dateMs(a.visitDate) || String(a.id).localeCompare(String(b.id));

// ── Collection ─────────────────────────────────────────────────────────────

/**
 * Flatten visits (visitsService.getUserVisits shape) into the rated tastings
 * the report is built from. Wines with no overall rating are left out: an
 * unrated tasting says the user was there, not what they thought.
 */
export function collectRatedWines(visits) {
  const out = [];
  for (const visit of Array.isArray(visits) ? visits : []) {
    const place = visit?.wineries?.name || visit?.place_name || null;
    for (const w of visit?.wines || []) {
      const rating = ratedValue(w?.overall_rating);
      if (rating === null) continue;
      const sliders = {};
      for (const k of SLIDER_KEYS) sliders[k] = ratedValue(w[k]);
      const flavors = (w.wine_flavor_notes || [])
        .map((fn) => fn?.flavor_notes)
        .filter((f) => f && f.name)
        .map((f) => ({ name: f.name, category: f.category || null }));
      out.push({
        id: w.id,
        name: w.wine_name || null,
        producer: w.winemaker || null,
        year: w.wine_year || null,
        type: w.wine_type || null,
        varietals: parseVarietals(w.wine_varietal),
        rating,
        sliders,
        flavors,
        notes: w.additional_notes ? String(w.additional_notes).trim() : null,
        visitId: visit.id,
        visitDate: visit.visit_date || null,
        place,
      });
    }
  }
  return out;
}

/**
 * Same wine rated twice is still one wine. Accepts both the normalized shape
 * above and raw `wines` rows so the Journal tab can count without reshaping.
 */
export function distinctWineKey(w) {
  const producer = norm(w.producer ?? w.winemaker);
  const name = norm(w.name ?? w.wine_name);
  const year = norm(w.year ?? w.wine_year);
  return `${producer}|${name}|${year}`;
}

/** Distinct rated wines among raw or normalized rows, for cheap gating. */
export function distinctRatedCount(rows) {
  const keys = new Set();
  for (const w of Array.isArray(rows) ? rows : []) {
    if (ratedValue(w?.rating ?? w?.overall_rating) === null) continue;
    keys.add(distinctWineKey(w));
  }
  return keys.size;
}

export function countRated(rated) {
  const wines = new Set();
  const sessions = new Set();
  const places = new Set();
  for (const w of rated) {
    wines.add(distinctWineKey(w));
    if (w.visitId != null) sessions.add(String(w.visitId));
    if (w.place) places.add(norm(w.place));
  }
  return { rated: rated.length, distinctWines: wines.size, sessions: sessions.size, places: places.size };
}

/** UX thresholds from the brief. These are not confidence levels. */
export function reportTier({ distinctWines = 0, sessions = 0 } = {}) {
  if (distinctWines >= FULL_REPORT_DISTINCT && sessions >= FULL_REPORT_SESSIONS) return 'full';
  if (distinctWines >= MIN_DISTINCT_FOR_REPORT) return 'first_impressions';
  return 'progress';
}

// ── Aggregates ─────────────────────────────────────────────────────────────

function groupRatings(rated, keysOf) {
  const map = new Map();
  for (const w of rated) {
    for (const key of keysOf(w)) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(w.rating);
    }
  }
  return [...map.entries()]
    .map(([key, ratings]) => ({ key, count: ratings.length, avgRating: avg(ratings) }))
    .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating || a.key.localeCompare(b.key));
}

/**
 * Every number the screen and the model see. Pure: pass `now` for stable tests.
 */
export function buildAggregates(rated, { now = Date.now() } = {}) {
  const list = Array.isArray(rated) ? rated : [];
  const counts = countRated(list);

  const byType = groupRatings(list, (w) => [w.type || 'Not set']).map((g) => ({
    type: g.key,
    count: g.count,
    avgRating: g.avgRating,
    pct: list.length ? (g.count / list.length) * 100 : 0,
  }));

  const byVarietal = groupRatings(list, (w) => w.varietals).map((g) => ({
    varietal: g.key,
    count: g.count,
    avgRating: g.avgRating,
    standsOut: g.count >= 2 && g.avgRating >= 4,
  }));

  const flavorCounts = new Map();
  for (const w of list) {
    if (w.rating < 4) continue;
    const seen = new Set();
    for (const f of w.flavors) {
      const k = norm(f.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const cur = flavorCounts.get(k) || { name: f.name, category: f.category, count: 0 };
      cur.count += 1;
      flavorCounts.set(k, cur);
    }
  }
  const topFlavors = [...flavorCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6);

  const sliders = {};
  for (const k of SLIDER_KEYS) {
    const vals = list.map((w) => w.sliders?.[k]).filter((v) => v !== null && v !== undefined);
    sliders[k] = { avg: avg(vals), n: vals.length };
  }

  const topRated = [...list]
    .sort(byRatingThenRecency)
    .slice(0, 8)
    .map(({ id, name, producer, year, type, rating, visitDate }) => ({ id, name, producer, year, type, rating, visitDate }));

  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  const recent90Days = list.filter((w) => dateMs(w.visitDate) >= cutoff).length;

  const dates = list.map((w) => w.visitDate).filter(Boolean).sort();
  return {
    counts,
    byType,
    byVarietal,
    topFlavors,
    sliders,
    topRated,
    recent90Days,
    analyzedFrom: dates[0] || null,
    analyzedTo: dates[dates.length - 1] || null,
  };
}

// ── Revision ───────────────────────────────────────────────────────────────

/** djb2 over sorted `id:rating` pairs. Any add / edit / delete changes it. */
export function sourceRevision(rated) {
  const pairs = (Array.isArray(rated) ? rated : [])
    .map((w) => `${w.id}:${w.rating}`)
    .sort();
  let h = 5381;
  const s = pairs.join('|');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `v1-${pairs.length}-${h.toString(16)}`;
}

// ── Evidence ───────────────────────────────────────────────────────────────

/**
 * A bounded, varied sample: the best, the newest, and the best of each grape,
 * so a long-running journal is not represented by its last twenty rows only.
 */
export function pickEvidenceSample(rated, max = 40) {
  const list = Array.isArray(rated) ? rated : [];
  if (list.length <= max) return [...list].sort(byRatingThenRecency);

  const picked = [];
  const seen = new Set();
  const add = (w) => {
    if (picked.length >= max || seen.has(w.id)) return;
    seen.add(w.id);
    picked.push(w);
  };

  const share = Math.ceil(max / 3);
  const best = [...list].sort(byRatingThenRecency);
  const newest = [...list].sort(byRecency);
  best.slice(0, share).forEach(add);
  newest.slice(0, share).forEach(add);

  const bestPerVarietal = new Map();
  for (const w of best) {
    for (const v of w.varietals) {
      const k = norm(v);
      if (!bestPerVarietal.has(k)) bestPerVarietal.set(k, w);
    }
  }
  bestPerVarietal.forEach(add);
  best.forEach(add);

  return picked.sort(byRatingThenRecency);
}

// ── Prompt ─────────────────────────────────────────────────────────────────

export function buildTasteSystemPrompt() {
  return `You are Cork & Note's sommelier, writing a short personal taste report from a user's own tasting journal.

You will receive computed statistics and a list of evidence tastings, each with an id. Your job is to say, in plain and warm language, what keeps standing out in their ratings and suggest two directions worth exploring next.

Rules, all of them strict:
- Make only claims the supplied evidence supports. If the data is thin, say something modest rather than something impressive.
- Every id in evidence_wine_ids must come from the evidence list. Never invent an id.
- Do not draw a conclusion about the person from a single bottle. A pattern needs at least two tastings behind it.
- Do not talk about regions, countries or terroir. The evidence contains no wine origin; where a wine was tasted is not where it was made.
- Never give a taste-match score, percentage or ranking of the person.
- Plain language, no jargon without a gloss, no flattery. Second person ("you"). No em dashes; use commas or full stops.
- Keep each body under 60 words.

Respond with ONLY one fenced block in exactly this shape (valid JSON, no comments, no trailing commas, nothing before or after the fence):

\`\`\`taste_report
{
  "headline": "one sentence that sums up the pattern",
  "observations": [
    { "title": "short title", "body": "what the ratings show and why it is worth noticing", "evidence_wine_ids": ["id", "id"] },
    { "title": "short title", "body": "...", "evidence_wine_ids": ["id"] },
    { "title": "short title", "body": "...", "evidence_wine_ids": ["id", "id"] }
  ],
  "try_next": [
    { "title": "a style or grape to explore", "body": "why it follows from the pattern above" },
    { "title": "a second direction", "body": "..." }
  ],
  "caveat": "one honest sentence about what this report cannot see yet"
}
\`\`\`

Exactly three observations and exactly two try_next entries.`;
}

function sliderText(sliders) {
  const parts = SLIDER_KEYS.map((k) => {
    const v = sliders?.[k];
    return v !== null && v !== undefined ? `${k} ${v}` : null;
  }).filter(Boolean);
  return parts.length ? parts.join(', ') : 'no structure ratings';
}

function evidenceLine(w) {
  const bits = [
    `id ${w.id}`,
    [w.name, w.year].filter(Boolean).join(' ') || 'Unnamed wine',
    w.producer ? `by ${w.producer}` : null,
    [w.type, w.varietals.join(' / ')].filter(Boolean).join(', ') || null,
    `rated ${w.rating}/5`,
    sliderText(w.sliders),
    w.flavors.length ? `flavors: ${w.flavors.map((f) => f.name).join(', ')}` : null,
    w.notes ? `note: "${w.notes.slice(0, 140)}"` : null,
    w.visitDate ? `tasted ${String(w.visitDate).slice(0, 10)}` : null,
  ].filter(Boolean);
  return `- ${bits.join(' | ')}`;
}

export function buildTasteUserMessage({ aggregates, evidence }) {
  const a = aggregates;
  const lines = [];
  lines.push(
    `Rated tastings: ${a.counts.rated} (${a.counts.distinctWines} distinct wines over ${a.counts.sessions} sessions).`
  );
  if (a.analyzedFrom || a.analyzedTo) {
    lines.push(`Period analyzed: ${String(a.analyzedFrom).slice(0, 10)} to ${String(a.analyzedTo).slice(0, 10)}. Rated in the last 90 days: ${a.recent90Days}.`);
  }
  lines.push('');
  lines.push('By type (count, average rating):');
  a.byType.forEach((t) => lines.push(`- ${t.type}: ${t.count}, avg ${t.avgRating}`));
  lines.push('');
  lines.push('By grape (count, average rating; a grape marked * has 2+ tastings averaging 4 or more):');
  a.byVarietal.slice(0, 12).forEach((v) => lines.push(`- ${v.varietal}${v.standsOut ? ' *' : ''}: ${v.count}, avg ${v.avgRating}`));
  lines.push('');
  const s = a.sliders;
  lines.push(
    'Structure sliders the user rated (1 to 5, averaged over rated tastings only): ' +
      SLIDER_KEYS.map((k) => (s[k].n ? `${k} ${s[k].avg} (n=${s[k].n})` : `${k} not rated`)).join(', ')
  );
  if (a.topFlavors.length) {
    lines.push(`Flavor notes tagged on wines rated 4 or higher: ${a.topFlavors.map((f) => `${f.name} (${f.count})`).join(', ')}`);
  } else {
    lines.push('No flavor notes tagged on highly rated wines.');
  }
  lines.push('');
  lines.push(`Evidence tastings (${evidence.length}). Cite ids from this list only:`);
  evidence.forEach((w) => lines.push(evidenceLine(w)));
  lines.push('');
  lines.push('Write the taste_report block now.');
  return lines.join('\n');
}

// ── Validation ─────────────────────────────────────────────────────────────

const cleanText = (v, max) =>
  typeof v === 'string' && v.trim() ? softenDashes(v.trim()).slice(0, max) : null;

/**
 * Keep only what we can stand behind: known evidence ids, real strings, the
 * agreed counts. Null means the reply is unusable and must not be saved.
 */
export function validateReport(report, evidenceIds) {
  if (!report || typeof report !== 'object') return null;
  const known = new Set((evidenceIds || []).map(String));

  const headline = cleanText(report.headline, 200);
  if (!headline) return null;

  const observations = (Array.isArray(report.observations) ? report.observations : [])
    .map((o) => {
      const title = cleanText(o?.title, 80);
      const body = cleanText(o?.body, 600);
      if (!title || !body) return null;
      const ids = (Array.isArray(o.evidence_wine_ids) ? o.evidence_wine_ids : [])
        .map(String)
        .filter((id) => known.has(id));
      return { title, body, evidence_wine_ids: [...new Set(ids)] };
    })
    .filter(Boolean)
    .slice(0, 3);
  if (observations.length === 0) return null;

  const tryNext = (Array.isArray(report.try_next) ? report.try_next : [])
    .map((t) => {
      const title = cleanText(t?.title, 80);
      const body = cleanText(t?.body, 600);
      return title && body ? { title, body } : null;
    })
    .filter(Boolean)
    .slice(0, 2);

  return {
    headline,
    observations,
    try_next: tryNext,
    caveat: cleanText(report.caveat, 300) || '',
  };
}

// ── Sample for the free preview ────────────────────────────────────────────

/** Fictional. Shown to free users under a SAMPLE badge; never their data. */
export const SAMPLE_TASTE_REPORT = {
  headline: 'You lean toward reds with grip and a savory edge, and you notice acidity.',
  observations: [
    {
      title: 'Structure over sweetness',
      body: 'Your highest ratings go to wines you marked as firm in tannin and low in sweetness. Softer, fruit-forward bottles sit a full star lower on average.',
    },
    {
      title: 'Cabernet Franc keeps winning',
      body: 'Three separate Cabernet Franc tastings across two visits all landed at four stars or higher, with pepper and herb notes tagged each time.',
    },
    {
      title: 'Whites: crisp, not creamy',
      body: 'The whites you liked were the ones with high acidity. The one oaked Chardonnay you rated came in at two and a half.',
    },
  ],
  try_next: [
    { title: 'Mencía', body: 'Herbal, peppery and fresh, a close cousin of what you already rate highly.' },
    { title: 'Dry Riesling', body: 'Same acidity you enjoy in whites, with more range than most Sauvignon Blanc.' },
  ],
  caveat: 'Based on 12 rated wines. Rosé and sparkling have not been rated enough to say much yet.',
};

// ── Persistence and generation ─────────────────────────────────────────────

const TABLE = 'taste_reports';

export const tasteReportService = {
  /** Most recent saved report for the signed-in user, or null. */
  async loadLatest() {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { success: true, report: data || null };
    } catch (err) {
      console.error('loadLatest taste report error:', err);
      return { success: false, error: err.message || 'Could not load your report', report: null };
    }
  },

  /**
   * One Sonnet call, parsed and validated, then saved. Returns
   * { success, report } or { success:false, error, code } where `code` is the
   * server's refusal code (isPaywallError reads it) when there is one.
   */
  async generate({ rated, now = Date.now() }) {
    try {
      const list = Array.isArray(rated) ? rated : [];
      const aggregates = buildAggregates(list, { now });
      const tier = reportTier(aggregates.counts);
      if (tier === 'progress') {
        return { success: false, error: 'Rate a few more wines first', code: 'not_enough_data' };
      }
      const evidence = pickEvidenceSample(list);
      const evidenceIds = evidence.map((w) => String(w.id));

      const aiResponse = await aiService.sendMessage(
        [{ role: 'user', content: buildTasteUserMessage({ aggregates, evidence }) }],
        buildTasteSystemPrompt(),
        { task: 'taste_report' }
      );
      const text = aiResponse?.response || '';
      const { value, truncated } = aiService.parseFencedJson(text, 'taste_report');
      if (truncated) return { success: false, error: 'The report was cut short. Please try again.' };
      const report = validateReport(value, evidenceIds);
      if (!report) return { success: false, error: 'Could not read a report from the sommelier. Please try again.' };

      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Please sign in again.' };

      const row = {
        user_id: user.id,
        source_revision: sourceRevision(list),
        tier,
        wine_count: aggregates.counts.distinctWines,
        session_count: aggregates.counts.sessions,
        aggregates,
        report,
        evidence_ids: evidenceIds,
        model: aiResponse?.model || 'chat:taste_report',
        prompt_version: PROMPT_VERSION,
      };
      const { data, error } = await supabase.from(TABLE).insert(row).select().single();
      if (error) throw error;
      return { success: true, report: data };
    } catch (err) {
      console.error('generate taste report error:', err);
      return { success: false, error: err.message || 'Report failed', code: err.code };
    }
  },

  async remove(id) {
    try {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('remove taste report error:', err);
      return { success: false, error: err.message || 'Could not remove the report' };
    }
  },
};
