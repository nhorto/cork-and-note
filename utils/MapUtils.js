// utils/MapUtils.js — supercluster helpers for the Explore map (#224).
//
// The map feeds every visible pin (the user's places + directory discovery)
// through one supercluster index, then renders whatever comes back for the
// current viewport: count bubbles where pins would overlap, individual pins
// where there's room. maxZoom 15 means a close street-level view always shows
// real pins, never a bubble of 2.
import Supercluster from 'supercluster';

/**
 * Build a cluster index from `{ kind: 'user' | 'discover', pin }` entries.
 * Clusters aggregate `discoverCount` so an all-discovery bubble can render in
 * the discovery accent color instead of the user-pin burgundy.
 */
export function buildClusterIndex(entries) {
  const index = new Supercluster({
    radius: 44,
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
