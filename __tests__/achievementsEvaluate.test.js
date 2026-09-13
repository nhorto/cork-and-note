// Turning facts into badges, points and a level (#295).
//
// The two rules worth defending with tests: every tier you have passed is
// awarded (not just the top one), and points come from the rows you hold, so
// deleting half your journal can never take points away.
import {
  FAMILIES,
  GRAPES,
  GRAPE_TIER_POINTS,
  LEVELS,
  TIER_POINTS,
  grapeBadgeKey,
  levelForPoints,
  badgeByKey,
} from '../lib/achievements/catalog';
import { evaluate } from '../lib/achievements/evaluate';

// Only the facts a test names; everything else reads as zero.
const facts = (over = {}) => ({
  tastings: 0,
  distinctWineries: 0,
  distinctWines: 0,
  distinctVarietals: 0,
  distinctAvas: 0,
  distinctCellarWines: 0,
  varietalCounts: new Map(),
  typeCounts: {},
  maxNonLaunchVarietalCount: 0,
  distinctHybrids: 0,
  maxVisitsToOneWinery: 0,
  maxWineriesInOneDay: 0,
  maxWineriesInOneState: 0,
  distinctStates: 0,
  distinctCellarRegions: 0,
  distinctCellarCountries: 0,
  bottlesOpened: 0,
  longestHoldDays: 0,
  openedInWindow: 0,
  ratedTastings: 0,
  tastingsWithNotes: 0,
  tastingsWithPhotos: 0,
  distinctFlavorNotes: 0,
  distinctMonths: 0,
  ...over,
});

const family = (result, key) => result.families.find((f) => f.key === key);
const asRows = (newlyEarned) =>
  newlyEarned.map(({ badge_key, tier, points }) => ({ badge_key, tier, points }));

describe('tiered families', () => {
  test('one below a threshold earns nothing, the threshold itself earns the tier', () => {
    const below = evaluate(facts({ distinctWines: 9 }));
    expect(family(below, 'wine_discoverer').tier).toBe('bronze');

    const at = evaluate(facts({ distinctWines: 10 }));
    expect(family(at, 'wine_discoverer').tier).toBe('silver');
  });

  test('every family threshold is exact', () => {
    for (const def of FAMILIES) {
      def.thresholds.forEach((threshold, index) => {
        const justUnder = evaluate(facts({ [def.metric]: threshold - 1 }));
        const exactly = evaluate(facts({ [def.metric]: threshold }));
        expect(family(justUnder, def.key).tierIndex).toBe(index - 1);
        expect(family(exactly, def.key).tierIndex).toBe(index);
      });
    }
  });

  test('a jump straight to 25 wines awards bronze, silver and gold at once', () => {
    const result = evaluate(facts({ distinctWines: 25 }));
    const wine = result.newlyEarned.filter((b) => b.badge_key === 'wine_discoverer');
    expect(wine.map((b) => b.tier)).toEqual(['bronze', 'silver', 'gold']);
    expect(family(result, 'wine_discoverer').tier).toBe('gold');
    expect(family(result, 'wine_discoverer').nextThreshold).toBe(100);
    expect(family(result, 'wine_discoverer').nextTier).toBe('platinum');
  });

  test('nothing is awarded twice: the same facts with those rows held earn nothing', () => {
    const first = evaluate(facts({ distinctWines: 25 }));
    const second = evaluate(facts({ distinctWines: 25 }), asRows(first.newlyEarned));
    expect(second.newlyEarned).toEqual([]);
    expect(second.points).toBe(first.points);
  });

  test('progress runs from the tier you reached to the one ahead, and fills at the top', () => {
    const half = family(evaluate(facts({ distinctWineries: 10 })), 'winery_explorer');
    expect(half.progress).toBeCloseTo(0.5); // 10 of the way from 5 to 15
    const maxed = family(evaluate(facts({ distinctWineries: 99 })), 'winery_explorer');
    expect(maxed.progress).toBe(1);
    expect(maxed.nextThreshold).toBeNull();
    expect(maxed.nextTier).toBeNull();
  });
});

describe('per grape badges', () => {
  test('3, 10 and 25 tastings are Fan, Lover and Devotee', () => {
    const counts = new Map([['Chardonnay', 3]]);
    const fan = evaluate(facts({ varietalCounts: counts }));
    expect(fan.grapes.find((g) => g.grape === 'Chardonnay')).toMatchObject({
      tier: 'fan', name: 'Chardonnay Fan', nextThreshold: 10,
    });

    const devotee = evaluate(facts({ varietalCounts: new Map([['Chardonnay', 25]]) }));
    expect(devotee.grapes.find((g) => g.grape === 'Chardonnay').tier).toBe('devotee');
    expect(devotee.newlyEarned.filter((b) => b.badge_key === grapeBadgeKey('Chardonnay')))
      .toHaveLength(3);
  });

  test('two tastings of a grape earn nothing but still show progress', () => {
    const result = evaluate(facts({ varietalCounts: new Map([['Merlot', 2]]) }));
    expect(result.newlyEarned).toEqual([]);
    const merlot = result.grapes.find((g) => g.grape === 'Merlot');
    expect(merlot.tier).toBeNull();
    expect(merlot.progress).toBeCloseTo(2 / 3);
  });

  test('only grapes you have tasted are listed, but all eighteen are evaluated', () => {
    const result = evaluate(facts({ varietalCounts: new Map([['Merlot', 1]]) }));
    expect(result.grapes).toHaveLength(1);
    expect(result.allGrapes).toHaveLength(18);
  });

  test('a grape outside the launch list has no badge of its own', () => {
    const result = evaluate(facts({ varietalCounts: new Map([['Saperavi', 30]]) }));
    expect(result.newlyEarned.filter((b) => b.badge_key.startsWith('grape:'))).toEqual([]);
  });

  test('plain object varietal counts work as well as a Map', () => {
    const result = evaluate(facts({ varietalCounts: { Riesling: 10 } }));
    expect(result.grapes.find((g) => g.grape === 'Riesling').tier).toBe('lover');
  });
});

describe('one-offs', () => {
  test('Full Spectrum needs all five styles', () => {
    const four = evaluate(facts({ typeCounts: { Red: 1, White: 1, 'Rosé': 1, Sparkling: 1 } }));
    expect(four.oneOffs.find((b) => b.key === 'full_spectrum').earned).toBe(false);

    const five = evaluate(facts({ typeCounts: { Red: 1, White: 1, 'Rosé': 1, Sparkling: 1, Dessert: 1 } }));
    expect(five.oneOffs.find((b) => b.key === 'full_spectrum').earned).toBe(true);
  });

  test('a one-off is stored with a null tier', () => {
    const result = evaluate(facts({ bottlesOpened: 1 }));
    expect(result.newlyEarned).toContainEqual(
      expect.objectContaining({ badge_key: 'cork_popped', tier: null, points: 15 })
    );
  });

  test('a badge already held stays earned even when the facts no longer qualify', () => {
    const result = evaluate(facts({ bottlesOpened: 0 }), [
      { badge_key: 'cork_popped', tier: null, points: 15 },
    ]);
    expect(result.oneOffs.find((b) => b.key === 'cork_popped').earned).toBe(true);
    expect(result.newlyEarned).toEqual([]);
  });

  test('a fact the catalog expects but the caller did not supply never throws', () => {
    expect(() => evaluate({}, [])).not.toThrow();
    expect(evaluate({}).newlyEarned).toEqual([]);
  });
});

describe('points and levels', () => {
  test('points are the sum of the rows held, not of the live counts', () => {
    const result = evaluate(facts({ distinctWines: 25 }));
    expect(result.points).toBe(TIER_POINTS.bronze + TIER_POINTS.silver + TIER_POINTS.gold);
  });

  test('deleting your journal does not lower your points', () => {
    const earned = asRows(evaluate(facts({ distinctWines: 25 })).newlyEarned);
    const after = evaluate(facts({ distinctWines: 0 }), earned);
    expect(after.points).toBe(85);
    expect(after.newlyEarned).toEqual([]);
    // The display drops back, the ledger does not.
    expect(family(after, 'wine_discoverer').tier).toBeNull();
  });

  test('a grape devotee is worth its three tiers', () => {
    const result = evaluate(facts({ varietalCounts: new Map([['Riesling', 25]]) }));
    expect(result.points).toBe(
      GRAPE_TIER_POINTS.fan + GRAPE_TIER_POINTS.lover + GRAPE_TIER_POINTS.devotee
    );
  });

  test('levelForPoints walks the bottle sizes', () => {
    expect(levelForPoints(0)).toMatchObject({ level: 1, title: 'Split' });
    expect(levelForPoints(0).next).toMatchObject({ level: 2, title: 'Half Bottle', points: 50 });
    expect(levelForPoints(49).title).toBe('Split');
    expect(levelForPoints(50).title).toBe('Half Bottle');
    expect(levelForPoints(2300)).toMatchObject({ level: 9, title: 'Nebuchadnezzar', next: null });
    expect(levelForPoints(99999).title).toBe('Nebuchadnezzar');
  });

  test('a bad points value reads as the first level rather than crashing', () => {
    expect(levelForPoints(undefined).level).toBe(1);
    expect(levelForPoints(-10).level).toBe(1);
  });

  test('the levels are ordered and the ceiling is reachable', () => {
    const ascending = LEVELS.every((l, i) => i === 0 || l.points > LEVELS[i - 1].points);
    expect(ascending).toBe(true);

    // Everything in the catalog, earned: about 3,125 points, so the top level
    // is reachable but needs most of the journey.
    const everything = evaluate(facts({
      distinctWineries: 40, distinctWines: 100, distinctVarietals: 30, distinctAvas: 12,
      distinctCellarWines: 75, tastings: 200,
      varietalCounts: new Map(GRAPES.map((g) => [g.key, 25])),
      typeCounts: { Red: 5, White: 5, 'Rosé': 5, Sparkling: 5, Dessert: 5 },
      maxNonLaunchVarietalCount: 3, distinctHybrids: 5, maxVisitsToOneWinery: 5,
      maxWineriesInOneDay: 3, maxWineriesInOneState: 10, distinctStates: 5,
      distinctCellarRegions: 5, distinctCellarCountries: 3, bottlesOpened: 1,
      longestHoldDays: 400, openedInWindow: 1, ratedTastings: 25, tastingsWithNotes: 25,
      tastingsWithPhotos: 10, distinctFlavorNotes: 25, distinctMonths: 12,
    }));
    expect(everything.level.title).toBe('Nebuchadnezzar');
  });
});

describe('the catalog itself', () => {
  test('badge keys are unique and resolvable', () => {
    const result = evaluate(facts({ distinctWines: 1, varietalCounts: new Map([['Merlot', 3]]) }));
    for (const badge of result.newlyEarned) {
      expect(badgeByKey(badge.badge_key)).not.toBeNull();
    }
    expect(badgeByKey('nope')).toBeNull();
  });

  test('every family and grape badge carries a label for the celebration sheet', () => {
    const result = evaluate(facts({ distinctWineries: 1, varietalCounts: new Map([['Merlot', 3]]) }));
    expect(result.newlyEarned.map((b) => b.label)).toEqual(
      expect.arrayContaining(['Winery Explorer, Bronze', 'Merlot Fan'])
    );
  });
});
