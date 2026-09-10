import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from '../hooks/useColorScheme';
import { lightTheme, themes } from './theme';

export const THEME_STORAGE_KEY = 'cork-and-note:appearance';
export const APPEARANCE_OPTIONS = ['system', 'light', 'dark'];
export const resolveThemeMode = (preference, systemScheme) =>
  preference === 'light' || preference === 'dark'
    ? preference
    : systemScheme === 'dark' ? 'dark' : 'light';

const ThemeContext = createContext({
  theme: lightTheme, preference: 'system', ready: false,
  setPreference: async () => {},
});

export function AppThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setStoredPreference] = useState('system');
  const [ready, setReady] = useState(false);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (active && revision.current === initialRevision && APPEARANCE_OPTIONS.includes(saved)) {
        setStoredPreference(saved);
      }
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setPreference = useCallback((next) => {
    if (!APPEARANCE_OPTIONS.includes(next)) return Promise.reject(new Error('Invalid appearance preference'));
    revision.current += 1;
    setStoredPreference(next);
    // Keep rapid selections in order on disk. A failed write must not block
    // the next one; callers can explain that this selection is session-only.
    const write = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(THEME_STORAGE_KEY, next));
    writes.current = write;
    return write;
  }, []);

  const mode = resolveThemeMode(preference, systemScheme);
  const theme = themes[mode];
  useEffect(() => {
    if (!ready) return;
    // Native alerts, keyboards and sheets should match a manual selection too.
    // Clear the override for System so subsequent OS changes remain observable.
    if (Platform.OS !== 'web') Appearance.setColorScheme(preference === 'system' ? null : preference);
    SystemUI.setBackgroundColorAsync(theme.colors.neutral.bg).catch(() => {});
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = mode;
      document.documentElement.style.backgroundColor = theme.colors.neutral.bg;
      document.body.style.backgroundColor = theme.colors.neutral.bg;
    }
  }, [preference, mode, theme, ready]);

  const value = useMemo(() => ({ theme, preference, ready, setPreference }), [theme, preference, ready, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext).theme; }
export function useAppearance() { return useContext(ThemeContext); }

// Each module has one factory and one cached style set per immutable theme.
// Context subscriptions update mounted and memoized consumers without remounting
// the navigator, discarding an in-progress form, or mutating global colors.
/**
 * @template T
 * @param {(theme: typeof lightTheme) => T} factory
 * @returns {() => T}
 */
export function createThemedStyles(factory) {
  const cache = new WeakMap();
  return function useScreenTheme() {
    const theme = useTheme();
    if (!cache.has(theme)) cache.set(theme, factory(theme));
    return cache.get(theme);
  };
}
