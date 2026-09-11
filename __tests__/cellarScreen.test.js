// The Cellar tab: a failed load must never look like an empty cellar (that
// would show first-run onboarding to someone with 40 bottles), the Home
// "Ready to Drink" deep link must pre-apply the matching filter, and rows
// must open their bottle.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { cellarService } from '../lib/cellar';
import CellarScreen from '../app/(tabs)/cellar';

jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), setParams: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    __params: { current: {} },
    useRouter: () => router,
    useLocalSearchParams: () => require('expo-router').__params.current,
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
  };
});
const { __router: mockRouter, __params: mockParams } = require('expo-router');
jest.mock('../hooks/usePro', () => ({ usePro: () => ({ isPro: false, presentPaywall: jest.fn(), gate: () => true, remaining: () => 0 }) }));
jest.mock('../components/TonightsPickCard', () => () => null);
jest.mock('../components/UpgradePill', () => () => null);
jest.mock('../components/CellarFilterModal', () => () => null);
jest.mock('../components/CellarOptionSheet', () => () => null);
jest.mock('../lib/cellar', () => ({
  ...jest.requireActual('../lib/cellar'),
  cellarService: { getCellar: jest.fn() },
}));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label))[0];
  if (!btn) throw new Error(`no button labelled ${label}`);
  return act(async () => btn.props.onPress());
};

async function mount() {
  let tree;
  await act(async () => { tree = create(<CellarScreen />); });
  await flush();
  return tree;
}

const year = new Date().getFullYear();
const bottles = [
  { id: 1, wine_name: 'Octagon', producer: 'Barboursville', vintage: 2019, wine_type: 'Red', quantity: 3, status: 'in_cellar', drink_from: year - 2, drink_by: year + 5 },
  { id: 2, wine_name: 'Petit Manseng', producer: 'Early Mountain', vintage: 2022, wine_type: 'Dessert', quantity: 1, status: 'in_cellar', drink_from: year + 3, drink_by: year + 9 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
});

test('a failed load shows the retry view, never the first-run empty state', async () => {
  cellarService.getCellar.mockResolvedValue({ success: false, error: 'offline' });
  const tree = await mount();
  expect(texts(tree)).toContain("Couldn't load your cellar");
  expect(texts(tree)).not.toContain('Start your cellar');
});

test('a thrown load is handled the same way, and retry recovers', async () => {
  cellarService.getCellar.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ success: true, bottles });
  const tree = await mount();
  expect(texts(tree)).toContain("Couldn't load your cellar");
  await pressText(tree, 'Try again');
  await flush();
  expect(texts(tree)).toContain('Octagon');
  expect(cellarService.getCellar).toHaveBeenCalledTimes(2);
});

test('an empty cellar shows onboarding that leads to the add screen', async () => {
  cellarService.getCellar.mockResolvedValue({ success: true, bottles: [] });
  const tree = await mount();
  expect(texts(tree)).toContain('Start your cellar');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Add bottle' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/cellar/add');
});

test('rows open their bottle', async () => {
  cellarService.getCellar.mockResolvedValue({ success: true, bottles });
  const tree = await mount();
  await pressText(tree, 'Octagon');
  expect(mockRouter.push).toHaveBeenCalledWith('/cellar/1');
});

test('the Home deep link pre-applies the drink-window filter and clears the param so it can fire again', async () => {
  cellarService.getCellar.mockResolvedValue({ success: true, bottles });
  mockParams.current = { status: 'ready' };
  const tree = await mount();
  expect(texts(tree)).toContain('Octagon');
  expect(texts(tree)).not.toContain('Petit Manseng');
  expect(mockRouter.setParams).toHaveBeenCalledWith({ status: undefined });
});

test('an unknown status in the deep link is ignored', async () => {
  cellarService.getCellar.mockResolvedValue({ success: true, bottles });
  mockParams.current = { status: 'drop-table' };
  const tree = await mount();
  expect(texts(tree)).toContain('Octagon');
  expect(texts(tree)).toContain('Petit Manseng');
  expect(mockRouter.setParams).not.toHaveBeenCalled();
});
