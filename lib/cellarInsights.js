// lib/cellarInsights.js - "Collection at a glance" insights (Epic #6 · R6 · #56)
//
// A calm, glanceable insights layer over the cellar the user already owns:
// composition by type / region / vintage, totals (bottles + ready count), and a
// recent-months consumption trend. All aggregation here is PURE functions over the
// bottle / consumption arrays so they stay trivial to reason about and unit-test.
//
// Data is read-only: bottles come from cellarService.getCellar() (we never touch
// lib/cellar.js internals — only its exported service + readiness helpers) and the
// consumption history comes from a single read-only cellar_consumptions select
// (RLS scopes it to the current user). Nothing here writes.
//
// Total *value* is intentionally OUT OF SCOPE (needs a pricing source) — see R6.
import { cached, CACHE_KEYS } from './cache';
import { supabase } from './supabase';
import { READY_STATUSES, drinkWindowStatus } from './cellar';

// Bucket label for any missing / blank dimension value. Matches lib/cellarBrowse.js
// so the wording ("Unknown") never drifts between the browse pivot and insights.
export const UNKNOWN = 'Unknown';

// How many months of history the consumption trend spans (including the current
// month). Six reads as "the last half-year" without crowding the card.
export const TREND_MONTHS = 6;

// --- small accessors (tolerant of missing fields) -------------------------------------

// A bottle's producer: explicit free-text producer, else the linked winery's name.
// Mirrors lib/cellarBrowse.js producerOf (kept local so this file stays independent).
function producerOf(bottle) {
  return bottle?.producer || bottle?.wineries?.name || null;
}

// Readiness status, tolerant of un-annotated rows (recompute as a fallback).
function statusOf(bottle) {
  if (bottle?.drinkStatus !== undefined && bottle?.drinkStatus !== null) return bottle.drinkStatus;
  return drinkWindowStatus(bottle?.drink_from, bottle?.drink_by);
}

// Normalise a dimension value to a trimmed string, or null when blank.
function clean(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// The number of physical bottles a lot represents (quantity, default 1).
function qtyOf(bottle) {
  const n = Number(bottle?.quantity);
  return Number.isFinite(n) && n > 0 ? n : bottle?.quantity === 0 ? 0 : 1;
}

// --- composition ----------------------------------------------------------------------

// Generic composition breakdown: sum bottle COUNT (quantity) per bucket produced by
// `keyFn`, bucketing null/blank as "Unknown", returning rows sorted by count desc
// (ties broken alphabetically, with "Unknown" always sorted last). Each row carries a
// `pct` of the grand total so a caller can render a bar width without re-deriving it.
//
// Returns: [{ key, label, count, pct }] where pct is 0–100 (rounded for display caller).
export function composeBy(bottles, keyFn) {
  const list = Array.isArray(bottles) ? bottles : [];
  const counts = new Map();
  let total = 0;

  for (const bottle of list) {
    const raw = clean(keyFn(bottle));
    const label = raw ?? UNKNOWN;
    const qty = qtyOf(bottle);
    counts.set(label, (counts.get(label) || 0) + qty);
    total += qty;
  }

  const rows = Array.from(counts.entries()).map(([label, count]) => ({
    key: label,
    label,
    count,
    pct: total > 0 ? (count / total) * 100 : 0,
  }));

  rows.sort((a, b) => {
    // "Unknown" always sinks to the bottom regardless of its count.
    if (a.label === UNKNOWN && b.label !== UNKNOWN) return 1;
    if (b.label === UNKNOWN && a.label !== UNKNOWN) return -1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });

  return rows;
}

// The three composition dimensions R6 calls for.
export const composeByType = (bottles) => composeBy(bottles, (b) => b.wine_type);
export const composeByRegion = (bottles) => composeBy(bottles, (b) => b.region);
export const composeByVintage = (bottles) => composeBy(bottles, (b) => b.vintage);
export const composeByProducer = (bottles) => composeBy(bottles, producerOf);

// --- totals ---------------------------------------------------------------------------

// Headline numbers for the dashboard: lots, total physical bottles, ready-to-drink
// count, and how many distinct producers / regions the collection spans (a gentle
// sense of breadth). Computed from the SAME bottle array the composition uses.
export function summarize(bottles) {
  const list = Array.isArray(bottles) ? bottles : [];
  let totalBottles = 0;
  let readyToDrink = 0;
  const producers = new Set();
  const regions = new Set();

  for (const bottle of list) {
    const qty = qtyOf(bottle);
    totalBottles += qty;
    if (READY_STATUSES.includes(statusOf(bottle))) readyToDrink += qty;
    const p = clean(producerOf(bottle));
    if (p) producers.add(p.toLowerCase());
    const r = clean(bottle.region);
    if (r) regions.add(r.toLowerCase());
  }

  return {
    lots: list.length,
    totalBottles,
    readyToDrink,
    producers: producers.size,
    regions: regions.size,
  };
}

// --- consumption trend ----------------------------------------------------------------

// Format a Date as a "YYYY-MM" month key (local time).
function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Short month label for a "YYYY-MM" key, e.g. "Jun" (current year) / "Jun '25".
function monthLabel(key, now) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return y === now.getFullYear() ? month : `${month} '${String(y).slice(-2)}`;
}

// Parse a consumption's date. Prefer the user-meaningful consumed_date; fall back to
// created_at. Returns a Date or null. consumed_date is a 'YYYY-MM-DD' string — parse
// it as local (not UTC) so a bottle opened late in a month doesn't slip into the next.
function consumptionDate(row) {
  const raw = row?.consumed_date || row?.created_at;
  if (!raw) return null;
  const ymd = String(raw).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(y, m - 1, d);
}

// Bottles consumed per month over the trailing `months` window (oldest → newest),
// always returning a dense series (months with no consumption show 0) so the trend
// reads cleanly and handles "nothing opened yet" gracefully.
//
// Returns: { series: [{ key, label, count }], total, max, hasAny }.
export function consumptionTrend(consumptions, { months = TREND_MONTHS, now = new Date() } = {}) {
  // Seed a dense, ordered map of the last `months` keys (oldest first).
  const buckets = new Map();
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    buckets.set(monthKey(d), 0);
  }

  let total = 0;
  for (const row of Array.isArray(consumptions) ? consumptions : []) {
    const date = consumptionDate(row);
    if (!date) continue;
    const key = monthKey(date);
    if (!buckets.has(key)) continue; // outside the window
    const qty = Number(row?.quantity);
    const add = Number.isFinite(qty) && qty > 0 ? qty : 1;
    buckets.set(key, buckets.get(key) + add);
    total += add;
  }

  const series = Array.from(buckets.entries()).map(([key, count]) => ({
    key,
    label: monthLabel(key, now),
    count,
  }));
  const max = series.reduce((m, s) => Math.max(m, s.count), 0);

  return { series, total, max, hasAny: total > 0 };
}

// --- data loader ----------------------------------------------------------------------

// Read-only fetch of the consumption history for the current user. RLS scopes the
// rows; we only need the few columns the trend uses. Returns [] on any failure so the
// dashboard degrades to "no consumptions yet" rather than erroring.
async function fetchConsumptions() {
  // Cached under the shared 'consumptions' key; openBottle invalidates it.
  return cached(CACHE_KEYS.consumptions, _fetchConsumptions);
}

async function _fetchConsumptions() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return [];

    const { data, error } = await supabase
      .from('cellar_consumptions')
      .select('consumed_date, quantity, reason, created_at')
      .eq('user_id', user.id)
      .order('consumed_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading consumptions for insights:', error);
    return [];
  }
}

// Load everything the insights screen needs in one call and assemble the derived
// view-model. Bottles come from cellarService.getCellar() (in-cellar lots only),
// consumptions from the read-only select above. Pure aggregation does the rest.
//
// Returns: { success, insights } where insights = {
//   summary, byType, byRegion, byVintage, byProducer, trend, isEmpty
// }. On failure returns { success: false, error } with an empty-shaped fallback.
export async function getCellarInsights() {
  // Imported lazily to avoid any import-cycle surprises and to keep this loader the
  // single seam that touches the cellar service.
  const { cellarService } = await import('./cellar');

  try {
    const [cellarRes, consumptions] = await Promise.all([
      cellarService.getCellar(),
      fetchConsumptions(),
    ]);

    if (!cellarRes?.success) {
      throw new Error(cellarRes?.error || 'Could not load your cellar');
    }

    const bottles = cellarRes.bottles || [];
    const insights = buildInsights(bottles, consumptions);
    return { success: true, insights };
  } catch (error) {
    console.error('Error building cellar insights:', error);
    return { success: false, error: error.message, insights: buildInsights([], []) };
  }
}

// Pure assembly of the view-model from already-loaded arrays (exported so it can be
// unit-tested without the network).
export function buildInsights(bottles, consumptions) {
  const list = Array.isArray(bottles) ? bottles : [];
  return {
    summary: summarize(list),
    byType: composeByType(list),
    byRegion: composeByRegion(list),
    byVintage: composeByVintage(list),
    byProducer: composeByProducer(list),
    trend: consumptionTrend(consumptions),
    isEmpty: list.length === 0,
  };
}
