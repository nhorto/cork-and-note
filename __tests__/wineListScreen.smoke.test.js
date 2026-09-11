// Smoke test for the wine-list tool screen: a free user gets the labelled
// sample with one upgrade button, a Pro user lands on the capture step, and a
// saved list stays readable without Pro.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { usePro } from '../hooks/usePro';
import { wineListService } from '../lib/wineList';
import WineListScreen from '../app/sommelier/wine-list';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, setParams: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
// The real lib/wineList is kept for its pure helpers; its two I/O imports are
// stubbed so requiring it never touches the Supabase client or the AI plumbing.
jest.mock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn(), functions: {} } }));
jest.mock('../lib/ai', () => ({ aiService: { sendMessage: jest.fn(), photoToBase64: jest.fn(), parseFencedJson: jest.fn(), _tastingLines: jest.fn() } }));
jest.mock('../lib/wineList', () => {
  const actual = jest.requireActual('../lib/wineList');
  return {
    ...actual,
    wineListService: {
      scan: jest.fn(),
      pick: jest.fn(),
      save: jest.fn(),
      list: jest.fn().mockResolvedValue({ success: true, sessions: [] }),
      get: jest.fn(),
      remove: jest.fn(),
    },
  };
});

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

describe('WineListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wineListService.list.mockResolvedValue({ success: true, sessions: [] });
  });

  it('shows a free user the sample and one upgrade button, with no capture controls', async () => {
    const presentPaywall = jest.fn();
    usePro.mockReturnValue({ isPro: false, isLoading: false, presentPaywall, gate: () => false, remaining: () => 0 });
    let tree;
    await act(async () => {
      tree = create(<WineListScreen />);
    });
    await flush();

    const all = texts(tree);
    expect(all).toContain('SAMPLE');
    expect(all).toContain('Closest to your favorites'.toUpperCase());
    expect(all.some((t) => t.includes('Hollow Oak Cellars'))).toBe(true);
    expect(all).not.toContain('Take photo');

    const upgrade = tree.root.findByProps({ accessibilityLabel: 'Unlock with Pro. Opens Cork and Note Pro.' });
    act(() => upgrade.props.onPress());
    expect(presentPaywall).toHaveBeenCalledWith('wine_list_pick');
    await act(async () => tree.unmount());
  });

  it('shows a Pro user the capture step with the read button disabled until a photo exists', async () => {
    usePro.mockReturnValue({ isPro: true, isLoading: false, presentPaywall: jest.fn(), gate: () => true, remaining: () => null });
    let tree;
    await act(async () => {
      tree = create(<WineListScreen />);
    });
    await flush();

    const all = texts(tree);
    expect(all).toContain('Take photo');
    expect(all).toContain('Choose from library');
    expect(all).not.toContain('SAMPLE');
    expect(tree.root.findByProps({ accessibilityLabel: 'Step 1, Capture' }).props.accessibilityState.selected).toBe(true);
    // The Button wrapper and its host touchable share the label; the state
    // lives on the host.
    const read = tree.root
      .findAllByProps({ accessibilityLabel: 'Read the list' })
      .find((n) => n.props.accessibilityState !== undefined);
    expect(read.props.accessibilityState.disabled).toBe(true);
    expect(wineListService.list).toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('lets a free user open a list they saved before Pro expired', async () => {
    usePro.mockReturnValue({ isPro: false, isLoading: false, presentPaywall: jest.fn(), gate: () => false, remaining: () => 0 });
    wineListService.list.mockResolvedValue({
      success: true,
      sessions: [
        {
          id: 's1',
          title: 'Hollow Oak Cabernet Franc 2021',
          created_at: '2026-09-01T00:00:00Z',
          currency: 'USD',
          entries: [{ entry_id: 'e1', wine_name: 'Cabernet Franc', producer: 'Hollow Oak', vintage: 2021, price_minor: 1400, currency: 'USD', serving: 'glass' }],
          preferences: { budgetMinor: 2000, serving: 'glass', meal: 'chicken', useRatings: true },
          picks: [{ entry_id: 'e1', label: 'best_overall', reason: 'At $14 a glass.', evidence: [] }],
        },
      ],
    });
    let tree;
    await act(async () => {
      tree = create(<WineListScreen />);
    });
    await flush();

    const row = tree.root.findByProps({ accessibilityLabel: 'Open saved list Hollow Oak Cabernet Franc 2021' });
    await act(async () => row.props.onPress());
    const all = texts(tree);
    expect(all).toContain('Your saved picks');
    expect(all).toContain('At $14 a glass.');
    expect(all).toContain('Saved');

    act(() => tree.root.findByProps({ accessibilityLabel: 'Log Hollow Oak Cabernet Franc 2021' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/log-session',
      params: { mode: 'wine', prefill: JSON.stringify({ winemaker: 'Hollow Oak', name: 'Cabernet Franc', year: '2021' }) },
    });

    act(() => tree.root.findByProps({ accessibilityLabel: 'Ask about these' }).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/sommelier',
      params: { ask: expect.stringContaining('Hollow Oak Cabernet Franc 2021 ($14)') },
    });
    await act(async () => tree.unmount());
  });
});
