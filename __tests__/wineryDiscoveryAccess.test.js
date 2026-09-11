import { act, create } from 'react-test-renderer';
import * as Location from 'expo-location';
import { usePro } from '../hooks/usePro';
import { wineriesService } from '../lib/wineries';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import { placesService } from '../lib/places';
import NearYouRow from '../components/NearYouRow';
import WineryGoogleCard from '../components/WineryGoogleCard';

const mockPush = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../lib/wineries', () => ({ wineriesService: { findOrCreateWinery: jest.fn() } }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: { getNearby: jest.fn() } }));
jest.mock('../lib/places', () => ({ placesService: {
  matchWinery: jest.fn(), getDetails: jest.fn(), getPhotoUri: jest.fn(),
} }));

beforeEach(() => {
  jest.clearAllMocks();
  usePro.mockReturnValue({ isPro: false, presentPaywall: jest.fn() });
});

test('a free Home user can enable location, discover a winery, and open its page', async () => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 38, longitude: -78 } });
  wineryDirectoryService.getNearby.mockResolvedValue({ success: true, wineries: [
    { id: 7, name: 'Test Estate', distanceKm: 1, latitude: 38, longitude: -78 },
  ] });
  let tree;
  await act(async () => { tree = create(<NearYouRow />); });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Show wineries near you' }).props.onPress());
  expect(wineryDirectoryService.getNearby).toHaveBeenCalledWith({ latitude: 38, longitude: -78, limitCount: 3 });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Test Estate, 0.6 mi away' }).props.onPress());
  // A preview, not a saved winery (#270).
  expect(mockPush).toHaveBeenCalledWith('/winery/dir-7');
  expect(wineriesService.findOrCreateWinery).not.toHaveBeenCalled();
  expect(placesService.getDetails).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('a free winery page shows the Pro offer without requesting any Google enrichment', async () => {
  const presentPaywall = jest.fn();
  usePro.mockReturnValue({ isPro: false, presentPaywall });
  let tree;
  await act(async () => {
    tree = create(<WineryGoogleCard winery={{ id: 99, google_place_id: 'place-99', latitude: 38, longitude: -78 }} />);
  });
  expect(placesService.matchWinery).not.toHaveBeenCalled();
  expect(placesService.getDetails).not.toHaveBeenCalled();
  expect(placesService.getPhotoUri).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Winery ratings and hours — Pro feature' }).props.onPress());
  expect(presentPaywall).toHaveBeenCalledWith('places');
  await act(async () => tree.unmount());
});

test('Pro winery pages still request Google details', async () => {
  usePro.mockReturnValue({ isPro: true, presentPaywall: jest.fn() });
  placesService.getDetails.mockResolvedValue({ success: true, details: { rating: 4.5 } });
  let tree;
  await act(async () => {
    tree = create(<WineryGoogleCard winery={{ id: 99, google_place_id: 'place-99' }} directoryId={7} />);
  });
  expect(placesService.getDetails).toHaveBeenCalledWith('place-99', { directoryId: 7 });
  expect(JSON.stringify(tree.toJSON())).toContain('4.5');
  await act(async () => tree.unmount());
});
