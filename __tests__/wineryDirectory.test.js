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
