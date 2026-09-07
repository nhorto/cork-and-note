// lib/winesBrowse.js - Pure client-side filter/sort logic for tasted wines
// (#170 Layer C). Mirrors lib/cellarBrowse.js: the wines list is already
// fetched whole, so everything runs in-memory as small pure functions. The
// facet builder dedupes case-insensitively (the #88/#151 lesson) and shows the
// spelling the user uses most.
import { parseVarietals } from './varietals';

// The empty filter set. An empty array / null on any facet means "don't filter on it".
export const EMPTY_FILTERS = {
  types: [], // wine_type values
  wineries: [], // wineryName values
  varietals: [], // individual grape values (a wine matches if ANY grape matches)
  minRating: null,
};

// Sort options surfaced on the screen (NOT inside the filter sheet).
export const SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'rating_desc', label: 'Top rated' },
  { key: 'rating_asc', label: 'Lowest rated' },
];

export function hasActiveFilters(filters = EMPTY_FILTERS) {
  return (
    (filters.types?.length || 0) > 0 ||
    (filters.wineries?.length || 0) > 0 ||
    (filters.varietals?.length || 0) > 0 ||
    filters.minRating != null
  );
}

export function activeFilterCount(filters = EMPTY_FILTERS) {
  return (
    (filters.types?.length || 0) +
    (filters.wineries?.length || 0) +
    (filters.varietals?.length || 0) +
    (filters.minRating != null ? 1 : 0)
  );
}

const eqInsensitive = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function matchesFilters(wine, filters) {
  if (filters.types?.length && !filters.types.some((t) => eqInsensitive(t, wine.wine_type || ''))) {
    return false;
  }
  if (
    filters.wineries?.length &&
    !filters.wineries.some((w) => eqInsensitive(w, wine.wineryName || ''))
  ) {
    return false;
  }
  if (filters.varietals?.length) {
    const grapes = parseVarietals(wine.wine_varietal);
    if (!filters.varietals.some((v) => grapes.some((g) => eqInsensitive(v, g)))) {
      return false;
    }
  }
  if (filters.minRating != null) {
    const rating = Number(wine.overall_rating);
    if (!Number.isFinite(rating) || rating < filters.minRating) return false;
  }
  return true;
}

export function applyFilters(wines, filters = EMPTY_FILTERS) {
  if (!hasActiveFilters(filters)) return wines;
  return wines.filter((w) => matchesFilters(w, filters));
}

// Distinct facet values present in the (search-narrowed) set, with counts, so
// the sheet only offers choices that exist. Case-insensitive dedupe keyed by
// lower-case; the displayed label is the most-used spelling (ties keep the
// first seen, so labels stay stable as the set re-narrows).
export function facetOptions(wines) {
  const collect = (valuesOf) => {
    const set = new Map(); // lower-case key -> { count, spellings: Map<label, count> }
    for (const wine of wines) {
      for (const raw of valuesOf(wine)) {
        if (!raw) continue;
        const label = String(raw).trim();
        if (!label) continue;
        const key = label.toLowerCase();
        let entry = set.get(key);
        if (!entry) {
          entry = { count: 0, spellings: new Map() };
          set.set(key, entry);
        }
        entry.count += 1;
        entry.spellings.set(label, (entry.spellings.get(label) || 0) + 1);
      }
    }
    return [...set.values()]
      .map(({ count, spellings }) => ({
        value: [...spellings.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0],
        count,
      }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };
  return {
    types: collect((w) => [w.wine_type]),
    wineries: collect((w) => [w.wineryName]),
    // A wine can have several grapes (#135) — each grape is its own facet.
    varietals: collect((w) => parseVarietals(w.wine_varietal)),
  };
}

export function applySort(wines, sort = 'recent') {
  const list = [...wines];
  if (sort === 'rating_desc') {
    return list.sort((a, b) => (b.overall_rating || 0) - (a.overall_rating || 0));
  }
  if (sort === 'rating_asc') {
    return list.sort((a, b) => (a.overall_rating || 0) - (b.overall_rating || 0));
  }
  // 'recent': newest tasting first (falls back to the incoming order on ties,
  // since sort() is stable).
  return list.sort(
    (a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0)
  );
}
