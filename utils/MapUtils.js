// utils/MapUtils.js — supercluster helpers for the Explore map (#224).
//
// The map feeds every visible pin (the user's places + directory discovery)
// through one supercluster index, then renders whatever comes back for the
// current viewport: count bubbles where pins would overlap, individual pins
// where there's room. maxZoom 15 means a close street-level view always shows
// real pins, never a bubble of 2.
import Supercluster from 'supercluster';

// Cluster radius in screen pixels. Once name labels are showing (LABEL_ZOOM_*
// below), two pins need more than a marker's width between them or their
// labels collide, so the radius widens with the labels (#276).
export const CLUSTER_RADIUS = 44;
export const CLUSTER_RADIUS_LABELLED = 60;
// Name labels: your own places first, directory pins only when close enough
// that a dense town (Healdsburg, Woodinville) has room for them.
export const LABEL_ZOOM_USER = 11.5;
export const LABEL_ZOOM_DISCOVER = 13.5;
// Above the index's maxZoom supercluster hands back raw points, so pins that
// share a coordinate (six tasting rooms in one building) would stack exactly.
export const SPREAD_ZOOM = 16;

/**
 * Build a cluster index from `{ kind: 'user' | 'discover', pin }` entries.
 * Clusters aggregate `discoverCount` so an all-discovery bubble can render in
 * the discovery accent color instead of the user-pin burgundy.
 */
export function buildClusterIndex(entries, { radius = CLUSTER_RADIUS } = {}) {
  const index = new Supercluster({
    radius,
    maxZoom: 15,
    minPoints: 2,
    map: (props) => ({ discoverCount: props.kind === 'discover' ? 1 : 0 }),
    reduce: (acc, props) => {
      acc.discoverCount += props.discoverCount;
    },
  });
  index.load(
    entries.map(({ kind, pin }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.longitude, pin.latitude] },
      properties: { kind, pin },
    }))
  );
  return index;
}

/** react-native-maps region → web-mercator zoom level. */
export function regionToZoom(region) {
  const zoom = Math.log2(360 / Math.max(region.longitudeDelta, 0.00001));
  return Math.max(0, Math.min(20, zoom));
}

/**
 * react-native-maps region → `{ west, south, east, north }`. `pad` widens the
 * box by that fraction of the viewport per side, so pins/clusters just past
 * the screen edge already exist mid-pan.
 */
export function regionToBoundingBox(region, pad = 0) {
  const halfLng = region.longitudeDelta * (0.5 + pad);
  const halfLat = region.latitudeDelta * (0.5 + pad);
  return {
    west: Math.max(-180, region.longitude - halfLng),
    east: Math.min(180, region.longitude + halfLng),
    south: Math.max(-85, region.latitude - halfLat),
    north: Math.min(85, region.latitude + halfLat),
  };
}

/** True when `inner` lies entirely inside `outer` (both `{ west, south, east, north }`). */
export function bboxContains(outer, inner) {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

// One identity per map feature, shared by render keys, the stable sort, the
// two-phase commit and label placement.
export const featureKey = (f) =>
  f.properties.cluster
    ? `cluster-${f.properties.cluster_id}`
    : `${f.properties.kind}-${f.properties.pin.id}`;

// Screen-space projection at a zoom. react-native-maps' region maps the
// screen width onto longitudeDelta, and regionToZoom defines zoom by that
// delta, so points-per-degree is screenWidth * 2^zoom / 360.
const projector = (zoom, screenWidth = 400) => {
  const ptsPerDeg = (screenWidth * Math.pow(2, zoom)) / 360;
  return ([lng, lat]) => ({
    x: lng * ptsPerDeg,
    y: (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI) * ptsPerDeg,
  });
};

/**
 * Which leaf features get a name label at this zoom (#276): a greedy pass
 * that skips any pin whose label footprint would sit on a label already
 * placed. Your own places go first so they always win a spot; directory pins
 * fill in what room is left, and only from their own (closer) zoom. Returns
 * a Set of feature keys.
 */
export function placeLabels(
  features,
  zoom,
  { userFrom = LABEL_ZOOM_USER, discoverFrom = LABEL_ZOOM_DISCOVER, width = 150, height = 44, screenWidth = 400 } = {}
) {
  const placed = [];
  const out = new Set();
  const project = projector(zoom, screenWidth);
  const candidates = features
    .filter((f) => !f.properties.cluster)
    .filter((f) => (f.properties.kind === 'user' ? zoom >= userFrom : zoom >= discoverFrom))
    .sort((a, b) =>
      a.properties.kind === b.properties.kind
        ? featureKey(a).localeCompare(featureKey(b))
        : a.properties.kind === 'user' ? -1 : 1
    );
  for (const f of candidates) {
    const p = project(f.geometry.coordinates);
    if (placed.every((q) => Math.abs(q.x - p.x) >= width || Math.abs(q.y - p.y) >= height)) {
      placed.push(p);
      out.add(featureKey(f));
    }
  }
  return out;
}

/**
 * Fan out leaf features that share a coordinate so each one gets its own
 * tappable marker (#276). Only past SPREAD_ZOOM, where supercluster no longer
 * groups them. Pins are laid on a sunflower spiral (golden angle, radius
 * growing with the square root of the index) so six or twenty-six neighbours
 * pack evenly around the true spot without stacking. Clusters and singletons
 * pass through untouched, and features keep their properties object, so
 * marker keys stay stable.
 */
export function spreadStackedFeatures(features, zoom, { screenWidth = 400 } = {}) {
  if (zoom < SPREAD_ZOOM) return features;
  const groups = new Map();
  for (const f of features) {
    if (f.properties.cluster) continue;
    const [lng, lat] = f.geometry.coordinates;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.push(f);
    else groups.set(key, [f]);
  }
  const stacked = new Map();
  // ~34 pt between neighbours (a marker is 32 pt), expressed in degrees.
  const stepDeg = (34 * 360) / (screenWidth * Math.pow(2, zoom));
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [lng, lat] = group[0].geometry.coordinates;
    const latScale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    group.forEach((f, i) => {
      const r = stepDeg * Math.sqrt(i + 1);
      const angle = i * GOLDEN;
      stacked.set(f, {
        ...f,
        geometry: {
          ...f.geometry,
          coordinates: [lng + (r * Math.cos(angle)) / latScale, lat + r * Math.sin(angle)],
        },
      });
    });
  }
  return stacked.size ? features.map((f) => stacked.get(f) ?? f) : features;
}
