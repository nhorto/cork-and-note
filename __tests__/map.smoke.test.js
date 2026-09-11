import { act, create } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import { wineriesService } from '../lib/wineries';
import MapScreen from '../app/(tabs)/map';
const mockPush = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('../components/ManualWineryEntryModal', () => () => null);
jest.mock('../components/PinActionModal', () => () => null);
jest.mock('../components/WineryNameModal', () => () => null);
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../lib/wineries', () => ({ wineriesService: {
  getUserWineries: async () => ({ success: true, wineries: [] }),
  findOrCreateWinery: jest.fn(),
} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: { getInBounds: jest.fn(), searchByName: jest.fn() } }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {} }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: true, wineries: [] });
});
afterEach(() => jest.useRealTimers());

test('a free profile can discover and open a winery without GPS or a paywall', async () => {
  const presentPaywall = jest.fn();
  usePro.mockReturnValue({ isPro: false, presentPaywall });
  const winery = { id: 7, name: 'Test Estate', latitude: 37.4, longitude: -78.6 };
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: true, wineries: [winery] });
  wineryDirectoryService.searchByName.mockResolvedValue({ success: true, wineries: [winery] });
  wineriesService.findOrCreateWinery.mockResolvedValue({ success: true, winery: { ...winery, id: 99 } });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  // Map markers commit on the frame after the directory response renders.
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  expect(tree.root.findAllByType('Marker')).toHaveLength(1);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Show nearby pins' }).props.onPress());
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Dismiss map help' }).props.onPress();
  });
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Welcome')).toBe(false);
  const search = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === 'Search wineries & your places'));
  await act(async () => search.props.onPress());
  expect(tree.root.findByType(TextInput).props.placeholder).toBe('Search 14,000+ US wineries');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Test'));
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(wineryDirectoryService.searchByName).toHaveBeenCalledWith(expect.objectContaining({ query: 'Test' }));
  const result = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === winery.name));
  await act(async () => result.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/winery/99', params: { directoryId: '7' } });
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test.each([false, true])('directory loading uses map bounds without GPS (isPro: %s)', async (isPro) => {
  usePro.mockReturnValue({ isPro, presentPaywall: jest.fn() });
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: false, error: 'Offline' });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(wineryDirectoryService.getInBounds).toHaveBeenCalledWith(expect.objectContaining({ north: expect.any(Number), west: expect.any(Number) }));
  expect(JSON.stringify(tree.toJSON())).toContain('Couldn’t load wineries. Tap to retry.');
  await act(async () => tree.unmount());
});
