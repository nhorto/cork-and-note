// components/ProProvider.js — one place that knows whether this user is Pro and
// how much of the free tier they have left, so no screen has to work it out.
//
// The `isPro` published here is for RENDERING ONLY: which hint to show, whether
// to open the paywall. Every paid AI call is re-decided by the chat edge function
// against public.entitlements, so being wrong here costs a wrong label, never a
// free Claude call.
//
// It reads two sources and ORs them, because each is right when the other is not:
//   - RevenueCat's CustomerInfo flips the instant a purchase completes and works
//     offline, but is cold on a fresh install until a restore.
//   - public.entitlements is the server's truth, but lags by one webhook.
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FREE_MONTHLY_LIMITS,
  onMeterUpdate,
  remainingFree,
} from '../lib/pro';
import {
  addProStatusListener,
  configurePurchases,
  fetchProStatus,
  forgetPurchaser,
  identifyPurchaser,
  purchasesAvailable,
  restorePurchases,
} from '../lib/purchases';
import { supabase } from '../lib/supabase';

const EMPTY_USAGE = { label_scan: 0, chat: 0 };

export const ProContext = createContext({
  isPro: false,
  isLoading: true,
  purchasesAvailable: false,
  usage: EMPTY_USAGE,
  remaining: () => null,
  refresh: async () => {},
  restore: async () => ({ isPro: false, error: null }),
  onPurchased: async () => {},
});

/** First instant of the current calendar month, UTC — matches the server's window. */
function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// After a purchase RevenueCat says Pro immediately but our webhook has not landed
// yet, so the very next AI call could still be refused. Re-read the server a few
// times with backoff to close that window instead of polling forever.
const ENTITLEMENT_SETTLE_DELAYS_MS = [1_000, 3_000, 6_000];

export function ProProvider({ userId, children }) {
  const [storeIsPro, setStoreIsPro] = useState(false);
  const [serverIsPro, setServerIsPro] = useState(false);
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [isLoading, setIsLoading] = useState(true);
  const available = purchasesAvailable();

  // Guards every async write against a user who signed out mid-flight.
  const currentUser = useRef(userId);
  currentUser.current = userId;

  const readServerEntitlement = useCallback(async (uid) => {
    if (!uid) return false;
    const { data, error } = await supabase
      .from('entitlements')
      .select('is_pro, expires_at')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data?.is_pro) return false;
    // Re-check the expiry for the same reason the server does: the only thing
    // that clears is_pro is a webhook, and webhooks get missed.
    if (!data.expires_at) return true;
    const expiresMs = Date.parse(data.expires_at);
    return Number.isFinite(expiresMs) && expiresMs > Date.now();
  }, []);

  const readUsage = useCallback(async (uid) => {
    if (!uid) return EMPTY_USAGE;
    const since = monthStartIso();
    const counts = await Promise.all(
      Object.keys(FREE_MONTHLY_LIMITS).map(async (task) => {
        const { count, error } = await supabase
          .from('chat_usage')
          .select('id', { count: 'exact', head: true })
          .eq('task', task)
          .gte('created_at', since);
        // An unreadable counter must not invent headroom: assume the worst, and
        // let the server have the final say when the call is actually made.
        return [task, error ? FREE_MONTHLY_LIMITS[task] : count ?? 0];
      })
    );
    return Object.fromEntries(counts);
  }, []);

  const refresh = useCallback(async () => {
    const uid = currentUser.current;
    if (!uid) {
      setStoreIsPro(false);
      setServerIsPro(false);
      setUsage(EMPTY_USAGE);
      setIsLoading(false);
      return;
    }
    const [store, server, used] = await Promise.all([
      fetchProStatus(),
      readServerEntitlement(uid),
      readUsage(uid),
    ]);
    if (currentUser.current !== uid) return;
    setStoreIsPro(store.isPro);
    setServerIsPro(server);
    setUsage(used);
    setIsLoading(false);
  }, [readServerEntitlement, readUsage]);

  // Configure once, then follow the signed-in user. Identifying by the Supabase
  // user id is what lets the webhook write an entitlements row for them; logging
  // out is what stops the previous account's Pro following the next person to
  // sign in on this device.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await configurePurchases();
      if (cancelled) return;

      if (userId) {
        await identifyPurchaser(userId);
      } else {
        await forgetPurchaser();
      }
      if (cancelled) return;
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  // Purchases, renewals and expiries that happen while the app is open.
  useEffect(() => {
    if (!userId) return undefined;
    return addProStatusListener(({ isPro }) => setStoreIsPro(isPro));
  }, [userId]);

  // Every AI response reports the meter it spent (lib/ai.js publishes it), so
  // hints stay right without a query after each call.
  useEffect(
    () =>
      onMeterUpdate((meter) => {
        if (typeof meter.used !== 'number') return;
        setUsage((prev) =>
          prev[meter.task] === meter.used ? prev : { ...prev, [meter.task]: meter.used }
        );
      }),
    []
  );

  const isPro = storeIsPro || serverIsPro;

  const remaining = useCallback(
    (task) => (isPro ? null : remainingFree(task, usage[task])),
    [isPro, usage]
  );

  /** Called by the paywall after a successful purchase or restore. */
  const onPurchased = useCallback(async () => {
    setStoreIsPro(true);
    const uid = currentUser.current;
    for (const delay of ENTITLEMENT_SETTLE_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (currentUser.current !== uid) return;
      if (await readServerEntitlement(uid)) {
        setServerIsPro(true);
        return;
      }
    }
  }, [readServerEntitlement]);

  const restore = useCallback(async () => {
    const result = await restorePurchases();
    if (result.isPro) {
      setStoreIsPro(true);
      onPurchased();
    }
    return result;
  }, [onPurchased]);

  const value = useMemo(
    () => ({
      isPro,
      isLoading,
      purchasesAvailable: available,
      usage,
      remaining,
      refresh,
      restore,
      onPurchased,
    }),
    [isPro, isLoading, available, usage, remaining, refresh, restore, onPurchased]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}
