import {
  bboxIntersects,
  establishedYear,
  formatStates,
  loadRegions,
  pointInRegion,
  regionCenter,
  regionRadiusKm,
  regionsAtPoint,
  regionsInBounds,
  regionsMeta,
  toNativePolygons,
} from '../lib/avaRegions';

// A 2x2 degree square with a 0.5 degree hole in its middle.
const square = {
  id: 'square',
  name: 'Square',
  states: ['VA'],
  created: '1984-02-22',
  bbox: [-79, 37, -77, 39],
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[-79, 37], [-77, 37], [-77, 39], [-79, 39], [-79, 37]],
      [[-78.25, 37.75], [-77.75, 37.75], [-77.75, 38.25], [-78.25, 38.25], [-78.25, 37.75]],
    ],
  },
};

// A small region nested inside the square, plus a second island far away.
const nested = {
  id: 'nested',
  name: 'Nested',
  states: ['OR', 'WA'],
  created: null,
  bbox: [-78.9, 37.1, -78.5, 37.5],
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [[[-78.9, 37.1], [-78.5, 37.1], [-78.5, 37.5], [-78.9, 37.5], [-78.9, 37.1]]],
      [[[-120, 45], [-119, 45], [-119, 46], [-120, 46], [-120, 45]]],
    ],
  },
};
nested.bbox = [-120, 37.1, -78.5, 46];

test('pointInRegion honours holes', () => {
  expect(pointInRegion(37.5, -78.5, square)).toBe(true);
  expect(pointInRegion(38, -78, square)).toBe(false); // inside the hole
  expect(pointInRegion(40, -78, square)).toBe(false); // outside the bbox
});

test('pointInRegion checks every part of a MultiPolygon', () => {
  expect(pointInRegion(37.3, -78.7, nested)).toBe(true);
  expect(pointInRegion(45.5, -119.5, nested)).toBe(true);
  expect(pointInRegion(41, -100, nested)).toBe(false); // inside the union bbox, in neither part
});

test('regionsAtPoint returns every overlapping region', () => {
  const both = regionsAtPoint(37.3, -78.7, [square, nested]);
  expect(both.map((r) => r.id)).toEqual(['square', 'nested']);
  expect(regionsAtPoint(38.8, -77.2, [square, nested]).map((r) => r.id)).toEqual(['square']);
  expect(regionsAtPoint(0, 0, [square, nested])).toEqual([]);
});

test('bboxIntersects and regionsInBounds filter by viewport', () => {
  expect(bboxIntersects([0, 0, 1, 1], [1, 1, 2, 2])).toBe(true); // touching corner
  expect(bboxIntersects([0, 0, 1, 1], [1.1, 0, 2, 1])).toBe(false);
  const viewport = { west: -78.95, south: 37.05, east: -78.4, north: 37.6 };
  expect(regionsInBounds(viewport, [square, nested]).map((r) => r.id)).toEqual(['square', 'nested']);
  expect(regionsInBounds({ west: -121, south: 44, east: -118, north: 47 }, [square, nested]).map((r) => r.id)).toEqual(['nested']);
});

test('toNativePolygons converts [lng, lat] and splits MultiPolygons with holes', () => {
  const [poly] = toNativePolygons(square);
  expect(poly.key).toBe('square:0');
  expect(poly.coordinates[0]).toEqual({ latitude: 37, longitude: -79 });
  expect(poly.holes).toHaveLength(1);
  expect(poly.holes[0][0]).toEqual({ latitude: 37.75, longitude: -78.25 });

  const parts = toNativePolygons(nested);
  expect(parts.map((p) => p.key)).toEqual(['nested:0', 'nested:1']);
  expect(parts[1].holes).toEqual([]);
});

test('regionCenter and regionRadiusKm describe the bbox', () => {
  expect(regionCenter(square)).toEqual({ latitude: 38, longitude: -78 });
  const radius = regionRadiusKm(square);
  expect(radius).toBeGreaterThan(130);
  expect(radius).toBeLessThan(150);
});

test('formatStates and establishedYear read the feature', () => {
  expect(formatStates(square)).toBe('Virginia');
  expect(formatStates(nested)).toBe('Oregon and Washington');
  expect(formatStates({ states: ['IL', 'IA', 'MN', 'WI'] })).toBe('Illinois, Iowa, Minnesota and Wisconsin');
  expect(formatStates({ states: [] })).toBe('');
  expect(establishedYear(square)).toBe(1984);
  expect(establishedYear(nested)).toBeNull();
});

test('the bundled asset loads with every US AVA', () => {
  const features = loadRegions();
  const meta = regionsMeta();
  // TTB's own AVA Map Explorer service (public domain), 280 established AVAs
  // as of 2026-08-18, including the four established in 2026.
  expect(meta.license).toBe('US Government work (public domain)');
  expect(meta.count).toBe(280);
  expect(features).toHaveLength(280);
  const allNames = features.map((f) => f.name);
  expect(allNames).toEqual(expect.arrayContaining(['Tryon Foothills', 'Nashoba Valley', 'Nine Lakes of East Tennessee', 'Columbia Hills']));
  expect(allNames).not.toContain('Mendocino Ridge (Outline)');
  expect(new Set(allNames).size).toBe(280);
  for (const f of features) {
    expect(typeof f.id).toBe('string');
    expect(f.bbox).toHaveLength(4);
    expect(f.bbox[0]).toBeLessThanOrEqual(f.bbox[2]);
    expect(f.bbox[1]).toBeLessThanOrEqual(f.bbox[3]);
    expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
    expect(f.geometry.coordinates.length).toBeGreaterThan(0);
    expect(f.states.length).toBeGreaterThan(0);
  }
  // Napa Valley is inside North Coast; the tasting room at 38.30, -122.29 is in both.
  const names = regionsAtPoint(38.3, -122.29).map((r) => r.name);
  expect(names).toEqual(expect.arrayContaining(['Napa Valley', 'North Coast']));
});
