// The Home tab: it must not start user-scoped reads before the session is
// restored, it must distinguish "backend down" from "new account", and its
// tiles must go where they say.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { cellarService } from '../lib/cellar';
import { getCellarInsights } from '../lib/cellarInsights';
import { visitsService } from '../lib/visits';
import { wishlistService } from '../lib/wishlist';
import Home from '../app/(tabs)/home';

jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), setParams: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
  };
});
const { __router: mockRouter } = require('expo-router');
const mockAuth = { current: { user: { id: 'user-a', email: 'nick@example.com' } } };
// The screen reads AuthContext at render time; each test wraps it in the
// Provider with the session it wants.
jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({ user: null }) }));
jest.mock('../hooks/usePro', () => ({ usePro: () => ({ isPro: false, presentPaywall: jest.fn(), gate: () => true, remaining: () => 0 }) }));
jest.mock('../components/LogFab', () => () => null);
jest.mock('../components/NearYouRow', () => () => null);
jest.mock('../components/UpgradePill', () => () => null);
jest.mock('../components/AskSommelierBox', () => (props) => {
  const { TextInput } = require('react-native');
  return require('react').createElement(TextInput, { accessibilityLabel: 'Ask your sommelier a question', onSubmitEditing: () => props.onAsk?.('What pairs with lamb?'), onChangeText: () => {} });
});
jest.mock('../lib/visits', () => ({
  visitsService: {
    ...jest.requireActual('../lib/visits').visitsService,
    getUserVisits: jest.fn(),
  },
}));
jest.mock('../lib/wishlist', () => ({ wishlistService: { getUserWishlist: jest.fn() } }));
jest.mock('../lib/cellar', () => ({ ...jest.requireActual('../lib/cellar'), cellarService: { getCellarStats: jest.fn() } }));
jest.mock('../lib/cellarInsights', () => ({ getCellarInsights: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
// Badges are a garnish on this screen: the engine has its own tests, so here it
// is a fixture. refreshAchievements stands in for "the last save earned
// nothing", which is the normal case on a focus load.
jest.mock('../lib/achievements', () => ({
  getAchievements: jest.fn(),
  refreshAchievements: jest.fn(),
}));
const { getAchievements, refreshAchievements } = require('../lib/achievements');

const journey = (over = {}) => ({
  success: true,
  newlyEarned: [],
  result: {
    points: 30,
    level: { level: 1, title: 'Split', points: 0, next: { level: 2, title: 'Half Bottle', points: 50 } },
    families: [
      { key: 'winery_explorer', name: 'Winery Explorer', unit: 'wineries', count: 3, tier: 'bronze', nextTier: 'silver', nextThreshold: 5, progress: 0.5 },
      { key: 'journal_keeper', name: 'Journal Keeper', unit: 'tastings', count: 1, tier: 'bronze', nextTier: 'silver', nextThreshold: 10, progress: 0.1 },
    ],
    allGrapes: [], oneOffs: [],
  },
  ...over,
});

const { AuthContext } = require('../app/_layout');
const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)).at(-1);
  if (!btn) throw new Error(`no button labelled ${label}`);
  return act(async () => btn.props.onPress());
};

async function mount(auth = mockAuth.current) {
  let tree;
  await act(async () => {
    tree = create(<AuthContext.Provider value={auth}><Home /></AuthContext.Provider>);
  });
  await flush();
  return tree;
}

const visits = [{
  id: 1, visit_date: '2026-09-01', winery_id: 7, wineries: { id: 7, name: 'Barboursville' },
  wines: [{ id: 11, wine_name: 'Octagon', wine_year: 2019, overall_rating: 4.5 }],
}];
const ok = () => {
  visitsService.getUserVisits.mockResolvedValue({ success: true, visits });
  wishlistService.getUserWishlist.mockResolvedValue({ success: true, wishlist: [{ id: 1 }, { id: 2 }] });
  cellarService.getCellarStats.mockResolvedValue({ success: true, stats: { lots: 2, totalBottles: 5, readyToDrink: 3, byStatus: { too_young: 1, ready: 3, drink_up: 0, past_peak: 0, unknown: 0 } } });
  getCellarInsights.mockResolvedValue({ success: false });
  refreshAchievements.mockResolvedValue(journey());
  getAchievements.mockResolvedValue(journey());
};
const down = () => {
  visitsService.getUserVisits.mockResolvedValue({ success: false, error: 'offline' });
  wishlistService.getUserWishlist.mockRejectedValue(new Error('offline'));
  cellarService.getCellarStats.mockResolvedValue({ success: false });
  getCellarInsights.mockResolvedValue({ success: false });
  refreshAchievements.mockRejectedValue(new Error('offline'));
  getAchievements.mockRejectedValue(new Error('offline'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.current = { user: { id: 'user-a', email: 'nick@example.com' } };
});

test('does not start any user-scoped read until the session is restored', async () => {
  ok();
  await mount({ user: null });
  expect(visitsService.getUserVisits).not.toHaveBeenCalled();
  expect(cellarService.getCellarStats).not.toHaveBeenCalled();
  expect(wishlistService.getUserWishlist).not.toHaveBeenCalled();
});

test('shows the journey counts, recent wines, and the ready-to-drink strip from the loaded data', async () => {
  ok();
  const tree = await mount();
  const all = texts(tree);
  expect(all).toContain('Octagon');
  expect(all).toContain('Barboursville · 2019');
  expect(all).toContain('READY TO DRINK');
  expect(all).not.toContain("Couldn't load your data");
});

test('when every critical load fails, it says so instead of pretending the account is empty, and retry re-fetches', async () => {
  down();
  const tree = await mount();
  expect(texts(tree)).toContain("Couldn't load your data");
  ok();
  await pressText(tree, 'Retry');
  await flush();
  expect(visitsService.getUserVisits).toHaveBeenCalledTimes(2);
  expect(texts(tree)).not.toContain("Couldn't load your data");
  expect(texts(tree)).toContain('Octagon');
});

test('one failed load out of three is not an outage: the rest renders and the banner stays hidden', async () => {
  ok();
  cellarService.getCellarStats.mockRejectedValue(new Error('offline'));
  const tree = await mount();
  expect(texts(tree)).not.toContain("Couldn't load your data");
  expect(texts(tree)).toContain('Octagon');
  expect(texts(tree)).not.toContain('READY TO DRINK');
});

test('the tiles navigate where they say', async () => {
  ok();
  const tree = await mount();
  await pressText(tree, 'Wines ▸');
  expect(mockRouter.push).toHaveBeenLastCalledWith('/wines');
  await pressText(tree, 'Places ▸');
  expect(mockRouter.push).toHaveBeenLastCalledWith('/places');
  await pressText(tree, 'Wishlist ▸');
  expect(mockRouter.push).toHaveBeenLastCalledWith('/wishlist');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Open your map' }).props.onPress());
  expect(mockRouter.push).toHaveBeenLastCalledWith('/(tabs)/map');
  await pressText(tree, 'Octagon');
  expect(mockRouter.push).toHaveBeenLastCalledWith('/wine/11');
});

test('a ready-to-drink tile with bottles deep-links into the cellar filtered to that status; an empty tile does nothing', async () => {
  ok();
  const tree = await mount();
  await pressText(tree, 'Ready');
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/cellar', params: { status: 'ready' } });
  mockRouter.push.mockClear();
  const pastPeak = tree.root.findAll((n) => n.props.disabled === true && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === 'Past peak'));
  expect(pastPeak.length).toBeGreaterThan(0);
});

test('a question typed into the ask box opens the sommelier with it', async () => {
  ok();
  const tree = await mount();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Ask your sommelier a question' }).props.onSubmitEditing());
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(tabs)/sommelier', params: { ask: 'What pairs with lamb?' } });
});

test('the Journey card nudges toward the nearest badge', async () => {
  ok();
  const tree = await mount();
  // Winery Explorer is furthest along (3 of 5), so it is the one to name.
  expect(texts(tree)).toContain('2 more wineries to Winery Explorer · Silver ›');
});

test('one away reads in the singular', async () => {
  ok();
  const nearly = journey();
  nearly.result.families[0].count = 4;
  refreshAchievements.mockResolvedValue(nearly);
  const tree = await mount();
  expect(texts(tree)).toContain('1 more winery to Winery Explorer · Silver ›');
});

test('no nudge when achievements cannot load, and the rest of Home still renders', async () => {
  ok();
  refreshAchievements.mockRejectedValue(new Error('offline'));
  getAchievements.mockRejectedValue(new Error('offline'));
  const tree = await mount();
  expect(texts(tree).some((t) => t.includes('more wineries to'))).toBe(false);
  expect(texts(tree)).toContain('Octagon');
});
