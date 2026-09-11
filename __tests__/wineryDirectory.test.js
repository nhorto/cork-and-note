// Distance math for the Near You row (lib/geo.js, used by lib/wineryDirectory.js).
import { haversineKm } from '../lib/geo';
import { supabase } from '../lib/supabase';
import { wineryDirectoryService } from '../lib/wineryDirectory';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('free directory websites', () => {
  let query;
  beforeEach(() => {
    query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { website: 'https://example.com' } }),
    };
    supabase.from.mockReturnValue(query);
  });

  test('uses the directory record on a discovered winery page', async () => {
    expect(await wineryDirectoryService.getWebsite({ directoryId: 7 })).toBe('https://example.com/');
    expect(supabase.from).toHaveBeenCalledWith('winery_directory');
    expect(query.eq).toHaveBeenCalledWith('id', 7);
  });

  test('can find a saved winery again without its discovery route parameter', async () => {
    expect(await wineryDirectoryService.getWebsite({ name: 'Test Estate', latitude: 38, longitude: -78 })).toBe('https://example.com/');
    expect(query.eq.mock.calls).toEqual([['name', 'Test Estate'], ['latitude', 38], ['longitude', -78]]);
  });

  test('does not guess a website from a name without coordinates', async () => {
    expect(await wineryDirectoryService.getWebsite({ name: 'Test Estate' })).toBeNull();
    expect(query.maybeSingle).not.toHaveBeenCalled();
  });

  test.each(['javascript:alert(1)', 'file:///private/data', 'https://user:password@example.com', 'not a URL'])('rejects unsafe or invalid directory links: %s', async (website) => {
    query.maybeSingle.mockResolvedValue({ data: { website } });
    expect(await wineryDirectoryService.getWebsite({ directoryId: 7 })).toBeNull();
  });

  test('missing directory data leaves the journal page usable', async () => {
    query.maybeSingle.mockResolvedValue({ error: { message: 'Offline' } });
    expect(await wineryDirectoryService.getWebsite({ directoryId: 7 })).toBeNull();
  });
});

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(38.9, -77.9, 38.9, -77.9)).toBe(0);
  });

  it('matches a known distance: DC to Richmond ≈ 155 km', () => {
    const km = haversineKm(38.9072, -77.0369, 37.5407, -77.436);
    expect(km).toBeGreaterThan(145);
    expect(km).toBeLessThan(165);
  });

  it('is symmetric', () => {
    const a = haversineKm(38.9, -77.9, 37.5, -77.4);
    const b = haversineKm(37.5, -77.4, 38.9, -77.9);
    expect(a).toBeCloseTo(b, 10);
  });
});

// Near You (getNearby) searches widening boxes so a dense valley returns the
// wineries next door, not an arbitrary capped subset of a 40 km box.
describe('getNearby', () => {
  // A thenable query builder: the last chained call resolves to `result`.
  const builder = (result) => {
    const q = {};
    for (const m of ['select', 'gte', 'lte', 'or', 'limit']) q[m] = jest.fn(() => q);
    q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return q;
  };
  const row = (id, latitude, longitude) => ({ id, name: `W${id}`, latitude, longitude, city: 'X', state: 'CA' });
  beforeEach(() => supabase.from.mockReset());

  test('stops at the first box that fills the list and returns nearest first', async () => {
    const near = [row(1, 38.51, -122.47), row(2, 38.50, -122.48), row(3, 38.52, -122.46)];
    supabase.from.mockReturnValueOnce(builder({ data: near }));
    const res = await wineryDirectoryService.getNearby({ latitude: 38.5052, longitude: -122.47, limitCount: 3 });
    expect(res.success).toBe(true);
    expect(res.wineries.map((w) => w.id)).toEqual([1, 2, 3]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(res.wineries[0].distanceKm).toBeLessThan(1);
  });

  test('widens the box when a sparse area has too few wineries nearby', async () => {
    supabase.from
      .mockReturnValueOnce(builder({ data: [] }))
      .mockReturnValueOnce(builder({ data: [row(9, 38.6, -122.4)] }))
      .mockReturnValueOnce(builder({ data: [row(9, 38.6, -122.4), row(8, 38.8, -122.9)] }));
    const res = await wineryDirectoryService.getNearby({ latitude: 38.5, longitude: -122.5, limitCount: 6 });
    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(res.wineries.map((w) => w.id)).toEqual([9, 8]);
  });

  test('surfaces a query error', async () => {
    supabase.from.mockReturnValueOnce(builder({ error: { message: 'Offline' } }));
    expect(await wineryDirectoryService.getNearby({ latitude: 38.5, longitude: -122.5 })).toEqual({ success: false, error: 'Offline' });
  });
});
