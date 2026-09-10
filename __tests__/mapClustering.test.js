// Clustering + viewport helpers for the Explore map (utils/MapUtils.js, #224).
import { buildClusterIndex, regionToBoundingBox, regionToZoom } from '../utils/MapUtils';

describe('regionToZoom', () => {
  it('maps the whole world to zoom 0 and clamps below', () => {
    expect(regionToZoom({ longitudeDelta: 360 })).toBe(0);
    expect(regionToZoom({ longitudeDelta: 720 })).toBe(0);
  });

  it('the initial centered-on-you view (delta 0.1) is close enough for labels', () => {
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
