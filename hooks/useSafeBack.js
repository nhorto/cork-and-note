// hooks/useSafeBack.js: a back handler that cannot strand the user.
//
// The guided Pro tools can be opened with nothing behind them: a deep link,
// the screenshot tooling's router.replace, or a cold start onto a saved
// route. In that state router.back() throws "GO_BACK was not handled by any
// navigator" and the header chevron does nothing. This falls back to a known
// tab instead.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useSafeBack(fallback = '/(tabs)/sommelier') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
