// Smoke test for app/trips/new.js: a free user sees the labelled sample and
// one upgrade button (no paid work happens), and a Pro user gets the form,
// centred on the area a region sheet passed in.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { usePro } from '../hooks/usePro';
import { tripsService } from '../lib/trips';
import NewTripScreen from '../app/trips/new';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
const mockPush = jest.fn();
let mockParams = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  geocodeAsync: jest.fn(async () => []),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../lib/places', () => ({ placesService: {} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: { getInBounds: jest.fn() } }));
jest.mock('../lib/trips', () => ({
  ...jest.requireActual('../lib/tripSchedule'),
  isProRequired: (r) => r?.code === 'pro_required',
  loadCandidates: jest.fn(),
  routesService: { legs: jest.fn() },
  tripsService: { list: jest.fn(), save: jest.fn(), update: jest.fn() },
}));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  tripsService.list.mockResolvedValue({ success: true, plans: [] });
});

test('a free user sees a fictional sample day and an upgrade button, with no saved-plan fetch', async () => {
  const presentPaywall = jest.fn();
  usePro.mockReturnValue({ isPro: false, isLoading: false, presentPaywall });
  let tree;
  await act(async () => {
    tree = create(<NewTripScreen />);
  });
  await flush();
  const all = texts(tree);
  expect(all).toContain('SAMPLE');
  expect(all.some((t) => t.includes('Stone Ridge Vineyards'))).toBe(true);
  expect(all.some((t) => t.startsWith('Drive 28 min'))).toBe(true);
  expect(all).toContain('Lunch');
  expect(all).toContain('Arrange a designated driver or other transportation if you are tasting.');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Unlock with Pro. Opens Cork and Note Pro.' }).props.onPress());
  expect(presentPaywall).toHaveBeenCalledWith('trip_plan');
  expect(tripsService.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('a Pro user gets the form, centred on the area passed from a region sheet', async () => {
  usePro.mockReturnValue({ isPro: true, isLoading: false, presentPaywall: jest.fn() });
  mockParams = { areaLabel: 'Loudoun County', areaLat: '39.1', areaLng: '-77.6', areaRadiusKm: '30' };
  tripsService.list.mockResolvedValue({
    success: true,
    plans: [{ id: 'p1', title: 'A day around Middleburg', trip_date: '2026-09-19', stops: [{}, {}] }],
  });
  let tree;
  await act(async () => {
    tree = create(<NewTripScreen />);
  });
  await flush();
  const all = texts(tree);
  expect(all).toContain('A day around Loudoun County');
  expect(all).toContain('Find wineries');
  expect(all).toContain('YOUR DAYS');
  expect(tree.root.findByProps({ accessibilityLabel: 'Starting place' }).props.value).toBe('Loudoun County');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Open A day around Middleburg' }).props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/trips/p1');
  expect(all).not.toContain('SAMPLE');
  await act(async () => tree.unmount());
});
