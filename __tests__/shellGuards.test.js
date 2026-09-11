// Two small pieces of the app shell that stand in front of every screen.
//
// AgeGate: App Review reads the Terms and expects the app to actually ask.
// The gate must confirm only on an explicit Yes, treat No as a dead end with
// a way back, and the layout must persist the attestation under the key it
// reads on the next launch (or the gate reappears every time).
//
// OfflineBanner: shows only on a DEFINITE offline reading, never on the
// null the probe reports at cold start, and is announced to screen readers.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AgeGate from '../components/AgeGate';
import OfflineBanner from '../components/OfflineBanner';

jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }) }));

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)).at(-1);
  if (!btn) throw new Error(`no button labelled ${label}`);
  return act(async () => btn.props.onPress());
};

describe('AgeGate', () => {
  test('confirms only on an explicit Yes', async () => {
    const onConfirm = jest.fn();
    let tree;
    await act(async () => { tree = create(<AgeGate onConfirm={onConfirm} />); });
    expect(texts(tree)).toContain('Before you come in');
    await pressText(tree, 'Yes, I am');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('No is a dead end with a way back, and never confirms', async () => {
    const onConfirm = jest.fn();
    let tree;
    await act(async () => { tree = create(<AgeGate onConfirm={onConfirm} />); });
    await pressText(tree, 'No, not yet');
    expect(texts(tree)).toContain('See you later');
    expect(texts(tree)).not.toContain('Yes, I am');
    await pressText(tree, 'Go back');
    expect(texts(tree)).toContain('Yes, I am');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('the layout reads and writes the same storage key, and only "yes" counts', () => {
    // The gate itself does not touch storage; the root layout does. Pin the
    // key and the accepted value at the source so a rename on one side
    // cannot silently re-gate every launch.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.js'), 'utf8');
    expect(src).toMatch(/AsyncStorage\.getItem\('cn_age_attested'\)/);
    expect(src).toMatch(/AsyncStorage\.setItem\('cn_age_attested', 'yes'\)/);
    expect(src).toMatch(/v === 'yes' \? 'ok' : 'needed'/);
    // A storage read failure must re-ask, not wave the user through.
    expect(src).toMatch(/\.catch\(\(\) => \{ if \(mounted\) setAgeStatus\('needed'\); \}\)/);
    expect(AsyncStorage.getItem).toBeDefined();
  });
});

describe('OfflineBanner', () => {
  let emit;
  beforeEach(() => {
    NetInfo.addEventListener.mockImplementation((cb) => { emit = cb; return () => {}; });
  });

  async function mount() {
    let tree;
    await act(async () => { tree = create(<OfflineBanner />); });
    return tree;
  }

  test('stays hidden until the probe reports a definite offline state', async () => {
    const tree = await mount();
    expect(tree.toJSON()).toBeNull();
    await act(async () => emit({ isConnected: true, isInternetReachable: null }));
    expect(tree.toJSON()).toBeNull();
    await act(async () => emit({ isConnected: null, isInternetReachable: null }));
    expect(tree.toJSON()).toBeNull();
  });

  test.each([
    ['no connection', { isConnected: false, isInternetReachable: false }],
    ['a connection with no internet', { isConnected: true, isInternetReachable: false }],
  ])('shows, and is announced, on %s', async (_, state) => {
    const tree = await mount();
    await act(async () => emit(state));
    expect(texts(tree).join(' ')).toMatch(/No connection/);
    expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    await act(async () => emit({ isConnected: true, isInternetReachable: true }));
    expect(tree.toJSON()).toBeNull();
  });

  test('unsubscribes on unmount', async () => {
    const unsubscribe = jest.fn();
    NetInfo.addEventListener.mockImplementationOnce((cb) => { emit = cb; return unsubscribe; });
    const tree = await mount();
    await act(async () => tree.unmount());
    expect(unsubscribe).toHaveBeenCalled();
  });
});
