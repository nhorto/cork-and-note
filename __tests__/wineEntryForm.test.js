// The wine entry form's own decisions (#216): what a save sends, the
// winemaker being the only required field, the half-star tap cycle, and the
// varietal-to-type inference that must never fight the user.
import { act, create } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import Button from '../components/Button';
import StarRatingInput from '../components/StarRatingInput';
import WineEntryForm from '../components/WineEntryForm';

jest.mock('../components/LabelScanner', () => (props) => { global.__scanned = props.onScanned; return null; });
jest.mock('../components/WineChatModal', () => () => null);
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const mounted = [];
async function mount(props = {}) {
  let tree;
  await act(async () => { tree = create(<WineEntryForm onSave={jest.fn()} onCancel={jest.fn()} {...props} />); });
  mounted.push(tree);
  return tree;
}
const inputByPlaceholder = (tree, needle) => tree.root.findAllByType(TextInput).find((n) => (n.props.placeholder || '').includes(needle));
const typeValue = (tree) => tree.root.findByProps({ accessibilityLabel: 'Wine type' }).props.accessibilityValue.text;
const save = (tree) => act(async () => tree.root.findAll((n) => n.type === Button && n.props.title === 'Save wine')[0].props.onPress());
const addGrape = async (tree, grape) => {
  await act(async () => inputByPlaceholder(tree, 'Add a grape').props.onChangeText(grape));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Add grape' }).props.onPress());
};
const setWinemaker = (tree, value) => act(async () => inputByPlaceholder(tree, 'Winery or producer').props.onChangeText(value));

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  Alert.alert.mockRestore();
  // The form debounces a prior-tasting lookup; unmounting cancels it so
  // nothing runs after the test environment is torn down.
  while (mounted.length) {
    const tree = mounted.pop();
    await act(async () => tree.unmount());
  }
});

describe('saving', () => {
  test('the winemaker is the only required field; everything else may be empty', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave });
    await save(tree);
    expect(onSave).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Missing Information', expect.stringMatching(/winemaker/i));

    await setWinemaker(tree, '  Barboursville  ');
    await save(tree);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
      winemaker: 'Barboursville', name: '', type: null, varietal: [], year: '', overallRating: 0, flavorNotes: [], photos: [], photo: null,
    }));
  });

  test('a second rapid tap does not save twice', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave });
    await setWinemaker(tree, 'Barboursville');
    await save(tree);
    await save(tree);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test('editing keeps the wine id so the caller updates instead of inserting', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave, initialData: { id: 77, winemaker: 'Early Mountain', name: 'Eluvium', varietal: 'Petit Manseng, Viognier', overallRating: 4.5 } });
    await save(tree);
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 77, winemaker: 'Early Mountain', name: 'Eluvium', varietal: ['Petit Manseng', 'Viognier'], overallRating: 4.5 }));
  });
});

describe('the half-star tap cycle', () => {
  const tap = (tree, star) => act(async () => tree.root.findByProps({ accessibilityLabel: `${star} star${star === 1 ? '' : 's'}` }).props.onPress());
  const value = (tree) => tree.root.findByType(StarRatingInput).props.value;

  test('tap sets the star, a second tap on the same star makes it a half, a third clears', async () => {
    const tree = await mount();
    await tap(tree, 4);
    expect(value(tree)).toBe(4);
    await tap(tree, 4);
    expect(value(tree)).toBe(3.5);
    await tap(tree, 4);
    expect(value(tree)).toBe(0);
  });

  test('tapping a different star jumps straight to it, and the value rides into the save', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave });
    await tap(tree, 2);
    await tap(tree, 5);
    expect(value(tree)).toBe(5);
    await tap(tree, 5);
    await setWinemaker(tree, 'X');
    await save(tree);
    expect(onSave.mock.calls[0][0].overallRating).toBe(4.5);
  });
});

describe('varietal to type inference', () => {
  test('one red grape infers Red; a second red grape upgrades to Red Blend; removing them clears the guess', async () => {
    const tree = await mount();
    expect(typeValue(tree)).toBe('not set');
    await addGrape(tree, 'Cabernet Sauvignon');
    expect(typeValue(tree)).toBe('Red');
    await addGrape(tree, 'Merlot');
    expect(typeValue(tree)).toBe('Red Blend');
    // Remove both chips (a chip is the pressable whose text is the grape).
    const { Text } = require('react-native');
    for (const grape of ['Cabernet Sauvignon', 'Merlot']) {
      const chip = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => t.props.children === grape)).at(-1);
      await act(async () => chip.props.onPress());
    }
    expect(typeValue(tree)).toBe('not set');
  });

  test('sparkling anywhere in the list wins, and a mixed red and white list makes no guess', async () => {
    const tree = await mount();
    await addGrape(tree, 'Chardonnay');
    expect(typeValue(tree)).toBe('White');
    await addGrape(tree, 'Champagne');
    expect(typeValue(tree)).toBe('Sparkling');

    const mixed = await mount();
    await addGrape(mixed, 'Chardonnay');
    await addGrape(mixed, 'Merlot');
    expect(typeValue(mixed)).toBe('not set');
  });

  test('a type the user chose is never overridden by inference', async () => {
    const tree = await mount();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Wine type' }).props.onPress());
    const rose = tree.root.findAll((n) => n.props.onPress && n.findAllByType(require('react-native').Text).some((t) => t.props.children === 'Rosé')).at(-1);
    await act(async () => rose.props.onPress());
    expect(typeValue(tree)).toBe('Rosé');
    await addGrape(tree, 'Cabernet Sauvignon');
    await addGrape(tree, 'Merlot');
    expect(typeValue(tree)).toBe('Rosé');
  });

  test('a label scan prefills, merges varietals without duplicates, and its type counts as the user\'s choice', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave });
    await addGrape(tree, 'merlot');
    await act(async () => global.__scanned({ producer: 'Barboursville', wine_name: 'Octagon', vintage: '2019', wine_type: 'Red Blend', varietal: 'Merlot, Cabernet Franc', region: 'Virginia' }));
    expect(typeValue(tree)).toBe('Red Blend');
    await save(tree);
    const payload = onSave.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ winemaker: 'Barboursville', name: 'Octagon', year: '2019', type: 'Red Blend' }));
    expect(payload.varietal).toEqual(['merlot', 'Cabernet Franc']);
    expect(payload).not.toHaveProperty('region');
  });

  test('a grape is added once regardless of case, and blank input is ignored', async () => {
    const tree = await mount();
    await addGrape(tree, 'Viognier');
    await addGrape(tree, 'VIOGNIER');
    await addGrape(tree, '   ');
    const onSave = jest.fn();
    await act(async () => tree.update(<WineEntryForm onSave={onSave} onCancel={jest.fn()} />));
    await setWinemaker(tree, 'X');
    await save(tree);
    expect(onSave.mock.calls[0][0].varietal).toEqual(['Viognier']);
  });
});
