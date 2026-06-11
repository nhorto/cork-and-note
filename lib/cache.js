// lib/cache.js — a tiny TTL + in-flight-dedup cache that sits at the data-access
// boundary (the lib/*Service.getX() read functions).
//
// WHY THIS EXISTS (#83): every read in the app funnels through lib/, and several
// screens (Home, Cellar, Profile, Wine/Bottle detail) use `useFocusEffect`, so
// they re-issue the SAME Supabase queries on every tab switch. Wrapping the read
// functions here means one change reaches the whole app without touching any
// screen — fresh reads return instantly from memory, and two screens asking for
// the same data at once share a single in-flight request.
//
// SCALING: this holds a FIXED set of keys (see CACHE_KEYS) — it does NOT grow
// with the user's data. Each key stores one result set, which the screens
// already held in component state, so memory is flat-to-lower. Invalidation is
// explicit and lives next to the ~12 mutation functions in lib/.
//
// CORRECTNESS ACROSS USERS: the whole cache is cleared on any auth change
// (sign-out / sign-in / user switch) via onAuthStateChange below, so it can
// never serve one account's data to another.
import { supabase } from './supabase';

// Stable key names — import these instead of passing raw strings so a typo is a
// reference error, not a silent cache miss.
export const CACHE_KEYS = {
  visits: 'visits',
  visitStats: 'visitStats',
  cellar: 'cellar',
  cellarStats: 'cellarStats',
  consumptions: 'consumptions',
  wishlist: 'wishlist',
};
// NOTE: wineriesService.getUserWineries() is deliberately NOT cached. It's
// derived from visits + wishlist (so it would need a fragile three-source
// invalidation) and the only screen reading it (Explore/map) fetches once on
// mount and then mutates local pin state — it never re-queries on tab focus, so
// it isn't part of the re-query-on-every-switch problem this cache targets.

const DEFAULT_TTL_MS = 5 * 60_000; // 5 min. Writes invalidate their own key(s)
// eagerly (see invalidate() + the mutation functions in lib/), so the TTL is NOT
// the mechanism that keeps data fresh after a user action — it's only a safety
// net for data changed WITHOUT this app's knowledge (another device, a backend
// seed). That's rare for a single-user app, so a long window is safe and makes
// tab-switching essentially free for a whole browsing session.

const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise (request de-duplication)

function log(kind, key) {
  if (__DEV__) console.log(`[cache] ${kind} ${key}`);
}

/**
 * Return a cached value if fresh, otherwise run `fn`, cache its result, and
 * return it. Concurrent calls for the same key share one in-flight promise.
 *
 * NOTE: the result is cached regardless of shape. Our services resolve to
 * `{ success: true, ... }` even on handled failure, so a failed read can cache
 * a `{ success: false }` for the TTL — acceptable here (the next read after TTL
 * retries, and screens already handle the failure shape). We only skip caching
 * if `fn` THROWS, so transient errors aren't pinned.
 *
 * @param {string} key      one of CACHE_KEYS
 * @param {() => Promise<any>} fn  the real fetch
 * @param {number} [ttlMs]
 */
export async function cached(key, fn, ttlMs = DEFAULT_TTL_MS) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    log('HIT', key);
    return hit.value;
  }

  const pending = inflight.get(key);
  if (pending) {
    log('DEDUP', key);
    return pending;
  }

  log('MISS', key);
  const promise = (async () => {
    const value = await fn();
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  })();
  inflight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    // Don't pin a thrown error — let the next call retry.
    store.delete(key);
    throw err;
  } finally {
    inflight.delete(key);
  }
}

/** Drop one or more cache keys so the next read re-fetches live data. */
export function invalidate(...keys) {
  for (const key of keys) {
    store.delete(key);
    if (__DEV__) log('INVALIDATE', key);
  }
}

/** Wipe everything (used on auth change). */
export function clearAll() {
  store.clear();
  inflight.clear();
  if (__DEV__) log('CLEAR', 'all');
}

// Never serve a previous account's data after a sign-out / sign-in / user
// switch. Registered once at module load.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    clearAll();
  }
});
