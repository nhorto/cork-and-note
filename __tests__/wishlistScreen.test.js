// The Wishlist tab renders `item.wineries.name` for every row. The winery
// join is null whenever the referenced winery is not readable by this user
// (a winery row owned by another account, or a legacy row without an owner),
// and a null dereference in a list row takes the whole screen down.
import { act, create } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { wishlistService } from '../lib/wishlist';
import Wishlist from '../app/(tabs)/wishlist';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({ user: { id: 'user-a' } }) }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../lib/wishlist', () => ({ wishlistService: { getUserWishlist: jest.fn(), removeFromWishlist: jest.fn() } }));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mount() {
  let tree;
  await act(async () => { tree = create(<Wishlist />); });
  await flush();
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  Alert.alert.mockRestore();
  console.error.mockRestore();
});

test('rows open their winery and offer removal by name', async () => {
  wishlistService.getUserWishlist.mockResolvedValue({
    success: true,
    wishlist: [{ id: 1, winery_id: 7, wineries: { name: 'Barboursville', address: 'Barboursville, VA' } }],
  });
  const tree = await mount();
  expect(texts(tree)).toContain('Barboursville');
  const row = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => t.props.children === 'Barboursville'))[0];
  await act(async () => row.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/winery/7');

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Remove from wishlist' }).props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Remove from Wishlist', expect.stringContaining('Barboursville'), expect.any(Array));
});

test('a row whose winery is not readable still renders and can be removed', async () => {
  wishlistService.getUserWishlist.mockResolvedValue({
    success: true,
    wishlist: [
      { id: 1, winery_id: 7, wineries: { name: 'Barboursville' } },
      { id: 2, winery_id: 8, wineries: null },
    ],
  });
  wishlistService.removeFromWishlist.mockResolvedValue({ success: true });
  const tree = await mount();
  expect(texts(tree)).toContain('Barboursville');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove from wishlist' }).length).toBeGreaterThanOrEqual(2);

  // Removing the orphaned row works without the missing join.
  const removeButtons = tree.root.findAllByProps({ accessibilityLabel: 'Remove from wishlist' }).filter((n) => n.props.onPress);
  await act(async () => removeButtons.at(-1).props.onPress());
  const confirm = Alert.alert.mock.calls.at(-1)[2].find((b) => b.text === 'Remove');
  await act(async () => confirm.onPress());
  await flush();
  expect(wishlistService.removeFromWishlist).toHaveBeenCalledWith(2);
});
