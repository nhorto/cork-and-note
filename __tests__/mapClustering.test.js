// Clustering + viewport helpers for the Explore map (utils/MapUtils.js, #224).
import {
  CLUSTER_RADIUS,
  CLUSTER_RADIUS_LABELLED,
  LABEL_ZOOM_DISCOVER,
  LABEL_ZOOM_USER,
  SPREAD_ZOOM,
  bboxContains,
  buildClusterIndex,
  featureKey,
  placeLabels,
  regionToBoundingBox,
  regionToZoom,
  spreadStackedFeatures,
} from '../utils/MapUtils';

describe('regionToZoom', () => {
  it('maps the whole world to zoom 0 and clamps below', () => {
    expect(regionToZoom({ longitudeDelta: 360 })).toBe(0);
    expect(regionToZoom({ longitudeDelta: 720 })).toBe(0);
  });

  it('the initial centered-on-you view (delta 0.1) is close enough for your own labels', () => {
    expect(regionToZoom({ longitudeDelta: 0.1 })).toBeGreaterThan(11.5);
  });

  it('a state-wide view (delta 5) is well below the label threshold', () => {
    expect(regionToZoom({ longitudeDelta: 5 })).toBeLessThan(7);
  });
});

describe('regionToBoundingBox', () => {
  const region = { latitude: 38, longitude: -78, latitudeDelta: 2, longitudeDelta: 4 };

  it('spans the viewport with no padding', () => {
    expect(regionToBoundingBox(region)).toEqual({
      west: -80,
      east: -76,
      south: 37,
      north: 39,
    });
  });

  it('padding widens each side by that fraction of the viewport', () => {
    const box = regionToBoundingBox(region, 0.25);
    expect(box.west).toBe(-81);
    expect(box.east).toBe(-75);
    expect(box.south).toBe(36.5);
    expect(box.north).toBe(39.5);
  });

  it('clamps to valid coordinates on a zoomed-out map', () => {
    const world = { latitude: 0, longitude: 0, latitudeDelta: 300, longitudeDelta: 400 };
    expect(regionToBoundingBox(world, 0.3)).toEqual({
      west: -180,
      east: 180,
      south: -85,
      north: 85,
    });
  });
});

describe('buildClusterIndex', () => {
  const pinAt = (id, latitude, longitude) => ({ id, latitude, longitude });
  const WORLD = [-180, -85, 180, 85];

  it('collapses co-located pins into one cluster when zoomed out, apart when zoomed in', () => {
    const index = buildClusterIndex([
      { kind: 'user', pin: pinAt(1, 38.0, -78.0) },
      { kind: 'user', pin: pinAt(2, 38.01, -78.01) },
    ]);
    const zoomedOut = index.getClusters(WORLD, 5);
    expect(zoomedOut).toHaveLength(1);
    expect(zoomedOut[0].properties.cluster).toBe(true);
    expect(zoomedOut[0].properties.point_count).toBe(2);

    const zoomedIn = index.getClusters(WORLD, 16);
    expect(zoomedIn).toHaveLength(2);
    expect(zoomedIn.every((f) => !f.properties.cluster)).toBe(true);
  });

  it('leaves far-apart pins unclustered with their kind and pin intact', () => {
    const index = buildClusterIndex([
      { kind: 'user', pin: pinAt(1, 38.0, -78.0) },
      { kind: 'discover', pin: pinAt(9, 45.0, -122.0) },
    ]);
    const features = index.getClusters(WORLD, 5);
    expect(features).toHaveLength(2);
    const discover = features.find((f) => f.properties.kind === 'discover');
    expect(discover.properties.pin.id).toBe(9);
  });

  it('counts discovery pins so an all-discovery cluster is detectable', () => {
    const index = buildClusterIndex([
      { kind: 'discover', pin: pinAt(1, 38.0, -78.0) },
      { kind: 'discover', pin: pinAt(2, 38.01, -78.01) },
      { kind: 'user', pin: pinAt(3, 38.02, -78.02) },
    ]);
    const [cluster] = index.getClusters(WORLD, 5);
    expect(cluster.properties.point_count).toBe(3);
    expect(cluster.properties.discoverCount).toBe(2);
  });
});

describe('bboxContains', () => {
  const outer = { west: -80, south: 36, east: -76, north: 40 };

  it('is true for a box fully inside', () => {
    expect(bboxContains(outer, { west: -79, south: 37, east: -77, north: 39 })).toBe(true);
  });

  it('is true for the same box', () => {
    expect(bboxContains(outer, { ...outer })).toBe(true);
  });

  it('is false when any edge pokes out', () => {
    expect(bboxContains(outer, { west: -81, south: 37, east: -77, north: 39 })).toBe(false);
    expect(bboxContains(outer, { west: -79, south: 37, east: -77, north: 41 })).toBe(false);
  });
});

describe('spreadStackedFeatures', () => {
  const leaf = (id, latitude, longitude) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: { kind: 'discover', pin: { id, latitude, longitude } },
  });
  // Six tasting rooms at one Healdsburg address (real directory data).
  const stack = [1, 2, 3, 4, 5, 6].map((id) => leaf(id, 38.6773529, -122.9269361));

  it('leaves everything alone below the spread zoom', () => {
    const out = spreadStackedFeatures(stack, 15);
    expect(out).toBe(stack);
  });

  it('fans coincident pins onto a spiral past the spread zoom, keeping identity', () => {
    const out = spreadStackedFeatures(stack, SPREAD_ZOOM);
    const coords = new Set(out.map((f) => f.geometry.coordinates.join(',')));
    expect(coords.size).toBe(6);
    // Same properties objects: marker keys and pin references survive.
    out.forEach((f, i) => expect(f.properties).toBe(stack[i].properties));
    // Every pin stays within ~90 pt of the true spot, and no two pins sit
    // closer than a marker's width (32 pt) at this zoom.
    const ptsPerDeg = (400 * Math.pow(2, SPREAD_ZOOM)) / 360;
    const pts = out.map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      return {
        x: (lng + 122.9269361) * ptsPerDeg * Math.cos((38.68 * Math.PI) / 180),
        y: (lat - 38.6773529) * ptsPerDeg,
      };
    });
    pts.forEach((p) => expect(Math.hypot(p.x, p.y)).toBeLessThan(90));
    pts.forEach((p, i) => pts.slice(i + 1).forEach((q) => expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(30)));
  });

  it('does not move singletons or clusters', () => {
    const single = leaf(9, 38.5, -122.5);
    const cluster = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.9269361, 38.6773529] },
      properties: { cluster: true, cluster_id: 7, point_count: 6 },
    };
    const out = spreadStackedFeatures([single, cluster, ...stack.slice(0, 1)], 17);
    expect(out[0]).toBe(single);
    expect(out[1]).toBe(cluster);
    expect(out[2]).toBe(stack[0]);
  });
});

describe('buildClusterIndex radius option', () => {
  const pinAt = (id, latitude, longitude) => ({ id, latitude, longitude });
  const WORLD = [-180, -85, 180, 85];

  it('a wider radius merges pins the default radius keeps apart', () => {
    // ~55 px apart at zoom 13 (supercluster measures radius on its 512 px tile extent).
    const entries = [
      { kind: 'discover', pin: pinAt(1, 38.3, -122.3) },
      { kind: 'discover', pin: pinAt(2, 38.3, -122.3 + (55 * 360) / (512 * Math.pow(2, 13))) },
    ];
    expect(buildClusterIndex(entries, { radius: CLUSTER_RADIUS }).getClusters(WORLD, 13)).toHaveLength(2);
    expect(buildClusterIndex(entries, { radius: CLUSTER_RADIUS_LABELLED }).getClusters(WORLD, 13)).toHaveLength(1);
  });
});

describe('placeLabels', () => {
  const leaf = (kind, id, latitude, longitude) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: { kind, pin: { id, latitude, longitude } },
  });
  const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4, 38.4] }, properties: { cluster: true, cluster_id: 1, point_count: 3 } };
  // Degrees of longitude for N points at this zoom (screenWidth 400).
  const degFor = (pts, zoom) => (pts * 360) / (400 * Math.pow(2, zoom));

  it('labels nothing below the user threshold and never labels clusters', () => {
    const out = placeLabels([leaf('user', 1, 38.4, -122.4), cluster], LABEL_ZOOM_USER - 0.1);
    expect(out.size).toBe(0);
    expect(placeLabels([cluster], 20).size).toBe(0);
  });

  it('gives your own places a label before directory pins get theirs', () => {
    const zoom = LABEL_ZOOM_USER + 0.5; // above the user threshold, below the directory one
    const out = placeLabels([leaf('discover', 9, 38.4, -122.4), leaf('user', 1, 38.4, -122.4 + degFor(300, zoom))], zoom);
    expect(out).toEqual(new Set(['user-1']));
  });

  it('skips a label that would sit on one already placed, and keeps far-apart ones', () => {
    const zoom = LABEL_ZOOM_DISCOVER + 1;
    const a = leaf('discover', 1, 38.4, -122.4);
    const near = leaf('discover', 2, 38.4, -122.4 + degFor(60, zoom)); // 60 pt away: collides
    const far = leaf('discover', 3, 38.4, -122.4 + degFor(200, zoom)); // 200 pt away: fits
    const out = placeLabels([far, near, a], zoom);
    expect(out.has(featureKey(a))).toBe(true);
    expect(out.has(featureKey(near))).toBe(false);
    expect(out.has(featureKey(far))).toBe(true);
  });

  it('a user pin beats a directory pin for the same spot', () => {
    const zoom = LABEL_ZOOM_DISCOVER + 1;
    const out = placeLabels([leaf('discover', 5, 38.4, -122.4), leaf('user', 6, 38.4001, -122.4)], zoom);
    expect(out).toEqual(new Set(['user-6']));
  });
});
