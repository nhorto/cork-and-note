jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn().mockResolvedValue() }));
let mockSystemScheme = 'light';
jest.mock('../hooks/useColorScheme', () => ({ useColorScheme: () => mockSystemScheme }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { memo, useState } from 'react';
import { act, create } from 'react-test-renderer';
import { Text, TextInput, View } from 'react-native';
import { AppThemeProvider, createThemedStyles, THEME_STORAGE_KEY, useAppearance } from '../styles/ThemeProvider';
import { darkTheme, lightTheme } from '../styles/theme';
import { drinkWindowMeta } from '../lib/cellar';

// The metadata helper shares a file with the data service; these tests never
// connect to a backend or require auth credentials.
jest.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));

let current;
const useStyles = createThemedStyles(({ colors }) => ({ backgroundColor: colors.neutral.bg }));
const Draft = memo(function Draft() {
  const styles = useStyles();
  const [value, setValue] = useState('Unsaved tasting');
  return <View testID="draft" style={styles}><TextInput value={value} onChangeText={setValue} /></View>;
});
function Probe() {
  current = useAppearance();
  return <><Text>{current.theme.mode}</Text><Draft /></>;
}
const app = () => <AppThemeProvider><Probe /></AppThemeProvider>;

beforeEach(() => { jest.clearAllMocks(); AsyncStorage.clear(); mockSystemScheme = 'light'; });

test('loads saved Dark before ready and changes memoized screens without losing a draft', async () => {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
  let tree;
  await act(async () => { tree = create(app()); });
  expect(current.ready).toBe(true);
  expect(current.preference).toBe('dark');
  expect(current.theme).toBe(darkTheme);
  expect(tree.root.findByProps({ testID: 'draft' }).props.style.backgroundColor).toBe('#191321');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Keep my notes'));
  await act(async () => { await current.setPreference('light'); });
  expect(tree.root.findByType(TextInput).props.value).toBe('Keep my notes');
  expect(tree.root.findByProps({ testID: 'draft' }).props.style.backgroundColor).toBe('#FAF8F4');
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  await act(async () => tree.unmount());
});

test('System follows device changes and manual Light ignores device Dark', async () => {
  let tree;
  await act(async () => { tree = create(app()); });
  expect(current.preference).toBe('system');
  mockSystemScheme = 'dark';
  await act(async () => tree.update(app()));
  expect(current.theme).toBe(darkTheme);
  await act(async () => { await current.setPreference('light'); });
  expect(current.theme).toBe(lightTheme);
  await act(async () => { await current.setPreference('system'); });
  expect(current.theme).toBe(darkTheme);
  mockSystemScheme = 'light';
  await act(async () => tree.update(app()));
  expect(current.theme).toBe(lightTheme);
  await act(async () => tree.unmount());
});

test('invalid stored values and storage failures do not prevent startup', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce('orange');
  let tree;
  await act(async () => { tree = create(app()); });
  expect(current.preference).toBe('system');
  expect(current.ready).toBe(true);
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await act(async () => { await expect(current.setPreference('dark')).rejects.toThrow('disk unavailable'); });
  expect(current.theme).toBe(darkTheme);
  await act(async () => { await current.setPreference('light'); });
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  await act(async () => tree.unmount());
  AsyncStorage.getItem.mockRejectedValueOnce(new Error('unavailable'));
  await act(async () => { tree = create(app()); });
  expect(current.ready).toBe(true);
  expect(current.preference).toBe('system');
  await act(async () => tree.unmount());
});

test('rapid choices persist in order and survive remount', async () => {
  let tree;
  await act(async () => { tree = create(app()); });
  await act(async () => { await Promise.all([current.setPreference('dark'), current.setPreference('light'), current.setPreference('system')]); });
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  await act(async () => tree.unmount());
  mockSystemScheme = 'dark';
  await act(async () => { tree = create(app()); });
  expect(current.preference).toBe('system');
  expect(current.theme).toBe(darkTheme);
  await act(async () => tree.unmount());
});

function luminance(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
test.each([lightTheme, darkTheme])('$mode text, actions, Journey and status badges retain readable contrast', ({ colors }) => {
  for (const surface of [colors.neutral.bg, colors.neutral.surface]) {
    for (const text of [colors.neutral.ink, colors.neutral.inkSecondary, colors.neutral.inkTertiary, colors.primary.ink, colors.accent.ink]) {
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast(colors.onPrimary, colors.primary.base)).toBeGreaterThanOrEqual(4.5);
  for (const text of [colors.journey.ink, colors.journey.secondary, colors.journey.accent]) {
    expect(contrast(text, colors.journey.bg)).toBeGreaterThanOrEqual(4.5);
  }
  for (const status of ['ready', 'drink_up', 'too_young', 'past_peak', null]) {
    expect(contrast(colors.onStatus, drinkWindowMeta(status, colors).color)).toBeGreaterThanOrEqual(4.5);
  }
});
