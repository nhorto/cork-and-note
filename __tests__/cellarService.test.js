// The cellar data layer, run for real against an in-memory Supabase: what each
// write sends, what it refuses, and what it leaves behind.
//
// Until now lib/cellar.js was only tested through its pure drink-window
// helpers; every write path (add, open, adjust, link, delete) and the cache
// that sits in front of the reads had never executed under a test.
import { cellarService, KEEP_BOTTLE_REASON } from '../lib/cellar';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const USER = { id: 'user-a', email: 'a@example.com' };
const OTHER = { id: 'user-b', email: 'b@example.com' };

const lot = (overrides = {}) => ({
  id: 1,
  user_id: USER.id,
  winery_id: 7,
  wineries: { id: 7, name: 'Barboursville' },
  producer: 'Barboursville',
  wine_name: 'Octagon',
  vintage: 2019,
  wine_type: 'red',
  varietal: ['Merlot'],
  quantity: 3,
  status: 'in_cellar',
  drink_from: 2024,
  drink_by: 2032,
  ...overrides,
});

// The open_bottle RPC as the migration defines it: decrement unless the reason
// keeps the bottle, retire the lot at zero, return the bare row.
function openBottleRpc(args) {
  const row = supabase.tables.cellar_bottles.find((b) => b.id === args.p_bottle_id);
  if (!row) return { data: null, error: { message: 'lot not found' } };
  if (args.p_reason !== KEEP_BOTTLE_REASON) row.quantity -= args.p_quantity;
  if (row.quantity <= 0) row.status = 'consumed';
  supabase.tables.cellar_consumptions.push({ bottle_id: args.p_bottle_id, quantity: args.p_quantity, reason: args.p_reason, note: args.p_note, wine_id: args.p_wine_id });
  return { data: [{ ...row }], error: null };
}

beforeEach(() => {
  supabase.reset({
    user: USER,
    tables: { cellar_bottles: [lot()], cellar_consumptions: [], visits: [], wines: [], flavor_notes: [] },
    rpc: { open_bottle: openBottleRpc },
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {}); // lib/cache narrates every hit and miss
  // Signing in clears lib/cache between tests, the same way a real session change does.
  supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' });
});
afterEach(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

describe('openBottle', () => {
  test('draws the lot down through the transactional RPC and returns the fresh row', async () => {
    const res = await cellarService.openBottle(1, { quantity: 2, reason: 'consumed', note: '  lovely  ' });
    expect(res.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('open_bottle', expect.objectContaining({
      p_bottle_id: 1, p_quantity: 2, p_reason: 'consumed', p_note: 'lovely', p_wine_id: null,
    }));
    expect(res.bottle.quantity).toBe(1);
    expect(res.bottle.wineries.name).toBe('Barboursville');
    expect(res.keptBottle).toBe(false);
    expect(supabase.tables.cellar_consumptions).toHaveLength(1);
    // No tasting was requested, so nothing landed in the journal.
    expect(supabase.tables.visits).toHaveLength(0);
  });

  test('refuses to open more than the lot holds, before touching the database', async () => {
    const res = await cellarService.openBottle(1, { quantity: 4 });
    expect(res).toEqual({ success: false, error: 'Only 3 left in this lot' });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.tables.cellar_bottles[0].quantity).toBe(3);
  });

  test('a kept-bottle tasting never decrements and always records exactly one pour', async () => {
    const res = await cellarService.openBottle(1, { quantity: 5, reason: KEEP_BOTTLE_REASON });
    expect(res.success).toBe(true);
    expect(res.keptBottle).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('open_bottle', expect.objectContaining({ p_quantity: 1, p_reason: KEEP_BOTTLE_REASON }));
    expect(supabase.tables.cellar_bottles[0].quantity).toBe(3);
  });

  test('a kept-bottle tasting on an empty lot is refused', async () => {
    supabase.tables.cellar_bottles[0].quantity = 0;
    const res = await cellarService.openBottle(1, { reason: KEEP_BOTTLE_REASON });
    expect(res).toEqual({ success: false, error: 'No bottles left to taste from this lot' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('logging a tasting creates a location-optional visit and a wine from the bottle, linked to the pour', async () => {
    const res = await cellarService.openBottle(1, { logTasting: true, rating: 4.5, note: 'silky', tastingDate: '2026-09-11' });
    expect(res.success).toBe(true);

    // The session keeps the producer link, but a bottle opened at home is NOT a
    // visit to that winery, so place_type stays null (#294).
    const [visit] = supabase.tables.visits;
    expect(visit).toEqual(expect.objectContaining({
      user_id: USER.id, winery_id: 7, place_type: null, visit_date: '2026-09-11', notes: 'silky',
    }));
    const [wine] = supabase.tables.wines;
    expect(wine).toEqual(expect.objectContaining({
      visit_id: visit.id, wine_name: 'Octagon', wine_type: 'red', wine_year: 2019, overall_rating: 4.5,
    }));
    expect(wine.winemaker).toBe('Barboursville');
    expect(res.visitId).toBe(visit.id);
    expect(res.wineId).toBe(wine.id);
    expect(supabase.rpc).toHaveBeenCalledWith('open_bottle', expect.objectContaining({ p_wine_id: wine.id, p_consumed_date: '2026-09-11' }));
  });

  test('a bottle-less lot logs the tasting with no place at all', async () => {
    supabase.tables.cellar_bottles[0].winery_id = null;
    supabase.tables.cellar_bottles[0].wineries = null;
    const res = await cellarService.openBottle(1, { logTasting: true });
    expect(res.success).toBe(true);
    expect(supabase.tables.visits[0]).toEqual(expect.objectContaining({ winery_id: null, place_type: null }));
  });

  test('another user cannot open this lot', async () => {
    supabase.setUser(OTHER);
    const res = await cellarService.openBottle(1, { quantity: 1 });
    expect(res.success).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.tables.cellar_bottles[0].quantity).toBe(3);
  });

  test('an RPC failure is reported and nothing is re-read', async () => {
    supabase.onRpc('open_bottle', () => ({ data: null, error: { message: 'deadlock detected' } }));
    const res = await cellarService.openBottle(1, { quantity: 1 });
    expect(res).toEqual({ success: false, error: 'deadlock detected' });
    // One load before the RPC, no reload after it failed.
    expect(supabase.callsTo('cellar_bottles')).toHaveLength(1);
  });

  test('opening a bottle invalidates the cached cellar stats', async () => {
    const before = await cellarService.getCellarStats();
    expect(before.stats.totalBottles).toBe(3);
    await cellarService.getCellarStats();
    expect(supabase.callsTo('cellar_bottles')).toHaveLength(1); // second read served from cache

    await cellarService.openBottle(1, { quantity: 3 });
    const after = await cellarService.getCellarStats();
    expect(after.stats).toEqual(expect.objectContaining({ lots: 0, totalBottles: 0, readyToDrink: 0 }));
  });
});

describe('adjustQuantity', () => {
  test('rejects a non-numeric quantity without writing', async () => {
    const res = await cellarService.adjustQuantity(1, 'abc');
    expect(res).toEqual({ success: false, error: 'Enter a valid quantity' });
    expect(supabase.callsTo('cellar_bottles')).toHaveLength(0);
  });

  test('floors fractions and keeps the lot in the cellar', async () => {
    const res = await cellarService.adjustQuantity(1, 2.7);
    expect(res.success).toBe(true);
    expect(supabase.tables.cellar_bottles[0]).toEqual(expect.objectContaining({ quantity: 2, status: 'in_cellar' }));
  });

  test('adjusting to zero retires the lot, and adjusting back up revives it', async () => {
    await cellarService.adjustQuantity(1, 0);
    expect(supabase.tables.cellar_bottles[0]).toEqual(expect.objectContaining({ quantity: 0, status: 'consumed' }));
    await cellarService.adjustQuantity(1, -3);
    expect(supabase.tables.cellar_bottles[0].quantity).toBe(0);
    await cellarService.adjustQuantity(1, 2);
    expect(supabase.tables.cellar_bottles[0]).toEqual(expect.objectContaining({ quantity: 2, status: 'in_cellar' }));
  });

  test("another user's adjustment touches nothing", async () => {
    supabase.setUser(OTHER);
    const res = await cellarService.adjustQuantity(1, 0);
    expect(res.success).toBe(false);
    expect(supabase.tables.cellar_bottles[0].quantity).toBe(3);
  });
});

describe('addBottle / updateBottle / deleteBottle', () => {
  test('addBottle writes only the allowed columns and stamps the owner', async () => {
    const res = await cellarService.addBottle({
      wine_name: 'Viognier', vintage: 2023, quantity: 2, user_id: 'someone-else', id: 999, status: 'consumed', evil: true,
    });
    expect(res.success).toBe(true);
    const created = supabase.tables.cellar_bottles.find((b) => b.wine_name === 'Viognier');
    expect(created.user_id).toBe(USER.id);
    expect(created).not.toHaveProperty('evil');
    expect(created.id).not.toBe(999);
    expect(created.status).toBeUndefined(); // the database default applies, not the client's value
  });

  test('addBottle requires a wine name', async () => {
    const res = await cellarService.addBottle({ producer: 'Someone', quantity: 1 });
    expect(res).toEqual({ success: false, error: 'A wine name is required' });
    expect(supabase.tables.cellar_bottles).toHaveLength(1);
  });

  test('updateBottle strips fields the client may not write', async () => {
    const res = await cellarService.updateBottle(1, { wine_name: 'Octagon Reserve', user_id: OTHER.id, tasting_wine_id: 5 });
    expect(res.success).toBe(true);
    const [row] = supabase.tables.cellar_bottles;
    expect(row.wine_name).toBe('Octagon Reserve');
    expect(row.user_id).toBe(USER.id);
    expect(row.tasting_wine_id).toBeUndefined();
  });

  test('linkTasting is the only way to set the tasting link, and null clears it', async () => {
    await cellarService.linkTasting(1, 42);
    expect(supabase.tables.cellar_bottles[0].tasting_wine_id).toBe(42);
    await cellarService.linkTasting(1, null);
    expect(supabase.tables.cellar_bottles[0].tasting_wine_id).toBeNull();
  });

  test('deleteBottle is scoped to the owner', async () => {
    supabase.setUser(OTHER);
    await cellarService.deleteBottle(1);
    expect(supabase.tables.cellar_bottles).toHaveLength(1);
    supabase.setUser(USER);
    const res = await cellarService.deleteBottle(1);
    expect(res).toEqual({ success: true });
    expect(supabase.tables.cellar_bottles).toHaveLength(0);
  });

  test('every write refuses to run without a session', async () => {
    supabase.setUser(null);
    for (const call of [
      () => cellarService.addBottle({ wine_name: 'x' }),
      () => cellarService.updateBottle(1, { wine_name: 'x' }),
      () => cellarService.deleteBottle(1),
      () => cellarService.openBottle(1),
      () => cellarService.adjustQuantity(1, 1),
    ]) {
      expect(await call()).toEqual({ success: false, error: 'User not authenticated' });
    }
    expect(supabase.tables.cellar_bottles).toHaveLength(1);
  });
});

describe('getCellarStats', () => {
  test('counts lots per drink-window status and bottles in total, ignoring retired lots', async () => {
    const year = new Date().getFullYear();
    supabase.reset({
      user: USER,
      tables: {
        cellar_bottles: [
          lot({ id: 1, quantity: 2, drink_from: year - 2, drink_by: year + 5 }), // ready
          lot({ id: 2, quantity: 1, drink_from: year + 3, drink_by: year + 8 }), // too young
          lot({ id: 3, quantity: 4, drink_from: year - 8, drink_by: year - 1 }), // past peak
          lot({ id: 4, quantity: 1, drink_from: null, drink_by: null }), // unknown
          lot({ id: 5, quantity: 6, status: 'consumed' }), // retired, not counted
        ],
      },
    });
    supabase.emitAuth('SIGNED_IN', { user: USER, access_token: 't' });
    const res = await cellarService.getCellarStats();
    expect(res.success).toBe(true);
    expect(res.stats.lots).toBe(4);
    expect(res.stats.totalBottles).toBe(8);
    expect(res.stats.byStatus).toEqual(expect.objectContaining({ ready: 1, too_young: 1, past_peak: 1, unknown: 1 }));
    expect(res.stats.readyToDrink).toBe(res.stats.byStatus.ready + res.stats.byStatus.drink_up);
  });

  test('a database error is not cached: the next call retries', async () => {
    supabase.respond('cellar_bottles', () => ({ data: null, error: { message: 'timeout' } }));
    expect(await cellarService.getCellarStats()).toEqual({ success: false, error: 'timeout' });
    supabase.respond('cellar_bottles', undefined);
    const res = await cellarService.getCellarStats();
    expect(res.success).toBe(true);
    expect(res.stats.totalBottles).toBe(3);
  });
});
