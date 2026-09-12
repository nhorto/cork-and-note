// "Visited" means you were there (#294). A bottle opened at home creates a
// visit row that carries the producer's winery_id so the tasting keeps its
// link, but place_type stays null. Every query that answers "have I been to
// this winery?" has to say no to that row.
import { supabase } from '../lib/supabase';
import { wineriesService } from '../lib/wineries';
import { wineryStatusService } from '../lib/wineryStatus';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const USER = { id: 'user-a', email: 'a@example.com' };

const visited = { id: 'v1', user_id: USER.id, winery_id: 7, place_type: 'winery', visit_date: '2026-09-01' };
const openedAtHome = { id: 'v2', user_id: USER.id, winery_id: 7, place_type: null, visit_date: '2026-09-10' };

beforeEach(() => {
  supabase.reset({ user: USER, tables: { visits: [], wineries: [], wishlist: [] } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('wineryStatusService.hasVisited', () => {
  test('a bottle opened at home does not make a winery visited', async () => {
    supabase.tables.visits.push(openedAtHome);
    expect(await wineryStatusService.hasVisited(7)).toMatchObject({ visited: false, visitCount: 0 });
  });

  test('a real visit still counts, and is counted once', async () => {
    supabase.tables.visits.push(visited, openedAtHome);
    expect(await wineryStatusService.hasVisited(7)).toMatchObject({ visited: true, visitCount: 1 });
  });
});

describe('the visit queries behind the map and the Places list', () => {
  const placeTypeFilter = (table) =>
    supabase
      .callsTo(table)
      .flatMap((call) => call.filters)
      .filter((f) => f.column === 'place_type');

  test('getUserWineries only marks a pin visited from a place_type winery row', async () => {
    // .not() has no in-memory evaluator, so the rows come from a responder and
    // the assertion is on what the service asked the database for.
    supabase.reset({
      user: USER,
      tables: { wineries: [{ id: 7, name: 'Barboursville', user_id: USER.id }] },
      responders: { visits: () => ({ data: [], error: null }), wishlist: () => ({ data: [], error: null }) },
    });
    const res = await wineriesService.getUserWineries();
    expect(res.success).toBe(true);
    expect(res.wineries[0].hasVisit).toBe(false);
    expect(placeTypeFilter('visits')).toContainEqual({ op: 'eq', column: 'place_type', value: 'winery' });
  });

  test('getVisitedWineries asks for winery visits only', async () => {
    supabase.reset({
      user: USER,
      responders: { visits: () => ({ data: [], error: null }) },
    });
    const res = await wineriesService.getVisitedWineries();
    expect(res.success).toBe(true);
    expect(placeTypeFilter('visits')).toContainEqual({ op: 'eq', column: 'place_type', value: 'winery' });
  });
});
