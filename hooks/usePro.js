// hooks/usePro.js — the Pro tier as screens see it (launch plan §4.5 item 3).
//
//   const { isPro, remaining, presentPaywall } = usePro();
//
// `remaining(task)` is null for Pro (unlimited) and a countdown otherwise, which
// is exactly what meterHint() in lib/pro.js expects.
import { useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';
import { ProContext } from '../components/ProProvider';

export function usePro() {
  const context = useContext(ProContext);
  const router = useRouter();

  /** Open the paywall. `source` tailors its headline to the gate they hit. */
  // Memoised because callers put these in useCallback dependency arrays; a fresh
  // identity every render would rebuild their handlers on every render too.
  const presentPaywall = useCallback(
    (source) => router.push({ pathname: '/paywall', params: source ? { source } : undefined }),
    [router]
  );

  /**
   * Gate a metered action: returns true to proceed, or opens the paywall and
   * returns false. Call it BEFORE any work the user would resent losing — before
   * the camera opens, not after they have framed a label.
   *
   * This is a courtesy, not the enforcement. The chat edge function decides again.
   */
  const gate = useCallback(
    (task) => {
      if (context.isPro) return true;
      const left = context.remaining(task);
      if (left === null || left === undefined || left > 0) return true;
      presentPaywall(task);
      return false;
    },
    [context, presentPaywall]
  );

  return { ...context, presentPaywall, gate };
}

export default usePro;
