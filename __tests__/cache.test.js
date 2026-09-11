// lib/cache.js sits in front of every read in the app and promises two things
// its header spells out: a read that started before a mutation never writes a
// stale result back, and one account's data is never served to another. Both
// are timing bugs, so both are exercised with reads that are still in flight
// when the invalidation lands.
import { CACHE_KEYS, cached, clearAll, invalidate } from '../lib/cache';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

/** A fetch the test resolves by hand, to control exactly when a read completes. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  clearAll();
});
afterEach(() => console.log.mockRestore());

test('a fresh value is served from memory and concurrent readers share one fetch', async () => {
  const fetch = jest.fn(async () => ({ success: true, rows: [1] }));
  const [a, b] = await Promise.all([cached(CACHE_KEYS.visits, fetch), cached(CACHE_KEYS.visits, fetch)]);
  expect(a).toBe(b);
  expect(fetch).toHaveBeenCalledTimes(1);
  await cached(CACHE_KEYS.visits, fetch);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a handled failure is returned but never pinned, so the next read retries', async () => {
  const fetch = jest.fn()
    .mockResolvedValueOnce({ success: false, error: 'offline' })
    .mockResolvedValueOnce({ success: true, rows: [] });
  expect(await cached(CACHE_KEYS.cellar, fetch)).toEqual({ success: false, error: 'offline' });
  expect(await cached(CACHE_KEYS.cellar, fetch)).toEqual({ success: true, rows: [] });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('a thrown error is not pinned either', async () => {
  const fetch = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ success: true });
  await expect(cached(CACHE_KEYS.wishlist, fetch)).rejects.toThrow('boom');
  expect(await cached(CACHE_KEYS.wishlist, fetch)).toEqual({ success: true });
});

test('the value expires after its TTL', async () => {
  jest.useFakeTimers();
  const fetch = jest.fn(async () => ({ success: true }));
  await cached(CACHE_KEYS.consumptions, fetch, 1000);
  jest.advanceTimersByTime(1001);
  await cached(CACHE_KEYS.consumptions, fetch, 1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.useRealTimers();
});

test('a read in flight when its key is invalidated does not write the stale result back', async () => {
  const slow = deferred();
  const first = cached(CACHE_KEYS.cellar, () => slow.promise);
  invalidate(CACHE_KEYS.cellar); // the mutation lands while the read is still out
  slow.resolve({ success: true, rows: ['stale'] });
  expect(await first).toEqual({ success: true, rows: ['stale'] }); // the caller still gets its answer

  const fresh = jest.fn(async () => ({ success: true, rows: ['fresh'] }));
  expect(await cached(CACHE_KEYS.cellar, fresh)).toEqual({ success: true, rows: ['fresh'] });
  expect(fresh).toHaveBeenCalledTimes(1);
});

test("a read in flight across a sign-out never serves the previous account's data", async () => {
  const slow = deferred();
  const asUserA = cached(CACHE_KEYS.visits, () => slow.promise);

  // User A signs out, user B signs in, both before A's read returns.
  supabase.emitAuth('SIGNED_OUT', null);
  supabase.emitAuth('SIGNED_IN', { user: { id: 'user-b' }, access_token: 't' });
  slow.resolve({ success: true, rows: ['A private tastings'] });
  await asUserA;

  const asUserB = jest.fn(async () => ({ success: true, rows: ['B tastings'] }));
  expect(await cached(CACHE_KEYS.visits, asUserB)).toEqual({ success: true, rows: ['B tastings'] });
  expect(asUserB).toHaveBeenCalledTimes(1);
});
