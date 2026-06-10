// lib/cellarBrowse.js - Pure client-side browse logic for the cellar (Epic #6, #52)
//
// The cellar list is already fetched whole by lib/cellar.js (the enthusiast persona =
// dozens of bottles, not thousands), so search / filter / sort / group all run in-memory
// here. Every export is a small pure function over the bottle array so they stay easy to
// reason about and unit-test. Readiness logic is borrowed read-only from lib/cellar.js —
// this file never touches Supabase or that module's internals.
import { READY_STATUSES, drinkWindowMeta, drinkWindowStatus } from './cellar';

export const UNKNOWN = 'Unknown';

// Segments for the "Ready now / Hold / All" control.
export const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready now' },
  { key: 'hold', label: 'Hold' },
];

// Sort options surfaced in the toolbar.
export const SORTS = [
  { key: 'readiness', label: 'Readiness' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'price', label: 'Price' },
  { key: 'rating', label: 'Rating' },
  { key: 'quantity', label: 'Quantity' },
];

// Group-by options for the "Summarize by" pivot.
export const GROUPS = [
  { key: 'none', label: 'None' },
  { key: 'region', label: 'Region' },
  { key: 'type', label: 'Type' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'producer', label: 'Producer' },
  { key: 'drink_by', label: 'Drink-by year' },
];

// Readiness ordering for the "Readiness" sort and for stable group ordering:
// soonest-to-act first (past peak / drink up), then ready, young, then unknown
// last. Derived from the canonical DRINK_WINDOW_META `order` so the ranking and
// the badge taxonomy can never drift apart (drinkWindowMeta(null) → order 4).
const readinessRank = (status) => drinkWindowMeta(status).order;

// --- small accessors (tolerant of missing fields) -------------------------------------

export function producerOf(bottle) {
  return bottle?.producer || bottle?.wineries?.name || null;
}

// drinkStatus is normally annotated onto the bottle by lib/cellar.js; recompute as a
// fallback so these functions also work on un-annotated rows (and in tests).
export function statusOf(bottle) {
  if (bottle?.drinkStatus !== undefined && bottle?.drinkStatus !== null) return bottle.drinkStatus;
  return drinkWindowStatus(bottle?.drink_from, bottle?.drink_by);
}

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// --- search ----------------------------------------------------------------------------

// Free-text search over wine name / producer / region / vintage. Empty query = no-op.
export function applySearch(bottles, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return bottles;
  return bottles.filter((b) => {
    const haystack = [
      b.wine_name,
      producerOf(b),
      b.region,
      b.vintage,
      b.varietal,
      b.wine_type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

// --- segments --------------------------------------------------------------------------

export function applySegment(bottles, segment) {
  if (segment === 'ready') return bottles.filter((b) => READY_STATUSES.includes(statusOf(b)));
  if (segment === 'hold') return bottles.filter((b) => !READY_STATUSES.includes(statusOf(b)));
  return bottles;
}

// --- filters ---------------------------------------------------------------------------

// The empty filter set. A null/empty value on any facet means "don't filter on it".
export const EMPTY_FILTERS = {
  types: [], // wine_type values (lower-cased compare)
  regions: [], // region values
  varietals: [], // varietal values
  statuses: [], // drink-window statuses: too_young | ready | drink_up | past_peak | unknown
  minPrice: null,
  maxPrice: null,
  minRating: null,
};

export function hasActiveFilters(filters = EMPTY_FILTERS) {
  return (
    (filters.types?.length || 0) > 0 ||
    (filters.regions?.length || 0) > 0 ||
    (filters.varietals?.length || 0) > 0 ||
    (filters.statuses?.length || 0) > 0 ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.minRating != null
  );
}

const eqInsensitive = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function matchesFilters(bottle, filters) {
  if (filters.types?.length && !filters.types.some((t) => eqInsensitive(t, bottle.wine_type || ''))) {
    return false;
  }
  if (filters.regions?.length && !filters.regions.some((r) => eqInsensitive(r, bottle.region || ''))) {
    return false;
  }
  if (
    filters.varietals?.length &&
    !filters.varietals.some((v) => eqInsensitive(v, bottle.varietal || ''))
  ) {
    return false;
  }
  if (filters.statuses?.length) {
    const status = statusOf(bottle) || UNKNOWN;
    if (!filters.statuses.includes(status)) return false;
  }
  const price = toNumber(bottle.purchase_price);
  if (filters.minPrice != null && (price == null || price < filters.minPrice)) return false;
  if (filters.maxPrice != null && (price == null || price > filters.maxPrice)) return false;
  const rating = toNumber(bottle.rating);
  if (filters.minRating != null && (rating == null || rating < filters.minRating)) return false;
  return true;
}

export function applyFilters(bottles, filters = EMPTY_FILTERS) {
  if (!hasActiveFilters(filters)) return bottles;
  return bottles.filter((b) => matchesFilters(b, filters));
}

// Distinct, sorted facet values present in the (segment+search-narrowed) set, so the
// modal only offers choices that exist and can show live counts against them.
export function facetOptions(bottles) {
  const collect = (fn) => {
    const set = new Map(); // value -> count, keyed by lower-case to dedupe
    for (const b of bottles) {
      const raw = fn(b);
      if (!raw) continue;
      const key = String(raw).trim();
      if (!key) continue;
      set.set(key, (set.get(key) || 0) + 1);
    }
    return [...set.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };
  return {
    types: collect((b) => b.wine_type),
    regions: collect((b) => b.region),
    varietals: collect((b) => b.varietal),
  };
}

// --- sort ------------------------------------------------------------------------------

// Stable, total ordering. Bottles missing the sort key are pushed to the end (so an
// un-priced / un-rated / un-vintaged bottle never crashes or jumps to the top).
export function sortBottles(bottles, sortKey) {
  const arr = [...bottles];

  const comparators = {
    readiness: (a, b) => readinessRank(statusOf(a)) - readinessRank(statusOf(b)),
    vintage: (a, b) => byNumberDesc(toNumber(a.vintage), toNumber(b.vintage)),
    price: (a, b) => byNumberDesc(toNumber(a.purchase_price), toNumber(b.purchase_price)),
    rating: (a, b) => byNumberDesc(toNumber(a.rating), toNumber(b.rating)),
    quantity: (a, b) => byNumberDesc(toNumber(a.quantity), toNumber(b.quantity)),
  };

  const cmp = comparators[sortKey] || comparators.readiness;
  // Decorate-sort-undecorate to keep it stable across engines.
  return arr
    .map((b, i) => [b, i])
    .sort((x, y) => {
      const primary = cmp(x[0], y[0]);
      if (primary !== 0) return primary;
      return x[1] - y[1];
    })
    .map(([b]) => b);
}

// Higher value first; nulls always sort last regardless of direction.
function byNumberDesc(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

// --- group -----------------------------------------------------------------------------

function groupKeyFor(bottle, groupBy) {
  switch (groupBy) {
    case 'region':
      return bottle.region?.trim() || UNKNOWN;
    case 'type':
      return bottle.wine_type?.trim() || UNKNOWN;
    case 'vintage':
      return bottle.vintage?.toString().trim() || UNKNOWN;
    case 'producer':
      return producerOf(bottle)?.trim() || UNKNOWN;
    case 'drink_by':
      return bottle.drink_by != null && bottle.drink_by !== ''
        ? String(bottle.drink_by)
        : UNKNOWN;
    default:
      return UNKNOWN;
  }
}

// Group the (already filtered + sorted) list into SectionList-ready sections.
// Each section: { key, title, data, count (lots), bottleCount (sum of quantity) }.
// Ordering: alphabetical/numeric by group title, with the "Unknown" bucket pinned last.
// When groupBy is falsy/'none', returns a single untitled section preserving sort order.
export function groupBottles(bottles, groupBy) {
  if (!groupBy || groupBy === 'none') {
    return [
      {
        key: 'all',
        title: null,
        data: bottles,
        count: bottles.length,
        bottleCount: sumQuantity(bottles),
      },
    ];
  }

  const buckets = new Map();
  for (const b of bottles) {
    const key = groupKeyFor(b, groupBy);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(b);
  }

  const numeric = groupBy === 'vintage' || groupBy === 'drink_by';
  const sections = [...buckets.entries()].map(([title, data]) => ({
    key: title,
    title,
    data,
    count: data.length,
    bottleCount: sumQuantity(data),
  }));

  sections.sort((a, b) => {
    // Pin Unknown last.
    if (a.title === UNKNOWN) return 1;
    if (b.title === UNKNOWN) return -1;
    if (numeric) return Number(b.title) - Number(a.title); // newest vintage / soonest drink-by first
    return a.title.localeCompare(b.title);
  });

  return sections;
}

export function sumQuantity(bottles) {
  return bottles.reduce((sum, b) => sum + (toNumber(b.quantity) || 0), 0);
}

// --- the full pipeline -----------------------------------------------------------------

// Convenience composition used by the screen: search -> segment -> filters -> sort -> group.
// Returns { sections, filtered, facets, counts } so the UI can show result counts without
// re-deriving the intermediate sets.
export function browseCellar(bottles, { query, segment, filters, sort, groupBy } = {}) {
  const searched = applySearch(bottles, query);
  const segmented = applySegment(searched, segment);
  const facets = facetOptions(segmented); // facet options reflect search + segment
  const filtered = applyFilters(segmented, filters);
  const sorted = sortBottles(filtered, sort);
  const sections = groupBottles(sorted, groupBy);

  return {
    sections,
    filtered: sorted,
    facets,
    counts: {
      total: bottles.length,
      afterSearch: searched.length,
      afterSegment: segmented.length,
      result: filtered.length,
      resultBottles: sumQuantity(filtered),
    },
  };
}
