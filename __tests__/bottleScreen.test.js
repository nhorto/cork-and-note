// The bottle detail screen: what "Open a bottle" and "Tasted, keep the
// bottle" send to the service, and the three outcomes the user is shown
// afterwards (kept, last one gone, tasting logged). Also the not-found state
// and the deep link into the full logger for a just-created tasting.
import { act, create } from 'react-test-renderer';
import { Alert, Switch, Text } from 'react-native';
import { cellarService, KEEP_BOTTLE_REASON } from '../lib/cellar';
import BottleScreen from '../app/cellar/[id]';

jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), setParams: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ id: '42' }),
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
  };
});
const { __router: mockRouter } = require('expo-router');
const mockBack = jest.fn();
jest.mock('../hooks/useSafeBack', () => ({ useSafeBack: () => mockBack }));
jest.mock('../hooks/usePro', () => ({ usePro: () => ({ isPro: false, presentPaywall: jest.fn(), gate: () => true, remaining: () => 0 }) }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/BottlePairing', () => () => null);
jest.mock('../components/ConsumptionHistory', () => () => null);
jest.mock('../components/MaturityTimeline', () => () => null);
jest.mock('../components/TastingLinkCard', () => () => null);
jest.mock('../components/CellarBottleForm', () => () => null);
jest.mock('../lib/visits', () => ({ visitsService: { getUserVisits: jest.fn(async () => ({ success: true, visits: [] })) } }));
jest.mock('../lib/cellar', () => ({
  ...jest.requireActual('../lib/cellar'),
  cellarService: {
    getBottle: jest.fn(),
    getCellar: jest.fn(async () => ({ success: true, bottles: [] })),
    openBottle: jest.fn(),
    adjustQuantity: jest.fn(),
    updateBottle: jest.fn(),
    linkTasting: jest.fn(),
    deleteBottle: jest.fn(),
  },
}));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)).at(-1);
  if (!btn) throw new Error(`no button labelled ${label}`);
  return act(async () => btn.props.onPress());
};
const lastAlert = () => Alert.alert.mock.calls.at(-1);

const bottle = (overrides = {}) => ({
  id: 42, wine_name: 'Octagon', producer: 'Barboursville', vintage: 2019, wine_type: 'Red', quantity: 3, status: 'in_cellar', ...overrides,
});

async function mount() {
  let tree;
  await act(async () => { tree = create(<BottleScreen />); });
  await flush();
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  cellarService.getBottle.mockResolvedValue({ success: true, bottle: bottle() });
});
afterEach(() => Alert.alert.mockRestore());

test('a bottle that cannot be loaded shows not-found with a way back', async () => {
  cellarService.getBottle.mockResolvedValue({ success: false, error: 'offline' });
  const tree = await mount();
  expect(texts(tree)).toContain('This bottle could not be found.');
  await pressText(tree, 'Go back');
  expect(mockBack).toHaveBeenCalled();
});

test('opening a bottle sends the draw-down with a logged tasting by default, then reports the tasting', async () => {
  cellarService.openBottle.mockResolvedValue({ success: true, bottle: bottle({ quantity: 2 }), wineId: 9, visitId: 77, keptBottle: false });
  const tree = await mount();
  await pressText(tree, 'Open a bottle');
  await pressText(tree, 'Confirm');
  await flush();
  expect(cellarService.openBottle).toHaveBeenCalledWith('42', expect.objectContaining({
    quantity: 1, reason: 'consumed', logTasting: true, rating: undefined,
  }));
  const [title, , buttons] = lastAlert();
  expect(title).toBe('Logged');
  await act(async () => buttons.find((b) => b.text === 'Add tasting notes').onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/log-session?editVisitId=77');
  expect(mockBack).not.toHaveBeenCalled();
});

test('turning the tasting toggle off opens the bottle without writing to the journal', async () => {
  cellarService.openBottle.mockResolvedValue({ success: true, bottle: bottle({ quantity: 2 }), wineId: null, visitId: null, keptBottle: false });
  const tree = await mount();
  await pressText(tree, 'Open a bottle');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(false));
  await pressText(tree, 'Confirm');
  await flush();
  expect(cellarService.openBottle).toHaveBeenCalledWith('42', expect.objectContaining({ logTasting: false }));
  expect(Alert.alert).not.toHaveBeenCalled(); // nothing to report: still bottles left, no tasting
});

test('the last bottle going tells the user and returns them to the cellar', async () => {
  cellarService.getBottle.mockResolvedValue({ success: true, bottle: bottle({ quantity: 1 }) });
  cellarService.openBottle.mockResolvedValue({ success: true, bottle: bottle({ quantity: 0, status: 'consumed' }), wineId: null, visitId: null, keptBottle: false });
  const tree = await mount();
  await pressText(tree, 'Open a bottle');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(false));
  await pressText(tree, 'Confirm');
  await flush();
  const [title, message, buttons] = lastAlert();
  expect(title).toBe('Bottle removed');
  expect(message).toMatch(/your last one/);
  await act(async () => buttons.find((b) => b.text === 'OK').onPress());
  expect(mockBack).toHaveBeenCalled();
});

test('"Tasted, keep the bottle" always logs a tasting and never draws the lot down', async () => {
  cellarService.openBottle.mockResolvedValue({ success: true, bottle: bottle(), wineId: 9, visitId: 78, keptBottle: true });
  const tree = await mount();
  await pressText(tree, 'Tasted, keep the bottle');
  await pressText(tree, 'Log tasting');
  await flush();
  expect(cellarService.openBottle).toHaveBeenCalledWith('42', expect.objectContaining({
    quantity: 1, reason: KEEP_BOTTLE_REASON, logTasting: true,
  }));
  const [title, message] = lastAlert();
  expect(title).toBe('Tasted');
  expect(message).toMatch(/stays in your cellar/);
  expect(message).toMatch(/tasting was added/);
});

test('a refused open is reported and the screen stays put', async () => {
  cellarService.openBottle.mockResolvedValue({ success: false, error: 'Only 3 left in this lot' });
  const tree = await mount();
  await pressText(tree, 'Open a bottle');
  await pressText(tree, 'Confirm');
  await flush();
  expect(lastAlert()).toEqual(['Could not update', 'Only 3 left in this lot']);
  expect(mockBack).not.toHaveBeenCalled();
  expect(texts(tree)).toContain('Octagon');
});

test('removing the bottle asks first, then deletes and goes back', async () => {
  cellarService.deleteBottle.mockResolvedValue({ success: true });
  const tree = await mount();
  await pressText(tree, 'Remove from cellar');
  expect(cellarService.deleteBottle).not.toHaveBeenCalled();
  const [, , buttons] = lastAlert();
  await act(async () => buttons.find((b) => b.text === 'Delete').onPress());
  await flush();
  expect(cellarService.deleteBottle).toHaveBeenCalledWith('42');
  expect(mockBack).toHaveBeenCalled();
});

test('an emptied lot does not offer Open or Taste', async () => {
  cellarService.getBottle.mockResolvedValue({ success: true, bottle: bottle({ quantity: 0, status: 'consumed' }) });
  const tree = await mount();
  expect(texts(tree)).not.toContain('Open a bottle');
  expect(texts(tree)).not.toContain('Tasted, keep the bottle');
});
