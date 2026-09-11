// The primary write path of the app, run for real: a tasting with photos goes
// through photo uploads (object storage, not transactional), winery
// find-or-create, and then ONE create_visit_with_wines RPC. Every branch that
// used to lose data silently (#128 dropped photos, ghost visits, offline
// winery resolution) is pinned here.
import { visitsService } from '../lib/visits';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
jest.mock('expo-file-system', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

const USER = { id: 'user-a', email: 'a@example.com' };
const LOCAL = 'file:///tmp/label.jpg';
const LOCAL_2 = 'file:///tmp/glass.jpg';
const REMOTE = 'https://fake.supabase.co/storage/v1/object/public/wine-photos/wine_user-a_old.jpg';

// The RPC as the migration defines it: one visit row, one wine row per entry,
// returns the new id plus how many custom flavor notes could not be linked.
function createVisitRpc({ p_visit, p_wines }) {
  const visit = { id: 500 + supabase.tables.visits.length, user_id: USER.id, ...p_visit };
  supabase.tables.visits.push(visit);
  for (const wine of p_wines) supabase.tables.wines.push({ id: 900 + supabase.tables.wines.length, visit_id: visit.id, ...wine });
  return { visit_id: visit.id, notes_failed: 0 };
}

beforeEach(() => {
  supabase.reset({
    user: USER,
    tables: { visits: [], wines: [], wineries: [] },
    rpc: { create_visit_with_wines: createVisitRpc },
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' });
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
  FileSystem.readAsStringAsync.mockResolvedValue('aGVsbG8='); // "hello"
});
afterEach(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

const tasting = (overrides = {}) => ({
  date: '2026-09-11',
  placeType: 'winery',
  wineryId: 7,
  placeName: 'Barboursville',
  latitude: 38.17,
  longitude: -78.28,
  notes: 'sunny afternoon',
  wineryPhotos: [LOCAL],
  wines: [
    {
      name: '',
      varietal: ['Viognier'],
      type: 'white',
      year: 2023,
      overallRating: 4,
      ratings: { sweetness: 1, tannins: 0, acidity: 3, body: 2 },
      additionalNotes: 'peach',
      photos: [LOCAL_2, REMOTE],
      flavorNotes: ['peach', 'honeysuckle'],
    },
  ],
  ...overrides,
});

describe('createVisit', () => {
  test('uploads each photo to its bucket, then saves visit and wines in one RPC', async () => {
    const res = await visitsService.createVisit(tasting());
    expect(res.success).toBe(true);
    expect(res.photosFailed).toBe(0);

    // Photos: the winery photo lands in visit-photos, the wine photo in wine-photos,
    // both under a per-user prefix, as JPEG bytes decoded from base64, never upserting.
    const uploads = supabase.calls.filter((c) => c.op === 'upload');
    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toEqual(expect.objectContaining({ table: 'storage:visit-photos', size: 5, options: { contentType: 'image/jpeg', upsert: false } }));
    expect(uploads[0].path).toMatch(/^visit_user-a_\d+_[a-z0-9]+_0\.jpg$/);
    expect(uploads[1].table).toBe('storage:wine-photos');
    expect(uploads[1].path).toMatch(/^wine_user-a_\d+_[a-z0-9]+_0\.jpg$/);
    // The already-remote photo was passed through, not re-uploaded.
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);

    // One transactional write carrying everything.
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.p_visit).toEqual({
      winery_id: 7,
      place_type: 'winery',
      place_name: 'Barboursville',
      latitude: 38.17,
      longitude: -78.28,
      visit_date: '2026-09-11',
      notes: 'sunny afternoon',
      photo_url: JSON.stringify([`https://fake.supabase.co/storage/v1/object/public/visit-photos/${uploads[0].path}`]),
    });
    expect(args.p_wines).toHaveLength(1);
    const wine = args.p_wines[0];
    expect(wine).toEqual(expect.objectContaining({
      wine_name: 'Viognier', // no name typed: the varietal names the wine
      wine_type: 'white',
      wine_varietal: ['Viognier'],
      wine_year: 2023,
      overall_rating: 4,
      sweetness: 1, tannin: 0, acidity: 3, body: 2, alcohol: 0,
      additional_notes: 'peach',
      flavor_notes: ['peach', 'honeysuckle'],
    }));
    // The wine keeps its old remote photo and gains the new upload, in order.
    expect(JSON.parse(wine.photo_url)).toEqual([
      `https://fake.supabase.co/storage/v1/object/public/wine-photos/${uploads[1].path}`,
      REMOTE,
    ]);
    // The winery id was given, so no winery lookup happened.
    expect(supabase.callsTo('wineries')).toHaveLength(0);
    // The caller gets the full row back.
    expect(res.visit).toEqual(expect.objectContaining({ id: 500, notes: 'sunny afternoon' }));
  });

  test('a photo whose local file is missing or empty is counted as failed, and the save still lands', async () => {
    FileSystem.getInfoAsync
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 0 });
    const res = await visitsService.createVisit(tasting({ wineryPhotos: [LOCAL], wines: [{ name: 'X', photos: [LOCAL_2] }] }));
    expect(res.success).toBe(true);
    expect(res.photosFailed).toBe(2);
    expect(supabase.calls.filter((c) => c.op === 'upload')).toHaveLength(0);
    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.p_visit.photo_url).toBe('[]');
    expect(args.p_wines[0].photo_url).toBe('[]');
  });

  test('a storage upload error drops just that photo and reports it', async () => {
    supabase.storage.from('visit-photos'); // create the bucket so the mock exists
    supabase.storage.from('visit-photos').upload.mockResolvedValueOnce({ data: null, error: { message: 'quota' } });
    const res = await visitsService.createVisit(tasting({ wines: [] }));
    expect(res.success).toBe(true);
    expect(res.photosFailed).toBe(1);
    expect(supabase.rpc.mock.calls[0][1].p_visit.photo_url).toBe('[]');
  });

  test('a typed winery name is found-or-created once, owned by the user, and reused case-insensitively', async () => {
    const first = await visitsService.createVisit(tasting({ wineryId: null, placeName: 'Early Mountain', wineryPhotos: [], wines: [] }));
    expect(first.success).toBe(true);
    expect(supabase.tables.wineries).toHaveLength(1);
    const [winery] = supabase.tables.wineries;
    expect(winery).toEqual(expect.objectContaining({ name: 'Early Mountain', user_id: USER.id, latitude: 38.17, longitude: -78.28 }));
    expect(supabase.rpc.mock.calls[0][1].p_visit.winery_id).toBe(winery.id);

    const second = await visitsService.createVisit(tasting({ wineryId: null, placeName: 'early mountain', wineryPhotos: [], wines: [] }));
    expect(second.success).toBe(true);
    expect(supabase.tables.wineries).toHaveLength(1);
    expect(supabase.rpc.mock.calls[1][1].p_visit.winery_id).toBe(winery.id);
  });

  test('when the winery cannot be resolved the log is saved without a place rather than lost', async () => {
    supabase.respond('wineries', () => ({ data: null, error: { message: 'network request failed' } }));
    const res = await visitsService.createVisit(tasting({ wineryId: null, placeName: 'Somewhere', wineryPhotos: [], wines: [] }));
    expect(res.success).toBe(true);
    const { p_visit } = supabase.rpc.mock.calls[0][1];
    expect(p_visit.winery_id).toBeNull();
    // The typed name and coordinates survive on the visit row itself.
    expect(p_visit).toEqual(expect.objectContaining({ place_type: 'winery', place_name: 'Somewhere', latitude: 38.17 }));
  });

  test('a non-winery place never touches the wineries table', async () => {
    const res = await visitsService.createVisit(tasting({ wineryId: null, placeType: 'restaurant', placeName: 'The Inn', wineryPhotos: [], wines: [] }));
    expect(res.success).toBe(true);
    expect(supabase.callsTo('wineries')).toHaveLength(0);
    expect(supabase.rpc.mock.calls[0][1].p_visit).toEqual(expect.objectContaining({ winery_id: null, place_type: 'restaurant' }));
  });

  test('an RPC failure is the caller\'s failure: no visit, no read-back', async () => {
    supabase.onRpc('create_visit_with_wines', () => ({ data: null, error: { message: 'connection reset' } }));
    const res = await visitsService.createVisit(tasting({ wineryPhotos: [], wines: [] }));
    expect(res).toEqual({ success: false, error: 'connection reset' });
    expect(supabase.tables.visits).toHaveLength(0);
    expect(supabase.callsTo('visits')).toHaveLength(0);
  });

  test('a failed read-back after a committed write still reports success with the new id', async () => {
    supabase.respond('visits', () => ({ data: null, error: { message: 'timeout' } }));
    const res = await visitsService.createVisit(tasting({ wineryPhotos: [], wines: [] }));
    expect(res).toEqual({ success: true, visit: { id: 500 }, photosFailed: 0, notesFailed: 0 });
  });

  test('a wine with nothing but a rating is still a valid row', async () => {
    const res = await visitsService.createVisit(tasting({ wineryPhotos: [], wines: [{ overallRating: 3.5 }] }));
    expect(res.success).toBe(true);
    expect(supabase.rpc.mock.calls[0][1].p_wines[0]).toEqual({
      winemaker: null, wine_name: 'Wine', wine_type: null, wine_varietal: [], wine_year: null,
      overall_rating: 3.5, sweetness: 0, tannin: 0, acidity: 0, body: 0, alcohol: 0,
      additional_notes: null, photo_url: '[]', flavor_notes: [],
    });
  });

  test('without a session nothing is uploaded or written', async () => {
    supabase.setUser(null);
    const res = await visitsService.createVisit(tasting());
    expect(res).toEqual({ success: false, error: 'User not authenticated' });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('deletePhotos', () => {
  test('removes each object by its last path segment, so it only works for flat visit and wine photo names', async () => {
    // Cellar photos live under a `cellar/` folder in the same bucket; this
    // helper would strip that folder. It is only ever called with visit and
    // wine photos today, which are flat, and this pins that contract.
    await visitsService.deletePhotos([REMOTE, 'https://x/wine-photos/cellar/abc.jpg'], 'wine-photos');
    const removes = supabase.calls.filter((c) => c.op === 'remove');
    expect(removes.map((r) => r.paths)).toEqual([['wine_user-a_old.jpg'], ['abc.jpg']]);
  });
});
