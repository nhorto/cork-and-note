// The two sheets a long-press or pin tap on the map opens. WineryNameModal
// creates a user pin: it must refuse an empty name before calling anything,
// trim what it saves, clear itself on success, and stay open with the draft
// on failure. PinActionModal routes a tap on an existing pin to the four
// actions and shows View only when a detail page exists.
import { act, create } from 'react-test-renderer';
import { Alert, Text, TextInput } from 'react-native';
import Button from '../components/Button';
import PinActionModal from '../components/PinActionModal';
import WineryNameModal from '../components/WineryNameModal';

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)).at(-1);
  if (!btn) throw new Error(`no button labelled ${label}`);
  return act(async () => btn.props.onPress());
};
const pressButton = (tree, title) => act(async () => tree.root.findAll((n) => n.type === Button && n.props.title === title)[0].props.onPress());

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => Alert.alert.mockRestore());

describe('WineryNameModal', () => {
  const coordinate = { latitude: 38.17, longitude: -78.28 };
  async function mount(props = {}) {
    let tree;
    await act(async () => { tree = create(<WineryNameModal visible onClose={jest.fn()} onSave={jest.fn()} coordinate={coordinate} {...props} />); });
    return tree;
  }
  const type = (tree, value) => act(async () => tree.root.findByType(TextInput).props.onChangeText(value));

  test('refuses an empty or whitespace name before calling save', async () => {
    const onSave = jest.fn();
    const tree = await mount({ onSave });
    await pressButton(tree, 'Save pin');
    await type(tree, '   ');
    await pressButton(tree, 'Save pin');
    expect(onSave).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Required', expect.stringMatching(/winery name/i));
  });

  test('saves the trimmed name with the dropped coordinate, then clears and closes', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const tree = await mount({ onSave, onClose });
    await type(tree, '  Early Mountain  ');
    await pressButton(tree, 'Save pin');
    expect(onSave).toHaveBeenCalledWith('Early Mountain', coordinate);
    expect(onClose).toHaveBeenCalled();
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  test('a failed save tells the user and keeps the sheet open with the draft', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('offline'));
    const onClose = jest.fn();
    const tree = await mount({ onSave, onClose });
    await type(tree, 'Early Mountain');
    await pressButton(tree, 'Save pin');
    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringMatching(/Failed to save pin/));
    expect(onClose).not.toHaveBeenCalled();
    expect(tree.root.findByType(TextInput).props.value).toBe('Early Mountain');
  });

  test('cancel discards the draft', async () => {
    const onClose = jest.fn();
    const tree = await mount({ onClose });
    await type(tree, 'Draft');
    await pressButton(tree, 'Cancel');
    expect(onClose).toHaveBeenCalled();
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });
});

describe('PinActionModal', () => {
  const winery = { id: 7, name: 'Barboursville', address: 'Barboursville, VA' };
  async function mount(props = {}) {
    const handlers = { onClose: jest.fn(), onViewDetails: jest.fn(), onLogVisit: jest.fn(), onAddToWishlist: jest.fn(), onRemovePin: jest.fn() };
    let tree;
    await act(async () => { tree = create(<PinActionModal visible winery={winery} {...handlers} {...props} />); });
    return { tree, handlers };
  }

  test('names the pin and routes each action', async () => {
    const { tree, handlers } = await mount();
    expect(texts(tree)).toContain('Barboursville');
    expect(texts(tree)).toContain('Barboursville, VA');
    await pressText(tree, 'View winery & your notes');
    expect(handlers.onViewDetails).toHaveBeenCalledTimes(1);
    await pressText(tree, 'Log a visit here');
    expect(handlers.onLogVisit).toHaveBeenCalledTimes(1);
    await pressText(tree, 'Add to wishlist');
    expect(handlers.onAddToWishlist).toHaveBeenCalledTimes(1);
    await pressText(tree, 'Remove pin');
    expect(handlers.onRemovePin).toHaveBeenCalledTimes(1);
    await pressButton(tree, 'Cancel');
    expect(handlers.onClose).toHaveBeenCalled();
  });

  test('hides View when there is no detail page to open', async () => {
    const { tree } = await mount({ onViewDetails: undefined });
    expect(texts(tree)).not.toContain('View winery & your notes');
    expect(texts(tree)).toContain('Log a visit here');
  });

  test('renders nothing without a winery', async () => {
    let tree;
    await act(async () => { tree = create(<PinActionModal visible winery={null} onClose={jest.fn()} />); });
    expect(texts(tree)).not.toContain('Log a visit here');
  });
});
