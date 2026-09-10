import { act, create } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import MapScreen from '../app/(tabs)/map';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('../components/ManualWineryEntryModal', () => () => null);
jest.mock('../components/PinActionModal', () => () => null);
jest.mock('../components/WineryNameModal', () => () => null);
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../lib/wineries', () => ({ wineriesService: { getUserWineries: async () => ({ success: true, wineries: [] }) } }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: { getInBounds: jest.fn() } }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {} }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());

test('a new free profile can dismiss welcome and open search without GPS', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Winery discovery is included with Pro');
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Dismiss map help' }).props.onPress();
  });
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Welcome')).toBe(false);
  const search = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === 'Search wineries & your places'));
  await act(async () => search.props.onPress());
  expect(tree.root.findByType(TextInput).props.placeholder).toBe("Search wineries you've visited");
  await act(async () => tree.unmount());
});

test('Pro directory loading uses the map bounds even when GPS is denied', async () => {
  usePro.mockReturnValue({ isPro: true, presentPaywall: jest.fn() });
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: false, error: 'Offline' });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(wineryDirectoryService.getInBounds).toHaveBeenCalledWith(expect.objectContaining({ north: expect.any(Number), west: expect.any(Number) }));
  expect(JSON.stringify(tree.toJSON())).toContain('Couldn’t load wineries. Tap to retry.');
  await act(async () => tree.unmount());
});
