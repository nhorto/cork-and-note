// The winery page's directory PREVIEW mode (#270, epic #268): opening a
// discovery pin shows the directory winery without creating a wineries row;
// Log visit and Add to wishlist are the actions that save it (linked to the
// directory), and a winery you already have opens as yours.
import { act, create } from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { wineriesService } from '../lib/wineries';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import { wishlistService } from '../lib/wishlist';
import WineryDetail from '../app/winery/[id]';

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    __params: { current: {} },
    useRouter: () => router,
    useNavigation: () => ({ goBack: jest.fn() }),
    useLocalSearchParams: () => require('expo-router').__params.current,
    useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
  };
});
const { __router: mockRouter, __params: mockParams } = require('expo-router');
jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({ user: { id: 'user-a' } }) }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/WineryGoogleCard', () => () => null);
jest.mock('../components/ReportWineryModal', () => () => null);
let mockPastVisitsProps = null;
jest.mock('../components/PastVisitsSection', () => (props) => { mockPastVisitsProps = props; return null; });
jest.mock('../lib/wineries', () => ({ wineriesService: {
  getWinery: jest.fn(),
  getWineryByDirectoryId: jest.fn(),
  findOrCreateWinery: jest.fn(),
} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: {
  getById: jest.fn(),
  getWebsite: jest.fn(async () => null),
} }));
jest.mock('../lib/wineryStatus', () => ({ wineryStatusService: { getWineryStatus: jest.fn(async () => ({ success: true, status: { visited: false, isWantToVisit: false } })) } }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {
  isInWishlist: jest.fn(async () => ({ isInWishlist: false })),
  addToWishlist: jest.fn(async () => ({ success: true })),
  removeFromWishlistByWineryId: jest.fn(),
} }));

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function mount(params) {
  mockParams.current = params;
  let tree;
  await act(async () => { tree = create(<WineryDetail />); });
  await flush();
  return tree;
}
const texts = (tree) => tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const button = (tree, label) => tree.root.findAllByType(TouchableOpacity).find((n) =>
  n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label));

const row = { id: 7, name: 'Test Estate', latitude: 38.1, longitude: -78.2, city: 'Delaplane', state: 'VA', website: null, operating_status: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockPastVisitsProps = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  wineriesService.getWineryByDirectoryId.mockResolvedValue({ success: true, winery: null });
  wineryDirectoryService.getById.mockResolvedValue({ success: true, winery: row });
});
afterEach(() => Alert.alert.mockRestore());

test('a preview renders the directory winery without saving anything', async () => {
  const tree = await mount({ id: 'dir-7' });
  const all = texts(tree);
  expect(all).toContain('Test Estate');
  expect(all).toContain('Delaplane, VA');
  expect(all).toContain('Not in your places yet. Log a visit or save it to keep it.');
  expect(wineriesService.getWinery).not.toHaveBeenCalled();
  expect(wineriesService.findOrCreateWinery).not.toHaveBeenCalled();
  expect(mockPastVisitsProps).toBeNull();
  await act(async () => tree.unmount());
});

test('a preview of a winery you already have redirects to your own page', async () => {
  wineriesService.getWineryByDirectoryId.mockResolvedValue({ success: true, winery: { id: 42, name: 'Test Estate' } });
  const tree = await mount({ id: 'dir-7' });
  expect(mockRouter.replace).toHaveBeenCalledWith('/winery/42');
  expect(wineryDirectoryService.getById).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('Log visit from a preview hands the directory id to the log form, not a winery id', async () => {
  const tree = await mount({ id: 'dir-7' });
  await act(async () => button(tree, 'Log visit').props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/log-session',
    params: { mode: 'winery', directoryId: '7', wineryName: 'Test Estate', lat: '38.1', lng: '-78.2' },
  });
  expect(wineriesService.findOrCreateWinery).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('Add to wishlist from a preview saves the winery linked to the directory, then opens it as yours', async () => {
  wineriesService.findOrCreateWinery.mockResolvedValue({ success: true, winery: { id: 43 } });
  const tree = await mount({ id: 'dir-7' });
  const wishlist = tree.root.findByProps({ accessibilityLabel: 'Add to wishlist' });
  await act(async () => wishlist.props.onPress());
  await flush();
  expect(wineriesService.findOrCreateWinery).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Estate', directoryId: 7, latitude: 38.1, longitude: -78.2 }));
  expect(wishlistService.addToWishlist).toHaveBeenCalledWith(43);
  expect(mockRouter.replace).toHaveBeenCalledWith('/winery/43');
  await act(async () => tree.unmount());
});

test('a permanently closed winery is badged and cannot be wishlisted', async () => {
  wineryDirectoryService.getById.mockResolvedValue({ success: true, winery: { ...row, operating_status: 'permanently_closed' } });
  const tree = await mount({ id: 'dir-7' });
  expect(texts(tree)).toContain('Permanently closed');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Add to wishlist' }).props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Permanently closed', expect.stringContaining('permanently closed'));
  expect(wineriesService.findOrCreateWinery).not.toHaveBeenCalled();
  expect(wishlistService.addToWishlist).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('a saved winery page still loads by id and shows past visits', async () => {
  wineriesService.getWinery.mockResolvedValue({ success: true, winery: { id: 42, name: 'Mine', latitude: 38, longitude: -78, directory_id: 7 } });
  const tree = await mount({ id: '42' });
  expect(texts(tree)).toContain('Mine');
  expect(texts(tree)).not.toContain('Not in your places yet. Log a visit or save it to keep it.');
  expect(mockPastVisitsProps).toEqual(expect.objectContaining({ wineryId: '42' }));
  expect(wineriesService.getWineryByDirectoryId).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
