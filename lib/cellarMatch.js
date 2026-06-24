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

import { varietalText } from './varietals';

const norm = (s) =>
  (s == null ? '' : String(s)).toLowerCase().trim().replace(/\s+/g, ' ');

const vintageStr = (v) => (v == null ? '' : String(v).trim());

// Same wine identity? Producer must match, then:
//   - when BOTH sides name the wine → the NAMES must match. Varietal alone is
//     too loose: a producer often makes several wines of the same varietal or
//     blend (e.g. two "Bordeaux Blend"s, or a red + a rosé both "Merlot"), so
//     matching on varietal would wrongly link distinct cuvées.
//   - otherwise (at least one side is nameless, e.g. a varietal-only "Prosecco")
//     → fall back to varietal equality.
export function isSameWine(wine, bottle) {
  if (!wine || !bottle) return false;
  const prodA = norm(wine.winemaker);
  const prodB = norm(bottle.producer || bottle.wineries?.name);
  if (!prodA || !prodB || prodA !== prodB) return false;

  const nameA = norm(wine.wine_name);
  const nameB = norm(bottle.wine_name);
  if (nameA && nameB) return nameA === nameB;

  const varA = norm(varietalText(wine.wine_varietal));
  const varB = norm(bottle.varietal);
  return Boolean(varA && varB && varA === varB);
}

// Same vintage? Treat a missing vintage on EITHER side as "not different" — we
// only claim "a different vintage" when both are known and disagree.
export function sameVintage(wine, bottle) {
  const wy = vintageStr(wine?.wine_year);
  const bv = vintageStr(bottle?.vintage);
  if (!wy || !bv) return true;
  return wy === bv;
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
    differentVintage: vintageStr(primary.vintage) || null,
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
