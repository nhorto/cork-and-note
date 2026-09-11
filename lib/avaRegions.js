// lib/avaRegions.js: the "Wine regions" map layer, pure functions over the
// bundled US AVA asset (assets/data/avas.json, built by scripts/build-ava-regions.mjs).
//
// v1 ships the simplified geometry inside the app and does membership on the
// device (bbox prefilter, then ray casting). The research brief asked for a
// PostGIS membership endpoint keyed by boundary revision; that is deferred so
// the layer can ship without a server change. Consequences to keep in mind:
//   - the asset is display-grade (5% simplification), so a winery within a few
//     hundred metres of a border may land on the wrong side;
//   - region winery lists come from the viewport query (capped at 750), so a
//     count can be a floor, never a census.
// Everything here is side-effect free apart from the lazy require, so it is
// unit-testable without a map.
import { haversineKm } from './geo';

let cache = null;

/** The bundled asset, parsed once. */
export function loadRegions() {
  if (!cache) cache = require('../assets/data/avas.json');
  return cache.features;
}

export function regionsMeta() {
  loadRegions();
  return cache.meta;
}

/** Test hook: swap the bundled data for a fixture. */
export function _setRegionsForTests(data) {
  cache = data;
}

/** Axis-aligned overlap of two `[west, south, east, north]` boxes. */
export function bboxIntersects(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Regions whose bbox touches the viewport. Cheap prefilter for rendering. */
export function regionsInBounds({ west, south, east, north }, features = loadRegions()) {
  const box = [west, south, east, north];
  return features.filter((f) => bboxIntersects(f.bbox, box));
}

const toLatLng = (ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude }));

/**
 * One react-native-maps <Polygon> per outer ring. GeoJSON positions are
 * [lng, lat]; the first ring of each polygon is the outline, the rest are holes.
 * MultiPolygons become several native polygons that share the region id.
 */
export function toNativePolygons(feature) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === 'MultiPolygon' ? coordinates : [coordinates];
  return polygons.map((rings, i) => ({
    key: `${feature.id}:${i}`,
    coordinates: toLatLng(rings[0]),
    holes: rings.slice(1).map(toLatLng),
  }));
}

// Ray casting on one ring. A point exactly on an edge counts as inside; with
// simplified geometry that is the friendlier failure mode.
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True when the point is inside the region's fill: in an outer ring and not in one of its holes. */
export function pointInRegion(lat, lng, feature) {
  const [west, south, east, north] = feature.bbox;
  if (lng < west || lng > east || lat < south || lat > north) return false;
  const { type, coordinates } = feature.geometry;
  const polygons = type === 'MultiPolygon' ? coordinates : [coordinates];
  return polygons.some(
    (rings) => pointInRing(lng, lat, rings[0]) && !rings.slice(1).some((hole) => pointInRing(lng, lat, hole))
  );
}

/** Every region containing the point. AVAs nest (Napa Valley inside North Coast), so this is a list. */
export function regionsAtPoint(lat, lng, candidates = loadRegions()) {
  return candidates.filter((f) => pointInRegion(lat, lng, f));
}

/** Bbox centre, good enough to hand a planner a starting point. */
export function regionCenter(feature) {
  const [west, south, east, north] = feature.bbox;
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

/** Half the bbox diagonal in km: a radius that covers the whole region from its centre. */
export function regionRadiusKm(feature) {
  const [west, south, east, north] = feature.bbox;
  return haversineKm(south, west, north, east) / 2;
}

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** "Virginia", "Oregon and Washington", "Illinois, Iowa, Minnesota and Wisconsin". */
export function formatStates(feature) {
  const names = (feature.states ?? []).map((code) => STATE_NAMES[code] ?? code);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Four-digit year from an ISO date, or null when the source has no date. */
export function establishedYear(feature) {
  const match = /^(\d{4})/.exec(feature.created ?? '');
  return match ? Number(match[1]) : null;
}
