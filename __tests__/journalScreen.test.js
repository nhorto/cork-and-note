// The Journal tab (app/(tabs)/wines.js): a backend failure must look like a
// failure. The services resolve `{ success: false }` on handled errors rather
// than throwing, so a screen that only sets its error flag in a catch block
// shows "No wines found" (or yesterday's list) when the network is down.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { visitsService } from '../lib/visits';
import Wines from '../app/(tabs)/wines';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn(), functions: {} } }));
jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({ user: { id: 'user-a' } }) }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/LogFab', () => () => null);
jest.mock('../components/WinesFilterModal', () => () => null);
jest.mock('../lib/visits', () => ({ visitsService: { getUserVisits: jest.fn() } }));
jest.mock('../lib/cellar', () => ({ cellarService: { getCellar: jest.fn(async () => ({ success: true, bottles: [] })) } }));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mount() {
  let tree;
  await act(async () => { tree = create(<Wines />); });
  await flush();
  return tree;
}

const visit = {
  id: 1, visit_date: '2026-09-01', winery_id: 7, wineries: { name: 'Barboursville' },
  wines: [{ id: 11, wine_name: 'Octagon', wine_type: 'red', wine_varietal: ['Merlot'], wine_year: 2019, overall_rating: 4.5 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

test('lists tasted wines with the place they were tasted', async () => {
  visitsService.getUserVisits.mockResolvedValue({ success: true, visits: [visit] });
  const tree = await mount();
  const all = texts(tree);
  expect(all.some((t) => t.includes('Octagon'))).toBe(true);
  expect(all.some((t) => t.includes('Barboursville'))).toBe(true);
  expect(all).not.toContain('No wines found');
});

test('a handled backend failure shows the retry state, not an empty journal', async () => {
  visitsService.getUserVisits.mockResolvedValue({ success: false, error: 'Network request failed' });
  const tree = await mount();
  const all = texts(tree);
  expect(all).toContain('Try again');
  expect(all).not.toContain('No wines found');
});

test('a thrown failure shows the same retry state', async () => {
  visitsService.getUserVisits.mockRejectedValue(new Error('boom'));
  const tree = await mount();
  expect(texts(tree)).toContain('Try again');
});

test('retrying after a failure loads the journal', async () => {
  visitsService.getUserVisits
    .mockResolvedValueOnce({ success: false, error: 'offline' })
    .mockResolvedValueOnce({ success: true, visits: [visit] });
  const tree = await mount();
  const retry = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => t.props.children === 'Try again'))[0];
  await act(async () => retry.props.onPress());
  await flush();
  expect(texts(tree).some((t) => t.includes('Octagon'))).toBe(true);
  expect(texts(tree)).not.toContain('Try again');
});
