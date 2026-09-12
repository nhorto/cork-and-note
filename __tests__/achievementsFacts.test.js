// What the badge engine believes about your journal (#295).
//
// buildFacts is the only place the app decides what "a distinct wine", "a grape
// you have tasted" or "a winery you have visited" means, so the interesting
// cases are all about things that look like two of something and are really
// one, or look like one and are really none.
import { _setRegionsForTests } from '../lib/avaRegions';
import { buildFacts } from '../lib/achievements/facts';

// Two nested AVAs (the small one inside the big one) plus a far away region, so
// a point can legitimately be in two regions at once.
const square = (id, states, [west, south, east, north]) => ({
  id,
  name: id,
  states,
  bbox: [west, south, east, north],
  geometry: {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  },
});

beforeAll(() => {
  _setRegionsForTests({
    meta: {},
    features: [
      square('big', ['VA'], [-79, 37, -77, 39]),
      square('small', ['VA'], [-78.5, 37.5, -78, 38]),
      square('far', ['CA'], [-123, 37, -121, 39]),
    ],
  });
});
afterAll(() => _setRegionsForTests(null));

const wine = (over = {}) => ({
  id: `w${Math.random()}`,
  winemaker: 'Barboursville',
  wine_name: 'Octagon',
  wine_type: 'Red',
  wine_varietal: ['Merlot'],
  wine_year: '2019',
  overall_rating: 0,
  additional_notes: '',
  photos: [],
  wine_flavor_notes: [],
  ...over,
});

const visit = (over = {}) => ({
  id: `v${Math.random()}`,
  winery_id: 7,
  place_type: 'winery',
  visit_date: '2026-03-04',
  wineries: { id: 7, name: 'Barboursville', latitude: 37.75, longitude: -78.25, address: null, state: null },
  wines: [wine()],
  ...over,
});

describe('counting tastings and wines', () => {
  test('an empty journal is all zeros, and no input at all does not throw', () => {
    const facts = buildFacts({});
    expect(facts.tastings).toBe(0);
    expect(facts.distinctWines).toBe(0);
    expect(facts.distinctWineries).toBe(0);
    expect(buildFacts().tastings).toBe(0);
  });

  test('two vintages of the same wine are one wine discovered', () => {
    const facts = buildFacts({
      visits: [visit({ wines: [wine({ wine_year: '2019' }), wine({ wine_year: '2021' })] })],
    });
    expect(facts.tastings).toBe(2);
    expect(facts.distinctWines).toBe(1);
  });

  test('a nameless wine is identified by producer and grape', () => {
    const facts = buildFacts({
      visits: [visit({
        wines: [
          wine({ wine_name: '', wine_varietal: ['Viognier'] }),
          wine({ wine_name: '', wine_varietal: ['Viognier'] }),
          wine({ wine_name: '', wine_varietal: ['Petit Verdot'] }),
        ],
      })],
    });
    expect(facts.distinctWines).toBe(2);
  });
});

describe('grapes', () => {
  const grapesOf = (varietals) =>
    buildFacts({ visits: [visit({ wines: varietals.map((v) => wine({ wine_varietal: v })) })] });

  test('Shiraz and Syrah/Shiraz both count as Syrah', () => {
    const facts = grapesOf([['Syrah'], ['Shiraz'], ['Syrah/Shiraz']]);
    expect(facts.varietalCounts.get('Syrah')).toBe(3);
    expect(facts.distinctVarietals).toBe(1);
  });

  test('Pinot Gris counts as Pinot Grigio', () => {
    const facts = grapesOf([['Pinot Gris'], ['Pinot Grigio']]);
    expect(facts.varietalCounts.get('Pinot Grigio')).toBe(2);
  });

  test('a blend is a style, not a grape', () => {
    const facts = grapesOf([['Red Blend'], ['Bordeaux Blend']]);
    expect(facts.distinctVarietals).toBe(0);
  });

  test('a grape listed twice on one wine counts once', () => {
    const facts = grapesOf([['Merlot', 'Merlot']]);
    expect(facts.varietalCounts.get('Merlot')).toBe(1);
  });

  test('an unknown grape still counts under its own name', () => {
    const facts = grapesOf([['Saperavi'], ['Saperavi'], ['Saperavi']]);
    expect(facts.varietalCounts.get('Saperavi')).toBe(3);
    expect(facts.maxNonLaunchVarietalCount).toBe(3);
  });

  test('hybrids are counted for Off the Beaten Vine', () => {
    const facts = grapesOf([['Norton'], ['Traminette'], ['Vidal Blanc'], ['Chambourcin'], ['Marquette']]);
    expect(facts.distinctHybrids).toBe(5);
  });

  test('a launch grape never counts as a curious one', () => {
    const facts = grapesOf([['Chardonnay'], ['Chardonnay'], ['Chardonnay']]);
    expect(facts.maxNonLaunchVarietalCount).toBe(0);
  });
});

describe('styles', () => {
  test('free text types land in the five buckets, and unknown text is ignored', () => {
    const facts = buildFacts({
      visits: [visit({
        wines: [
          wine({ wine_type: 'Red' }), wine({ wine_type: 'red blend' }),
          wine({ wine_type: 'Rosé' }), wine({ wine_type: 'rose' }),
          wine({ wine_type: 'Sparkling' }), wine({ wine_type: 'Dessert' }),
          wine({ wine_type: 'Orange' }),
        ],
      })],
    });
    expect(facts.typeCounts).toEqual({ Red: 2, 'Rosé': 2, Sparkling: 1, Dessert: 1 });
  });

  test('an empty type falls back to the grape', () => {
    const facts = buildFacts({
      visits: [visit({ wines: [wine({ wine_type: '', wine_varietal: ['Chardonnay'] })] })],
    });
    expect(facts.typeCounts.White).toBe(1);
  });
});

describe('places', () => {
  test('two visits to one winery is one winery and two visits', () => {
    const facts = buildFacts({ visits: [visit(), visit({ visit_date: '2026-04-01' })] });
    expect(facts.distinctWineries).toBe(1);
    expect(facts.maxVisitsToOneWinery).toBe(2);
  });

  test('a bottle opened at home counts for nothing winery related (#294)', () => {
    const facts = buildFacts({ visits: [visit({ place_type: null })] });
    expect(facts.distinctWineries).toBe(0);
    expect(facts.maxVisitsToOneWinery).toBe(0);
    expect(facts.distinctAvas).toBe(0);
    expect(facts.distinctStates).toBe(0);
    // The tasting itself still counts.
    expect(facts.tastings).toBe(1);
  });

  test('three wineries on one day', () => {
    const winery = (id, name) => ({ id, name, latitude: 37.75, longitude: -78.25 });
    const facts = buildFacts({
      visits: [
        visit({ winery_id: 1, wineries: winery(1, 'One') }),
        visit({ winery_id: 2, wineries: winery(2, 'Two') }),
        visit({ winery_id: 3, wineries: winery(3, 'Three') }),
        visit({ winery_id: 4, wineries: winery(4, 'Four'), visit_date: '2026-05-05' }),
      ],
    });
    expect(facts.maxWineriesInOneDay).toBe(3);
    expect(facts.distinctWineries).toBe(4);
  });

  test('a point inside a nested AVA counts for both regions', () => {
    const facts = buildFacts({ visits: [visit()] }); // 37.75, -78.25 is in big and small
    expect(facts.distinctAvas).toBe(2);
  });

  test('a winery with no coordinates contributes no region', () => {
    const facts = buildFacts({
      visits: [visit({ wineries: { id: 7, name: 'Nowhere', latitude: null, longitude: null } })],
    });
    expect(facts.distinctAvas).toBe(0);
  });

  test('states come from the directory first, then the AVA, then the address', () => {
    const facts = buildFacts({
      visits: [
        visit({ winery_id: 1, wineries: { id: 1, name: 'Directory', state: 'OR', latitude: 37.75, longitude: -78.25 } }),
        visit({ winery_id: 2, wineries: { id: 2, name: 'Ava', latitude: 37.75, longitude: -78.25 } }),
        visit({ winery_id: 3, wineries: { id: 3, name: 'Address', address: '1 Vine Rd, Napa, CA 94558' } }),
      ],
    });
    expect(facts.distinctStates).toBe(3); // OR, VA, CA
    expect(facts.maxWineriesInOneState).toBe(1);
  });

  test('wineries in one state stack up for Home Turf', () => {
    const facts = buildFacts({
      visits: [1, 2, 3].map((id) =>
        visit({ winery_id: id, wineries: { id, name: `W${id}`, state: 'VA' } })
      ),
    });
    expect(facts.maxWineriesInOneState).toBe(3);
    expect(facts.distinctStates).toBe(1);
  });
});

describe('the journal shelf', () => {
  test('ratings, notes, photos, flavors and months', () => {
    const facts = buildFacts({
      visits: [
        visit({
          visit_date: '2026-01-15',
          wines: [
            wine({ overall_rating: 4, additional_notes: 'lovely', photos: ['a.jpg'] }),
            wine({ overall_rating: 0, additional_notes: '   ', photo_url: '["b.jpg"]', photos: undefined }),
            wine({ wine_flavor_notes: [{ flavor_notes: { name: 'Cherry' } }, { flavor_notes: { name: 'Oak' } }] }),
          ],
        }),
        visit({ visit_date: '2026-02-20', wines: [wine({ wine_flavor_notes: [{ flavor_notes: { name: 'Cherry' } }] })] }),
        visit({ visit_date: '2026-02-28', wines: [] }), // a visit with no wine is not a month logged
      ],
    });
    expect(facts.ratedTastings).toBe(1);
    expect(facts.tastingsWithNotes).toBe(1);
    expect(facts.tastingsWithPhotos).toBe(2);
    expect(facts.distinctFlavorNotes).toBe(2);
    expect(facts.distinctMonths).toBe(2);
  });
});

describe('the cellar', () => {
  const bottle = (over = {}) => ({
    id: 1,
    producer: 'Barboursville',
    wine_name: 'Octagon',
    vintage: 2019,
    varietal: 'Merlot',
    region: 'Napa Valley',
    status: 'in_cellar',
    ...over,
  });

  test('a bottle you already drank still counts as a wine curated', () => {
    const facts = buildFacts({
      bottles: [bottle({ status: 'consumed' }), bottle({ id: 2, vintage: 2021 })],
    });
    expect(facts.distinctCellarWines).toBe(1);
  });

  test('regions and countries are counted from the region text', () => {
    const facts = buildFacts({
      bottles: [
        bottle({ region: 'Napa Valley' }),
        bottle({ id: 2, region: 'Barolo' }),
        bottle({ id: 3, region: 'Rioja' }),
        bottle({ id: 4, region: '' }),
      ],
    });
    expect(facts.distinctCellarRegions).toBe(3);
    expect(facts.distinctCellarCountries).toBeGreaterThanOrEqual(3);
  });

  test('a kept-bottle sample is not a bottle opened', () => {
    const facts = buildFacts({
      consumptions: [
        { reason: 'in_cellar', consumed_date: '2026-05-01', bottle: {} },
        { reason: 'consumed', consumed_date: '2026-05-01', bottle: {} },
      ],
    });
    expect(facts.bottlesOpened).toBe(1);
  });

  test('holding a bottle for a year and opening it inside its window', () => {
    const facts = buildFacts({
      consumptions: [
        {
          reason: 'consumed',
          consumed_date: '2026-06-01',
          bottle: { purchase_date: '2024-01-01', drink_from: 2025, drink_by: 2030 },
        },
        {
          reason: 'gifted',
          consumed_date: '2026-06-01',
          bottle: { purchase_date: '2026-05-01', drink_from: 2030, drink_by: 2040 },
        },
      ],
    });
    expect(facts.bottlesOpened).toBe(2);
    expect(facts.longestHoldDays).toBeGreaterThanOrEqual(365 * 2);
    expect(facts.openedInWindow).toBe(1);
  });
});
