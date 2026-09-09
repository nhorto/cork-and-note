// hooks/usePro.js — the Pro tier as screens see it (launch plan §4.5 item 3).
//
//   const { isPro, remaining, presentPaywall } = usePro();
//
// `remaining(task)` is null for Pro (unlimited) and a countdown otherwise, which
// is exactly what meterHint() in lib/pro.js expects.
import { useContext } from 'react';
import { useRouter } from 'expo-router';
import { ProContext } from '../components/ProProvider';

export function usePro() {
  const context = useContext(ProContext);
  const router = useRouter();

  return {
    ...context,
    /** Open the paywall. Safe to call from any screen. */
    presentPaywall: (source) =>
      router.push({ pathname: '/paywall', params: source ? { source } : undefined }),
  };
}

export default usePro;
