// The cellar add screen: the free 25-bottle cap is enforced HERE (not at the
// route) because "Add another like it" re-uses the form without leaving the
// screen, and a label scan must prefill only what it actually read. The form
// and scanner are stubbed to their contracts so the screen's own decisions
// are what is under test.
import { act, create } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { usePro } from '../hooks/usePro';
import { cellarService } from '../lib/cellar';
import { FREE_CELLAR_BOTTLE_LIMIT } from '../lib/pro';
import AddBottleScreen from '../app/cellar/add';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }) }));
jest.mock('../hooks/useSafeBack', () => ({ useSafeBack: () => mockBack }));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/MeterHint', () => (props) => require('react').createElement(require('react-native').Text, { testID: 'meter-hint' }, props.text));
jest.mock('../lib/haptics', () => ({ notifySuccess: jest.fn() }));
jest.mock('../lib/cellarEntry', () => ({ getEntrySuggestions: jest.fn(async () => ({ producers: [], wines: [] })) }));
jest.mock('../lib/cellar', () => ({ cellarService: { getCellar: jest.fn(), addBottle: jest.fn() } }));
// The scanner exposes its callback; the form exposes its initial values and
// a way to submit a payload.
let mockScanned;
jest.mock('../components/LabelScanner', () => (props) => { mockScanned = props.onScanned; return null; });
let mockForm;
jest.mock('../components/CellarBottleForm', () => (props) => { mockForm = props; return null; });

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

async function mount() {
  let tree;
  await act(async () => { tree = create(<AddBottleScreen />); });
  await flush();
  return tree;
}
const submit = (payload) => act(async () => { await mockForm.onSubmit(payload); });

let presentPaywall;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  presentPaywall = jest.fn();
  usePro.mockReturnValue({ isPro: false, presentPaywall });
  cellarService.getCellar.mockResolvedValue({ success: true, bottles: [] });
  cellarService.addBottle.mockResolvedValue({ success: true, bottle: { id: 1 } });
});
afterEach(() => Alert.alert.mockRestore());

const bottlesTotalling = (n) => [{ id: 1, quantity: n, location: 'Rack A', region: 'Virginia' }];

describe('the free cellar cap', () => {
  test('a free user at the limit is sent to the paywall and nothing is written', async () => {
    cellarService.getCellar.mockResolvedValue({ success: true, bottles: bottlesTotalling(FREE_CELLAR_BOTTLE_LIMIT) });
    const tree = await mount();
    expect(texts(tree).join(' ')).toMatch(/free cellar is full/);
    await submit({ wine_name: 'One more', quantity: 1 });
    expect(presentPaywall).toHaveBeenCalledWith('cellar');
    expect(cellarService.addBottle).not.toHaveBeenCalled();
  });

  test('the cap counts bottles, not lots: a case that would cross the line is refused', async () => {
    cellarService.getCellar.mockResolvedValue({ success: true, bottles: bottlesTotalling(FREE_CELLAR_BOTTLE_LIMIT - 3) });
    const tree = await mount();
    expect(texts(tree).join(' ')).toMatch(/3 free bottles left/);
    await submit({ wine_name: 'Case', quantity: 6 });
    expect(presentPaywall).toHaveBeenCalledWith('cellar');
    expect(cellarService.addBottle).not.toHaveBeenCalled();
    await submit({ wine_name: 'Three', quantity: 3 });
    expect(cellarService.addBottle).toHaveBeenCalledTimes(1);
  });

  test('"Add another" after a save re-checks the cap with the bottles just added', async () => {
    cellarService.getCellar.mockResolvedValue({ success: true, bottles: bottlesTotalling(FREE_CELLAR_BOTTLE_LIMIT - 2) });
    await mount();
    await submit({ wine_name: 'Two', quantity: 2 });
    expect(cellarService.addBottle).toHaveBeenCalledTimes(1);
    const addAnother = Alert.alert.mock.calls.at(-1)[2].find((b) => b.text === 'Add another');
    await act(async () => addAnother.onPress());
    // The form was remounted with the last bottle as prefill, quantity reset to 1.
    expect(mockForm.initialValues).toEqual(expect.objectContaining({ wine_name: 'Two', quantity: 1 }));
    await submit({ wine_name: 'Two', quantity: 1 });
    expect(presentPaywall).toHaveBeenCalledWith('cellar');
    expect(cellarService.addBottle).toHaveBeenCalledTimes(1);
  });

  test('Pro has no cap and no hint', async () => {
    usePro.mockReturnValue({ isPro: true, presentPaywall });
    cellarService.getCellar.mockResolvedValue({ success: true, bottles: bottlesTotalling(400) });
    const tree = await mount();
    expect(texts(tree).join(' ')).not.toMatch(/free/);
    await submit({ wine_name: 'Case', quantity: 12 });
    expect(presentPaywall).not.toHaveBeenCalled();
    expect(cellarService.addBottle).toHaveBeenCalledWith({ wine_name: 'Case', quantity: 12 });
  });

  test('a cellar that fails to load counts as empty rather than blocking the add', async () => {
    cellarService.getCellar.mockRejectedValue(new Error('offline'));
    await mount();
    await submit({ wine_name: 'X', quantity: 1 });
    expect(cellarService.addBottle).toHaveBeenCalled();
  });
});

describe('saving', () => {
  test('a failed save tells the user and keeps them on the form', async () => {
    cellarService.addBottle.mockResolvedValue({ success: false, error: 'A wine name is required' });
    await mount();
    await submit({ quantity: 1 });
    expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'A wine name is required');
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('a successful save offers Done (back) or Add another, and mentions an auto-linked tasting', async () => {
    cellarService.addBottle.mockResolvedValue({ success: true, bottle: { id: 1 }, linkedWine: { id: 9 } });
    await mount();
    await submit({ wine_name: 'Octagon', quantity: 1 });
    const [title, message, buttons] = Alert.alert.mock.calls.at(-1);
    expect(title).toBe('Added to cellar');
    expect(message).toMatch(/Octagon saved. Linked to a matching tasting/);
    await act(async () => buttons.find((b) => b.text === 'Done').onPress());
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('label scan prefill', () => {
  test('merges only the fields the scan actually read, keeping what was already there', async () => {
    await mount();
    await act(async () => mockScanned({ wine_name: 'Octagon', producer: 'Barboursville', vintage: '2019', wine_type: null, varietal: null, region: null, quantity: 99, evil: true }));
    expect(mockForm.initialValues).toEqual({ wine_name: 'Octagon', producer: 'Barboursville', vintage: '2019' });
    expect(mockForm.defaultPurchaseToday).toBe(true);

    // A second scan that read only a vintage does not blank the name.
    await act(async () => mockScanned({ wine_name: null, producer: null, vintage: '2021', wine_type: 'Red', varietal: null, region: null }));
    expect(mockForm.initialValues).toEqual({ wine_name: 'Octagon', producer: 'Barboursville', vintage: '2021', wine_type: 'Red' });
  });

  test('a null scan result changes nothing', async () => {
    await mount();
    const before = mockForm;
    await act(async () => mockScanned(null));
    expect(mockForm).toBe(before);
  });
});
