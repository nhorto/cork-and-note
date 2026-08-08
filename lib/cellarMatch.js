// lib/cellarMatch.js
// Decide whether a tasted wine (from a logging session) is also a bottle the
// user owns in their cellar, so the Wine Detail screen can surface "in your
// cellar — tap to view" (#117). Pure functions over already-loaded arrays so
// they're trivial to test and add no network cost (the cellar read is cached,
// see #83).
//
// Matching is deliberately CONSERVATIVE to avoid false "you own this":
//   - producer/winemaker must match (normalized, both non-empty), AND
//   - the wine name OR the varietal must match.
// Vintage then decides the relationship:
//   - same (or unknown on either side) → "In your cellar"
//   - both known but different          → "a different vintage (YYYY)"
//
// Note: a tasting logged FROM a cellar bottle (the openBottle flow, #92) copies
// the bottle's producer/name/vintage onto the wine, so this fuzzy match already
// catches that case without needing the cellar_consumptions link.

import { parseVarietals } from './varietals';

const norm = (s) =>
  (s == null ? '' : String(s)).toLowerCase().trim().replace(/\s+/g, ' ');

// Sentinel for non-vintage wines. "NV" is a REAL, known vintage value — two NV
// Champagnes are a genuine vintage match — so it must not be conflated with
// "unknown", which is exactly where nameless varietal-only entries cluster.
export const NON_VINTAGE = 'nv';

// Normalised vintage from either shape. Pulls a 4-digit year out of noisier
// values ("Vintage 2019") so they compare equal to a plain "2019".
function vintageOf(x) {
  const raw = x?.wine_year ?? x?.vintage;
  const s = (raw == null ? '' : String(raw)).trim();
  if (!s) return '';
  if (/^n\.?\s*v\.?$/i.test(s) || /^non[-\s]?vintage$/i.test(s)) return NON_VINTAGE;
  const m = s.match(/\b(\d{4})\b/);
  return m ? m[1] : s.toLowerCase();
}

// ── Shared wine identity ────────────────────────────────────────────────────
// A tasted wine and a cellar bottle describe the same concept under different
// column names (winemaker/producer, wine_varietal[]/varietal, wine_year/vintage).
// Projecting both onto ONE shape means wine↔bottle (#117/#140) and wine↔wine
// (#93, duplicate-tasting awareness) all run through a single matching rule, so
// the app can never claim "you own this" and "you've tasted this" under
// different logic for the same two wines.
export function wineIdentity(x) {
  if (!x) return null;
  return {
    producer: norm(x.winemaker ?? x.producer ?? x.wineries?.name),
    name: norm(x.wine_name),
    // A Set either way: a wine's varietal is text[] (#135), a bottle's is a
    // single text. parseVarietals handles both (and legacy comma strings).
    varietals: new Set(parseVarietals(x.wine_varietal ?? x.varietal).map(norm).filter(Boolean)),
    vintage: vintageOf(x),
  };
}

// Non-empty intersection. Deliberately looser than set-equality: varietal entry
// is inconsistent for blends — the same wine gets logged once as ["Cabernet
// Sauvignon"] and later, after a label scan, as ["Cabernet Sauvignon", "Merlot",
// "Cabernet Franc"]. Equality misses that; intersection catches it. The producer
// gate above keeps the false-positive cost low.
function intersects(a, b) {
  if (!a.size || !b.size) return false;
  for (const v of a) if (b.has(v)) return true;
  return false;
}

// Same wine identity? Producer must match, then:
//   - when BOTH sides name the wine → the NAMES must match. Varietal alone is
//     too loose: a producer often makes several wines of the same varietal or
//     blend (e.g. two "Bordeaux Blend"s, or a red + a rosé both "Merlot"), so
//     matching on varietal would wrongly link distinct cuvées.
//   - otherwise (at least one side is nameless, e.g. a varietal-only "Prosecco")
//     → fall back to a shared varietal.
// Symmetric, and accepts a wine or a bottle on either side.
export function isSameWine(a, b) {
  const ia = wineIdentity(a);
  const ib = wineIdentity(b);
  if (!ia || !ib) return false;
  if (!ia.producer || !ib.producer || ia.producer !== ib.producer) return false;

  if (ia.name && ib.name) return ia.name === ib.name;
  return intersects(ia.varietals, ib.varietals);
}

// Same vintage? Treat a missing vintage on EITHER side as "not different" — we
// only claim "a different vintage" when both are known and disagree.
export function sameVintage(a, b) {
  const va = vintageOf(a);
  const vb = vintageOf(b);
  if (!va || !vb) return true;
  return va === vb;
}

// Do BOTH sides state a vintage? Callers that need to distinguish "same year"
// from "we simply don't know" (the confidence tiers in #93) need this, because
// sameVintage deliberately answers true for unknowns.
export function vintagesKnown(a, b) {
  return Boolean(vintageOf(a) && vintageOf(b));
}

const qtyOf = (b) => {
  const n = Number(b?.quantity);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/**
 * Match a tasted wine against the in-cellar bottle list.
 * @returns null when nothing matches, otherwise:
 *   {
 *     primary,            // the bottle to deep-link to (prefers same-vintage)
 *     count,              // physical bottles across the relevant matching lots
 *     relation,           // 'same' | 'different' (vintage vs the displayed wine)
 *     differentVintage,   // the bottle's vintage string when relation==='different'
 *   }
 */
export function matchWineToCellar(wine, bottles) {
  const list = Array.isArray(bottles) ? bottles : [];
  const matches = list.filter((b) => isSameWine(wine, b));
  if (matches.length === 0) return null;

  const sameV = matches.filter((b) => sameVintage(wine, b));

  if (sameV.length > 0) {
    return {
      primary: sameV[0],
      count: sameV.reduce((sum, b) => sum + qtyOf(b), 0),
      relation: 'same',
      differentVintage: null,
    };
  }

  // All matches are a different (known) vintage.
  const primary = matches[0];
  return {
    primary,
    count: matches.reduce((sum, b) => sum + qtyOf(b), 0),
    relation: 'different',
    // The user's own spelling, not the normalised form — this is display copy
    // ("A different vintage (2019)"), so an NV bottle should read "NV", not "nv".
    differentVintage: String(primary.vintage ?? '').trim() || null,
  };
}

// ── Bottle → tastings (the reverse direction, #140) ─────────────────────────
// The functions above answer "is this tasted wine in my cellar?". These answer
// the reverse — "which of my tastings is this cellar bottle?" — for the bottle
// detail screen's "From a tasting" card (auto-suggest + manual link).

// Flatten loaded visits (visitsService.getUserVisits) into a flat list of tasted
// wines, each carrying the matching fields plus light display context (the visit
// date and the place/winery name) the link UI shows. Tolerant of missing nests.
export function flattenTastedWines(visits) {
  const list = Array.isArray(visits) ? visits : [];
  const out = [];
  for (const v of list) {
    for (const w of v.wines || []) {
      out.push({
        ...w,
        visit_id: w.visit_id ?? v.id ?? null,
        visitDate: v.visit_date ?? null,
        placeName: v.place_name ?? v.wineries?.name ?? null,
      });
    }
  }
  return out;
}

// Same-wine tasted candidates for a cellar bottle, best first: same- (or
// unknown-) vintage ahead of different-vintage, then most-recently tasted. Reuses
// the conservative isSameWine, so a candidate already shares producer + name (or
// varietal). Returns [] when nothing matches.
export function matchTastingsToBottle(bottle, tastedWines) {
  const list = Array.isArray(tastedWines) ? tastedWines : [];
  const matches = list.filter((w) => isSameWine(w, bottle));
  return matches.sort((a, b) => {
    const av = sameVintage(a, bottle) ? 0 : 1;
    const bv = sameVintage(b, bottle) ? 0 : 1;
    if (av !== bv) return av - bv;
    return String(b.visitDate || '').localeCompare(String(a.visitDate || ''));
  });
}

// ── Tasting → prior tastings (#93, duplicate-tasting awareness) ─────────────
// "Have I logged this wine before?" — asked while the user is still typing the
// wine into the logging form. Runs over the already-cached visits list, so it
// costs no network.
//
// Vintage NEVER gates the match; it only picks which of three messages to show,
// because "you've tasted the 2019, this is the 2021" is a useful thing to say,
// not a miss.

export const TIER = {
  CERTAIN: 'certain', // identity matches, both vintages known and equal
  LIKELY: 'likely', // identity matches, vintage unknown on one side → hedge
  RELATED: 'related', // identity matches, both vintages known and different
};

// Is there enough typed yet to even ask? Producer is required, plus something
// that distinguishes the wine. Without this the banner would fire on producer
// alone and claim every wine from a winery you've visited is a duplicate.
export function canMatchWine(x) {
  const id = wineIdentity(x);
  return Boolean(id && id.producer && (id.name || id.varietals.size));
}

/**
 * Prior tastings of the wine currently being entered.
 * @param draft  the in-progress wine ({ winemaker, wine_name, wine_varietal, wine_year })
 * @param tastedWines  flattened prior tastings (see flattenTastedWines)
 * @param options.excludeIds  wine ids to ignore — the row being edited, and any
 *   drafts already on the current session (those are reported separately, since
 *   a duplicate *within one visit* is a stronger signal).
 * @returns null when nothing matches, otherwise
 *   { tier, matches[] (best first), mostRecent, count, otherVintage }
 */
export function findPriorTastings(draft, tastedWines, options = {}) {
  if (!canMatchWine(draft)) return null;

  const exclude = new Set((options.excludeIds || []).filter((v) => v != null).map(String));
  const list = Array.isArray(tastedWines) ? tastedWines : [];

  const matches = list
    .filter((w) => !(w?.id != null && exclude.has(String(w.id))))
    .filter((w) => isSameWine(draft, w));
  if (matches.length === 0) return null;

  // Same- (or unknown-) vintage first, then most recently tasted — so the
  // headline describes the closest match rather than an arbitrary one.
  const sorted = matches.sort((a, b) => {
    const av = sameVintage(draft, a) ? 0 : 1;
    const bv = sameVintage(draft, b) ? 0 : 1;
    if (av !== bv) return av - bv;
    return String(b.visitDate || '').localeCompare(String(a.visitDate || ''));
  });

  const mostRecent = sorted[0];
  const tier = !sameVintage(draft, mostRecent)
    ? TIER.RELATED
    : vintagesKnown(draft, mostRecent)
      ? TIER.CERTAIN
      : TIER.LIKELY;

  return {
    tier,
    matches: sorted,
    mostRecent,
    count: sorted.length,
    // The prior wine's own spelling, for "You've tasted the 2019".
    otherVintage:
      tier === TIER.RELATED ? String(mostRecent.wine_year ?? '').trim() || null : null,
  };
}
