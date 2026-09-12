import { act, create } from 'react-test-renderer';
import { Platform, Text } from 'react-native';
import StableMarker from '../components/StableMarker';
import MapScreen from '../app/(tabs)/map';

// The map's pins used to be Google's default teardrops on Android (pinColor
// snaps to a fixed hue wheel, so the theme colors came out neon). These tests
// hold the two platforms to the same custom marker view, and hold the Android
// snapshot window that makes that view actually paint.
//
// Platform.OS is a getter on the real module, so swap in a plain mutable object.
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'ios', select: (specifics) => specifics.ios ?? specifics.default },
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', Polygon: 'Polygon' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) }));
jest.mock('../components/ManualWineryEntryModal', () => () => null);
jest.mock('../components/PinActionModal', () => () => null);
jest.mock('../components/WineryNameModal', () => () => null);
jest.mock('../hooks/usePro', () => ({ usePro: () => ({ isPro: false, presentPaywall: jest.fn() }) }));
jest.mock('../lib/wineries', () => ({ wineriesService: {
  getUserWineries: async () => ({ success: true, wineries: [
    { id: 1, name: 'Paradise Springs', latitude: 38.8, longitude: -77.4, hasVisit: true },
  ] }),
  findOrCreateWinery: jest.fn(),
} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: {
  getInBounds: async () => ({ success: true, wineries: [] }),
  searchByName: jest.fn(),
} }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {} }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  Platform.OS = 'ios';
});

test('an Android marker re-snapshots long enough to paint, then freezes', async () => {
  Platform.OS = 'android';
  let tree;
  await act(async () => {
    tree = create(<StableMarker coordinate={{ latitude: 1, longitude: 2 }}><Text>Estate</Text></StableMarker>);
  });
  const marker = () => tree.root.findByType('Marker');
  // Without this window the bitmap is taken before layout and before the icon
  // font has loaded, and the pin lands on the map blank.
  expect(marker().props.tracksViewChanges).toBe(true);
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(marker().props.tracksViewChanges).toBe(false);
  // Centered like iOS; Android would otherwise hang the view above the point.
  expect(marker().props.anchor).toEqual({ x: 0.5, y: 0.5 });
  await act(async () => tree.unmount());
});

test('an iOS marker only redraws when its content changed', async () => {
  const markerWith = (props) => (
    <StableMarker {...props} coordinate={{ latitude: 1, longitude: 2 }}><Text>Estate</Text></StableMarker>
  );
  let tree;
  await act(async () => { tree = create(markerWith({})); });
  expect(tree.root.findByType('Marker').props.tracksViewChanges).toBe(false);
  // The zoom-threshold label flip is the one content change a frozen marker
  // would otherwise miss.
  await act(async () => { tree.update(markerWith({ pulse: true })); });
  expect(tree.root.findByType('Marker').props.tracksViewChanges).toBe(true);
  await act(async () => tree.unmount());
});

test.each(['ios', 'android'])('%s pins are the themed marker view, never a default teardrop', async (os) => {
  Platform.OS = os;
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  // Markers commit on the frame after the pins render.
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  const pin = tree.root.findAllByType('Marker').find((node) => node.props.children);
  expect(pin).toBeDefined();
  // pinColor is Google's default teardrop, whose hue wheel mangles the theme.
  expect(pin.props.pinColor).toBeUndefined();
  // The visited badge keeps its sage token on both platforms.
  expect(JSON.stringify(tree.toJSON())).toContain('#55745E');
  await act(async () => tree.unmount());
});
