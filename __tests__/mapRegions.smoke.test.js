// The "Wine regions" map layer (Pro): paywall for free users, polygons for Pro
// at a readable zoom, a hint below it, and a named sheet on tap.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { wineryDirectoryService } from '../lib/wineryDirectory';
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
  getUserWineries: async () => ({ success: true, wineries: [] }),
  findOrCreateWinery: jest.fn(),
} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: { getInBounds: jest.fn(), searchByName: jest.fn() } }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {} }));

// Two synthetic regions around the map's default Virginia view: a big one and
// a small one nested inside it, so a tap can land in both.
jest.mock('../lib/avaRegions', () => {
  const actual = jest.requireActual('../lib/avaRegions');
  const ring = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
  const fixture = [
    {
      id: 'outer', name: 'Outer Valley', aka: null, states: ['VA'], created: '1984-01-23',
      within: [], contains: ['Inner Hollow'], cfr: '9.1', bbox: [-80, 36.5, -77, 38.5],
      geometry: { type: 'Polygon', coordinates: [ring(-80, 36.5, -77, 38.5)] },
    },
    {
      id: 'inner', name: 'Inner Hollow', aka: null, states: ['VA'], created: '1990-06-01',
      within: ['Outer Valley'], contains: [], cfr: '9.2', bbox: [-79, 37, -78, 38],
      geometry: { type: 'Polygon', coordinates: [ring(-79, 37, -78, 38)] },
    },
  ];
  return {
    ...actual,
    loadRegions: () => fixture,
    regionsMeta: () => ({ count: fixture.length, license: 'CC0-1.0' }),
    regionsInBounds: (bounds) => actual.regionsInBounds(bounds, fixture),
    regionsAtPoint: (lat, lng, candidates) => actual.regionsAtPoint(lat, lng, candidates ?? fixture),
  };
});

const LAYER_KEY = 'map.layers.wineRegions';

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  wineryDirectoryService.getInBounds.mockResolvedValue({ success: true, wineries: [] });
});
afterEach(() => jest.useRealTimers());

async function mount() {
  let tree;
  await act(async () => { tree = create(<MapScreen />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(500); });
  await act(async () => { await jest.advanceTimersByTimeAsync(50); });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((node) =>
  Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));
// Polygons are identified by their first vertex: outer starts at -80, inner at -79.
const polygon = (tree, id) => tree.root.findAllByType('Polygon')
  .find((p) => p.props.coordinates[0].longitude === (id === 'outer' ? -80 : -79));
const rowWithText = (tree, label) => tree.root.findAllByType(TouchableOpacity)
  .filter((node) => node.findAllByType(Text).some((t) => t.props.children === label))
  .at(-1); // innermost match: sheet overlays are TouchableOpacity too
const mapView = (tree) => tree.root.findByType('MapView');

test('a free user who flips the layer on lands on the paywall and sees no polygons', async () => {
  const presentPaywall = jest.fn();
  usePro.mockReturnValue({ isPro: false, presentPaywall });
  const tree = await mount();

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Map layers' }).props.onPress());
  const toggle = tree.root.findByProps({ accessibilityLabel: 'Show wine regions' });
  expect(toggle.props.value).toBe(false);
  expect(texts(tree)).toContain('PRO');
  await act(async () => toggle.props.onValueChange(true));

  expect(presentPaywall).toHaveBeenCalledWith('wine_regions');
  expect(tree.root.findAllByType('Polygon')).toHaveLength(0);
  expect(await AsyncStorage.getItem(LAYER_KEY)).toBeNull();
  await act(async () => tree.unmount());
});

test('a Pro user with the layer on sees polygons at zoom 6+, a hint below it, and a named sheet on tap', async () => {
  usePro.mockReturnValue({ isPro: true, presentPaywall: jest.fn() });
  await AsyncStorage.setItem(LAYER_KEY, '1');
  const tree = await mount();

  // Default Virginia view is longitudeDelta 5, zoom ~6.2: both regions render.
  expect(tree.root.findAllByType('Polygon')).toHaveLength(2);
  expect(polygon(tree, 'outer').props.coordinates[0]).toEqual({ latitude: 36.5, longitude: -80 });
  expect(polygon(tree, 'outer').props.strokeWidth).toBe(1.5);
  expect(polygon(tree, 'inner')).toBeDefined();
  expect(texts(tree)).not.toContain('Zoom in to see wine regions');

  // Tapping where only the outer region lies selects it straight away.
  await act(async () => polygon(tree, 'outer').props.onPress({ nativeEvent: { coordinate: { latitude: 36.7, longitude: -79.8 } } }));
  const after = texts(tree);
  expect(after).toContain('WINE REGION · AVA');
  expect(after).toContain('Outer Valley');
  expect(after).toContain('Virginia · established 1984');
  expect(after).toContain('Contains: Inner Hollow');
  expect(polygon(tree, 'outer').props.strokeWidth).toBe(2.5);
  expect(polygon(tree, 'inner').props.strokeWidth).toBe(1.5);

  // "Plan a day here" hands the region's centre and radius to the planner.
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Plan a day in Outer Valley' }).props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/trips/new',
    params: expect.objectContaining({ areaLabel: 'Outer Valley', areaLat: '37.5', areaLng: '-78.5' }),
  });

  // Zooming out past the threshold drops every polygon and shows the hint.
  await act(async () => mapView(tree).props.onRegionChangeComplete({
    latitude: 37.4, longitude: -78.6, latitudeDelta: 20, longitudeDelta: 20,
  }));
  expect(tree.root.findAllByType('Polygon')).toHaveLength(0);
  expect(texts(tree)).toContain('Zoom in to see wine regions');
  await act(async () => tree.unmount());
});

test('a tap inside nested regions offers a chooser', async () => {
  usePro.mockReturnValue({ isPro: true, presentPaywall: jest.fn() });
  await AsyncStorage.setItem(LAYER_KEY, '1');
  const tree = await mount();

  await act(async () => polygon(tree, 'inner').props.onPress({ nativeEvent: { coordinate: { latitude: 37.5, longitude: -78.5 } } }));
  expect(texts(tree)).toContain('Which wine region?');
  expect(texts(tree)).not.toContain('WINE REGION · AVA');

  await act(async () => rowWithText(tree, 'Inner Hollow').props.onPress());
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(texts(tree)).toContain('WINE REGION · AVA');
  expect(texts(tree)).toContain('Inside: Outer Valley');
  await act(async () => tree.unmount());
});

test('the layer switch persists for Pro and turning it off clears the selection', async () => {
  usePro.mockReturnValue({ isPro: true, presentPaywall: jest.fn() });
  const tree = await mount();
  expect(tree.root.findAllByType('Polygon')).toHaveLength(0);

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Map layers' }).props.onPress());
  expect(texts(tree)).toContain('US American Viticultural Areas, 2 boundaries');
  expect(texts(tree)).not.toContain('PRO');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Show wine regions' }).props.onValueChange(true));
  expect(await AsyncStorage.getItem(LAYER_KEY)).toBe('1');
  expect(tree.root.findAllByType('Polygon')).toHaveLength(2);

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Show wine regions' }).props.onValueChange(false));
  expect(await AsyncStorage.getItem(LAYER_KEY)).toBe('0');
  expect(tree.root.findAllByType('Polygon')).toHaveLength(0);
  await act(async () => tree.unmount());
});
