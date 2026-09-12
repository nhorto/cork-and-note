// The badge service against an in-memory Supabase (#295): what it writes the
// first time it sees an account with history, what it does on the second run,
// and how it behaves when the database says no.
//
// The flag is off in the catalog until #296 ships the surfaces, so it is forced
// on here; the "flag off" case is asserted separately with the real value.
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
jest.mock('../lib/achievements/catalog', () => ({
  ...jest.requireActual('../lib/achievements/catalog'),
  ACHIEVEMENTS_ENABLED: true,
}));

const {
  getAchievements, refreshAchievements, getUnseen, markSeen,
} = require('../lib/achievements');

const USER = { id: 'user-a', email: 'a@example.com' };

const wine = (over = {}) => ({
  id: `w${Math.random()}`,
  winemaker: 'Barboursville',
  wine_name: 'Octagon',
  wine_type: 'Red',
  wine_varietal: ['Merlot'],
  overall_rating: 4,
  additional_notes: '',
  photo_url: '[]',
  wine_flavor_notes: [],
  ...over,
});

// One visit to one winery with one wine: enough to earn Winery Explorer Bronze,
// Wine Discoverer Bronze and Journal Keeper Bronze.
const seededJournal = [{
  id: 'v1',
  user_id: USER.id,
  winery_id: 7,
  place_type: 'winery',
  visit_date: '2026-03-04',
  photo_url: '[]',
  wineries: { id: 7, name: 'Barboursville', latitude: 38.2, longitude: -78.3 },
  wines: [wine()],
}];

const seed = (visits = seededJournal, extra = {}) => {
  supabase.reset({
    user: USER,
    tables: { visits, cellar_bottles: [], user_achievements: [], ...extra },
  });
  supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' }); // clears lib/cache
};

beforeEach(() => {
  seed();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {}); // lib/cache narrates hits and misses
});
afterEach(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

describe('refreshAchievements', () => {
  test('the first run over an existing journal backfills what was already earned', async () => {
    const res = await refreshAchievements();
    expect(res.success).toBe(true);
    expect(res.backfill).toBe(true);
    expect(res.newlyEarned.length).toBeGreaterThan(1);

    const rows = supabase.tables.user_achievements;
    expect(rows).toHaveLength(res.newlyEarned.length);
    expect(rows.every((r) => r.user_id === USER.id)).toBe(true);
    expect(rows.every((r) => r.source === 'backfill')).toBe(true);
    expect(rows.map((r) => r.badge_key)).toEqual(
      expect.arrayContaining(['winery_explorer', 'wine_discoverer', 'journal_keeper'])
    );
    // Points ride on the row, so a later deletion cannot take them back.
    expect(rows.every((r) => r.points > 0)).toBe(true);
  });

  test('a second run over the same journal writes nothing', async () => {
    const first = await refreshAchievements();
    const before = supabase.tables.user_achievements.length;

    const second = await refreshAchievements();
    expect(second.success).toBe(true);
    expect(second.newlyEarned).toEqual([]);
    expect(supabase.tables.user_achievements).toHaveLength(before);
    expect(second.result.points).toBe(first.result.points);
  });

  test('one new badge after the backfill is a live award, not a backfill', async () => {
    await refreshAchievements();
    const before = supabase.tables.user_achievements.length;

    // A second winery and two new grapes: three distinct varietals crosses
    // Grape Explorer Bronze, so exactly one badge is newly earned.
    supabase.tables.visits.push({
      ...seededJournal[0],
      id: 'v2',
      winery_id: 9,
      wineries: { id: 9, name: 'Early Mountain', latitude: 38.9, longitude: -78.0 },
      wines: [
        wine({ wine_name: 'Eluvium', wine_varietal: ['Cabernet Franc'] }),
        wine({ wine_name: 'Quaker Run', wine_varietal: ['Viognier'] }),
      ],
    });
    supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' }); // drop the cached visits

    const res = await refreshAchievements();
    expect(res.backfill).toBe(false);
    expect(res.newlyEarned.map((b) => b.badge_key)).toEqual(['grape_explorer']);
    expect(supabase.tables.user_achievements.length).toBeGreaterThan(before);
    expect(
      supabase.tables.user_achievements.filter((r) => r.source === 'live').length
    ).toBe(res.newlyEarned.length);
  });

  test('an empty account earns nothing and writes nothing', async () => {
    seed([]);
    const res = await refreshAchievements();
    expect(res.success).toBe(true);
    expect(res.newlyEarned).toEqual([]);
    expect(supabase.tables.user_achievements).toEqual([]);
  });

  test('a duplicate row from a concurrent refresh is absorbed, not thrown', async () => {
    let firstBatch = true;
    supabase.reset({
      user: USER,
      tables: { visits: seededJournal, cellar_bottles: [], user_achievements: [] },
      responders: {
        user_achievements: (query) => {
          // The batch insert loses the race once; the per-row retry then runs.
          if (query.op === 'insert' && Array.isArray(query.payload) && firstBatch) {
            firstBatch = false;
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          return undefined; // fall through to the in-memory tables
        },
      },
    });
    supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' });

    const res = await refreshAchievements();
    expect(res.success).toBe(true);
    expect(res.newlyEarned.length).toBeGreaterThan(1);
    expect(supabase.tables.user_achievements).toHaveLength(res.newlyEarned.length);
  });

  test('a database failure is reported, never thrown', async () => {
    supabase.reset({
      user: USER,
      tables: { visits: seededJournal, cellar_bottles: [] },
      responders: { user_achievements: () => ({ data: null, error: { message: 'boom' } }) },
    });
    supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' });

    const res = await refreshAchievements();
    expect(res).toMatchObject({ success: false, newlyEarned: [] });
    expect(res.error).toBe('boom');
  });

  test('a signed out user is a handled failure', async () => {
    supabase.setUser(null);
    await expect(refreshAchievements()).resolves.toMatchObject({ success: false });
  });
});

describe('getAchievements', () => {
  test('reads the journey without writing a row', async () => {
    const res = await getAchievements();
    expect(res.success).toBe(true);
    expect(res.facts.tastings).toBe(1);
    expect(res.result.families).toHaveLength(6);
    expect(supabase.tables.user_achievements).toEqual([]);
    // A read shows what the next refresh will persist, so the screen is never a
    // step behind the save path, and the total does not move when it lands.
    expect(res.result.points).toBeGreaterThan(0);
    const written = await refreshAchievements();
    expect(written.result.points).toBe(res.result.points);
  });

  test('counts the points of the rows the user already holds', async () => {
    await refreshAchievements();
    const res = await getAchievements();
    const stored = supabase.tables.user_achievements.reduce((sum, r) => sum + r.points, 0);
    expect(res.result.points).toBe(stored);
    expect(res.result.level.title).toBeTruthy();
  });
});

describe('seen state', () => {
  test('new badges start unseen and stay that way until marked', async () => {
    await refreshAchievements();
    const unseen = await getUnseen();
    expect(unseen.success).toBe(true);
    expect(unseen.rows.length).toBe(supabase.tables.user_achievements.length);

    const marked = await markSeen(unseen.rows);
    expect(marked).toMatchObject({ success: true, count: unseen.rows.length });
    expect(supabase.tables.user_achievements.every((r) => r.seen_at)).toBe(true);

    const after = await getUnseen();
    expect(after.rows).toEqual([]);
  });

  test('marking nothing is a no-op', async () => {
    await expect(markSeen([])).resolves.toEqual({ success: true, count: 0 });
    await expect(markSeen()).resolves.toEqual({ success: true, count: 0 });
  });

  test('ids are accepted as well as rows', async () => {
    await refreshAchievements();
    const [row] = supabase.tables.user_achievements;
    const res = await markSeen([row.id]);
    expect(res.count).toBe(1);
    expect(supabase.tables.user_achievements.find((r) => r.id === row.id).seen_at).toBeTruthy();
  });
});

describe('the feature flag', () => {
  test('refresh is a no-op while the catalog flag is off', async () => {
    jest.resetModules();
    jest.doMock('../lib/achievements/catalog', () => ({
      ...jest.requireActual('../lib/achievements/catalog'),
      ACHIEVEMENTS_ENABLED: false,
    }));
    const flagged = require('../lib/achievements');

    const res = await flagged.refreshAchievements();
    expect(res).toMatchObject({ success: true, newlyEarned: [] });
    expect(supabase.tables.user_achievements).toEqual([]);

    jest.dontMock('../lib/achievements/catalog');
    jest.resetModules();
  });
});
