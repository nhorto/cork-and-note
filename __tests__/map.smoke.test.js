import { act, create } from 'react-test-renderer';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', Polygon: 'Polygon' }));
jest.mock('../components/ManualWineryEntryModal', () => () => null);
jest.mock('../components/PinActionModal', () => () => null);
jest.mock('../components/WineryNameModal', () => () => null);
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../lib/wineries', () => ({ wineriesService: {
  getUserWineries: jest.fn(async () => ({ success: true, wineries: [] })),
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
  // Browsing opens a PREVIEW (#270); nothing is saved until the user acts.
  expect(mockPush).toHaveBeenCalledWith('/winery/dir-7');
  expect(wineriesService.findOrCreateWinery).not.toHaveBeenCalled();
  expect(presentPaywall).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('an individual directory winery uses the purple marker treatment', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  wineryDirectoryService.getInBounds.mockResolvedValue({
    success: true,
    wineries: [{ id: 7, name: 'Purple Estate', latitude: 37.4, longitude: -78.6 }],
  });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  const marker = tree.root.findByType('Marker');
  const circle = marker.findAllByType(View).find(
    (node) => StyleSheet.flatten(node.props.style)?.width === 32
  );
  expect(StyleSheet.flatten(circle.props.style)).toEqual(
    expect.objectContaining({ backgroundColor: '#54258A' })
  );
  await act(async () => tree.unmount());
});

test('street-level markers render at their collision-free display coordinates', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  const latitude = 37.4316;
  const longitude = -78.6569;
  wineryDirectoryService.getInBounds.mockResolvedValue({
    success: true,
    wineries: [
      { id: 7, name: 'Suite Seven', latitude, longitude },
      { id: 8, name: 'Suite Eight', latitude, longitude },
    ],
    truncated: false,
  });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(550); });
  const map = tree.root.findByType('MapView');
  await act(async () => map.props.onRegionChangeComplete({
    latitude,
    longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  }));
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  const coordinates = tree.root.findAllByType('Marker').map((marker) => marker.props.coordinate);
  expect(coordinates).toHaveLength(2);
  expect(new Set(coordinates.map((point) => `${point.latitude},${point.longitude}`)).size).toBe(2);
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

// #277: a viewport that stays inside a fully-loaded box needs no new fetch and
// never flips a loading state; the spinner only appears for a slow fetch.
test('panning inside a fully covered box does not refetch or show the spinner', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  const MapView = require('react-native-maps').default;
  let resolveFetch;
  wineryDirectoryService.getInBounds.mockImplementation(
    () => new Promise((resolve) => { resolveFetch = resolve; })
  );
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(360); });
  expect(wineryDirectoryService.getInBounds).toHaveBeenCalledTimes(1);
  // Still loading after the grace period: the search pill shows a spinner and
  // the old text pill is gone.
  await act(async () => { await jest.advanceTimersByTimeAsync(450); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Loading wineries' }).length).toBeGreaterThan(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Loading wineries…');
  await act(async () => { resolveFetch({ success: true, wineries: [], truncated: false }); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Loading wineries' })).toHaveLength(0);

  // Zoom in on the same spot: inside the loaded box, so no second query.
  const map = tree.root.findByType(MapView);
  await act(async () => map.props.onRegionChangeComplete({
    latitude: 37.4316, longitude: -78.6569, latitudeDelta: 1, longitudeDelta: 1,
  }));
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(wineryDirectoryService.getInBounds).toHaveBeenCalledTimes(1);

  // Pan far away: outside the box, so it fetches again.
  await act(async () => map.props.onRegionChangeComplete({
    latitude: 38.5, longitude: -122.4, latitudeDelta: 0.5, longitudeDelta: 0.5,
  }));
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(wineryDirectoryService.getInBounds).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});

// #269: the places sheet is keyboard-aware and its title follows the tab.
test('the places sheet avoids the keyboard, dismisses it on drag, and titles the Find tab', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  const { FlatList, KeyboardAvoidingView } = require('react-native');
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  const search = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === 'Search wineries & your places'));
  await act(async () => search.props.onPress());
  expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
  const list = tree.root.findByType(FlatList);
  expect(list.props.keyboardDismissMode).toBe('on-drag');
  expect(list.props.keyboardShouldPersistTaps).toBe('handled');
  expect(tree.root.findByType(TextInput).props.onSubmitEditing).toBeDefined();
  const titles = () => tree.root.findAllByType(Text).map((t) => t.props.children);
  expect(titles()).toContain('Find a winery');
  // The segment reads "Visited (n)"; the filter chip above the map is plain "Visited".
  const visitedTab = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => Array.isArray(text.props.children) && text.props.children[0] === 'Visited ('));
  await act(async () => visitedTab.props.onPress());
  expect(titles()).toContain('Your places');
  await act(async () => tree.unmount());
});

// #270: a directory pin you already have (linked by directory_id) is hidden
// from the discovery layer, and tapping its match in Find opens YOUR page.
test('a directory winery you already saved opens your own page, and its pin is not duplicated', async () => {
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
  const mine = { id: 42, name: 'Test Estate', latitude: 37.4, longitude: -78.6, directory_id: 7, hasVisit: true, inWishlist: false };
  wineriesService.getUserWineries.mockResolvedValueOnce({ success: true, wineries: [mine] });
  const row = { id: 7, name: 'Test Estate', latitude: 37.9, longitude: -78.1 }; // far from the pin, so only the link hides it
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: true, wineries: [row] });
  wineryDirectoryService.searchByName.mockResolvedValue({ success: true, wineries: [row] });
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  expect(tree.root.findAllByType('Marker')).toHaveLength(1); // your pin only
  const search = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === 'Search wineries & your places'));
  await act(async () => search.props.onPress());
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Test'));
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  const result = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((text) => text.props.children === row.name));
  await act(async () => result.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/winery/42');
  await act(async () => tree.unmount());
});
