// lib/achievements/facts.js — turn a user's journal and cellar into the handful
// of numbers the badge catalog asks about (#295).
//
// Pure and synchronous, over data the app has already loaded and cached. That
// is the whole architecture: there is no server-side pipeline, no queue and no
// rule versioning, because every fact below is cheap to recompute from scratch
// on the device (the same approach lib/tasteProfile.js takes). Nothing here
// touches a service, so it is trivial to test with plain objects.
//
// The one rule worth stating out loud: a "winery visit" needs place_type
// 'winery' (#294). A bottle opened at home carries the producer's winery_id so
// the tasting stays linked, but you were on your couch, so it must not earn a
// Winery Explorer tier or a state.
import { regionsAtPoint } from '../avaRegions';
import { wineIdentity } from '../cellarMatch';
import { matchVarietal, parseVarietals, inferTypeFromVarietals } from '../varietals';
import { findRegion, regionCountry } from '../wineRegions';
import { GRAPE_MERGE, HYBRID_SET, LAUNCH_GRAPES } from './catalog';

const isWineryVisit = (v) => Boolean(v?.winery_id) && v?.place_type === 'winery';

// A wine and a cellar bottle are "the same wine" under the same rule the cellar
// match uses, so a badge count never disagrees with "in your cellar". Vintage
// is deliberately left out: the 2019 and the 2021 of one wine are one wine to
// discover. Falls back to the row id so an empty row is never merged into
// another empty row.
function wineKey(row) {
  const id = wineIdentity(row);
  if (!id) return `id:${row?.id ?? Math.random()}`;
  if (id.producer && id.name) return `${id.producer}|${id.name}`;
  const grapes = [...id.varietals].sort().join(',');
  if (id.producer && grapes) return `${id.producer}|${grapes}`;
  if (id.name) return `|${id.name}`;
  return `id:${row?.id ?? ''}`;
}

// Canonical grape name for one raw varietal string, or null when it should not
// count. Blends are not grapes: "Red Blend" tells us a style, not what was
// planted, and counting it would hand out Grape Explorer for drinking one wine.
function canonicalGrape(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const canonical = matchVarietal(text) || text;
  if (/blend/i.test(canonical)) return null;
  return GRAPE_MERGE.get(canonical.toLowerCase()) || canonical;
}

// The five style buckets the Styles shelf cares about. Wine type is free text
// (the form suggests, the user can type), so normalize generously and ignore
// anything we cannot place rather than guessing.
const TYPE_BUCKETS = {
  red: 'Red', 'red blend': 'Red',
  white: 'White', 'white blend': 'White',
  'rosé': 'Rosé', rose: 'Rosé', 'rosé blend': 'Rosé', 'rose blend': 'Rosé',
  sparkling: 'Sparkling', 'sparkling wine': 'Sparkling', champagne: 'Sparkling',
  dessert: 'Dessert', 'dessert wine': 'Dessert', port: 'Dessert',
};

function styleBucket(wine) {
  const raw = String(wine?.wine_type ?? '').trim().toLowerCase();
  if (raw && TYPE_BUCKETS[raw]) return TYPE_BUCKETS[raw];
  if (raw) return null;
  const inferred = inferTypeFromVarietals(wine?.wine_varietal);
  return inferred ? TYPE_BUCKETS[inferred.toLowerCase()] || null : null;
}

// Photos arrive parsed (visitsService.parsePhotoUrls) but tolerate the raw
// JSON string shape too, so a caller that skipped the service still works.
function hasPhoto(wine) {
  if (Array.isArray(wine?.photos)) return wine.photos.length > 0;
  try {
    const parsed = JSON.parse(wine?.photo_url ?? '[]');
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return Boolean(wine?.photo_url);
  }
}

// A two-letter state out of a US address, as a last resort when we have neither
// a directory row nor an AVA hit: "... Delaplane, VA 20144".
function stateFromAddress(address) {
  const m = String(address ?? '').match(/\b([A-Z]{2})\s+\d{5}/);
  return m ? m[1] : null;
}

const dayMs = 24 * 60 * 60 * 1000;

function daysBetween(from, to) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / dayMs);
}

const maxOf = (values) => values.reduce((m, v) => (v > m ? v : m), 0);

/**
 * Every number the catalog tests against.
 *
 * @param visits        visitsService.getUserVisits() shape
 * @param bottles       cellarService.getCellarHistory() bottles (all statuses)
 * @param consumptions  flattened cellar_consumptions, each with a `bottle`
 *                      reference of { purchase_date, drink_from, drink_by }
 */
export function buildFacts({ visits = [], bottles = [], consumptions = [] } = {}) {
  const visitList = Array.isArray(visits) ? visits : [];
  const bottleList = Array.isArray(bottles) ? bottles : [];
  const pours = Array.isArray(consumptions) ? consumptions : [];

  let tastings = 0;
  let ratedTastings = 0;
  let tastingsWithNotes = 0;
  let tastingsWithPhotos = 0;

  const wineKeys = new Set();
  const varietalCounts = new Map();
  const typeCounts = {};
  const flavorNotes = new Set();
  const months = new Set();

  const visitsPerWinery = new Map();   // winery_id -> visits
  const wineriesPerDay = new Map();    // visit_date -> Set(winery_id)
  const wineryById = new Map();        // winery_id -> the nested wineries row

  for (const visit of visitList) {
    const wines = Array.isArray(visit?.wines) ? visit.wines : [];
    tastings += wines.length;

    if (wines.length > 0 && typeof visit?.visit_date === 'string') {
      const month = visit.visit_date.slice(5, 7);
      if (month) months.add(month);
    }

    if (isWineryVisit(visit)) {
      visitsPerWinery.set(visit.winery_id, (visitsPerWinery.get(visit.winery_id) || 0) + 1);
      if (visit.visit_date) {
        const day = wineriesPerDay.get(visit.visit_date) || new Set();
        day.add(visit.winery_id);
        wineriesPerDay.set(visit.visit_date, day);
      }
      if (visit.wineries) wineryById.set(visit.winery_id, visit.wineries);
    }

    for (const wine of wines) {
      wineKeys.add(wineKey(wine));
      if (Number(wine?.overall_rating) > 0) ratedTastings += 1;
      if (String(wine?.additional_notes ?? '').trim()) tastingsWithNotes += 1;
      if (hasPhoto(wine)) tastingsWithPhotos += 1;

      // A grape counts once per wine even when the label lists it twice.
      const grapes = new Set();
      for (const raw of parseVarietals(wine?.wine_varietal)) {
        const grape = canonicalGrape(raw);
        if (grape) grapes.add(grape);
      }
      for (const grape of grapes) {
        varietalCounts.set(grape, (varietalCounts.get(grape) || 0) + 1);
      }

      const bucket = styleBucket(wine);
      if (bucket) typeCounts[bucket] = (typeCounts[bucket] || 0) + 1;

      for (const link of wine?.wine_flavor_notes || []) {
        const name = link?.flavor_notes?.name;
        if (name) flavorNotes.add(name);
      }
    }
  }

  // Regions and states, per distinct visited winery. The AVA layer is bundled
  // and offline (lib/avaRegions.js), so this costs nothing but a point-in-
  // polygon test; guard it anyway so one malformed coordinate cannot take the
  // whole Achievements screen down.
  const avas = new Set();
  const stateCounts = new Map();
  for (const winery of wineryById.values()) {
    let hits = [];
    const lat = Number(winery?.latitude);
    const lng = Number(winery?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        hits = regionsAtPoint(lat, lng) || [];
      } catch {
        hits = [];
      }
    }

    const states = new Set();
    for (const hit of hits) {
      const props = hit?.properties || hit;
      if (props?.id) avas.add(props.id);
      for (const state of props?.states || []) states.add(state);
    }

    // The directory row is authoritative when we have it; the AVA hit is next
    // best; the address is the fallback.
    const known = winery?.state || stateFromAddress(winery?.address);
    const resolved = known ? [known] : [...states];
    for (const state of resolved) {
      stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
    }
  }

  // Cellar. Every bottle ever added counts, including the ones long since
  // drunk, because Cellar Curator is about what passed through your hands.
  const cellarWineKeys = new Set();
  const cellarRegions = new Set();
  const cellarCountries = new Set();
  for (const bottle of bottleList) {
    cellarWineKeys.add(wineKey(bottle));
    const region = String(bottle?.region ?? '').trim();
    if (region) {
      cellarRegions.add(findRegion(region)?.name || region);
      const country = regionCountry(region);
      if (country) cellarCountries.add(country);
    }
  }

  let bottlesOpened = 0;
  let longestHoldDays = 0;
  let openedInWindow = 0;
  for (const pour of pours) {
    // 'in_cellar' is the Coravin style sample: tasted, bottle kept. It is not
    // a bottle opened (see KEEP_BOTTLE_REASON in lib/cellar.js).
    if (pour?.reason === 'in_cellar') continue;
    bottlesOpened += 1;

    const bottle = pour?.bottle || {};
    const consumed = pour?.consumed_date || pour?.created_at || null;
    if (bottle.purchase_date && consumed) {
      const held = daysBetween(bottle.purchase_date, consumed);
      if (held != null && held > longestHoldDays) longestHoldDays = held;
    }

    const from = Number(bottle.drink_from);
    const by = Number(bottle.drink_by);
    const year = consumed ? Number(String(consumed).slice(0, 4)) : NaN;
    if (Number.isFinite(from) && Number.isFinite(by) && Number.isFinite(year)
      && year >= from && year <= by) {
      openedInWindow += 1;
    }
  }

  const nonLaunchCounts = [...varietalCounts.entries()]
    .filter(([grape]) => !LAUNCH_GRAPES.has(grape))
    .map(([, count]) => count);
  const distinctHybrids = [...varietalCounts.keys()]
    .filter((grape) => HYBRID_SET.has(grape.toLowerCase())).length;

  return {
    tastings,
    distinctWineries: visitsPerWinery.size,
    distinctWines: wineKeys.size,

    varietalCounts,
    distinctVarietals: varietalCounts.size,
    maxNonLaunchVarietalCount: maxOf(nonLaunchCounts),
    distinctHybrids,

    typeCounts,

    visitsPerWinery,
    maxVisitsToOneWinery: maxOf([...visitsPerWinery.values()]),
    maxWineriesInOneDay: maxOf([...wineriesPerDay.values()].map((set) => set.size)),

    distinctAvas: avas.size,
    distinctStates: stateCounts.size,
    maxWineriesInOneState: maxOf([...stateCounts.values()]),

    distinctCellarWines: cellarWineKeys.size,
    distinctCellarRegions: cellarRegions.size,
    distinctCellarCountries: cellarCountries.size,

    bottlesOpened,
    longestHoldDays,
    openedInWindow,

    ratedTastings,
    tastingsWithNotes,
    tastingsWithPhotos,
    distinctFlavorNotes: flavorNotes.size,
    distinctMonths: months.size,
  };
}
