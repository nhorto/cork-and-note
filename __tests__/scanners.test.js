// The two scan cards (single label on the cellar add screen, tasting card on
// the logging session). The one rule that matters most: the free meter gate
// runs BEFORE the camera opens, because framing a label and only then being
// told you are out of scans is the surprise the launch plan forbids. Then:
// what a good scan hands up, and what the user sees on each failure.
import { act, create } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { usePro } from '../hooks/usePro';
import { aiService } from '../lib/ai';
import { scanTastingCard, scanWineLabel } from '../lib/cellarScan';
import LabelScanner from '../components/LabelScanner';
import TastingMenuScanner from '../components/TastingMenuScanner';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/MeterHint', () => () => null);
jest.mock('../lib/ai', () => ({ aiService: { photoToBase64: jest.fn() } }));
jest.mock('../lib/cellarScan', () => ({ scanWineLabel: jest.fn(), scanTastingCard: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const picker = jest.requireMock('expo-image-picker');
const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const pressText = (tree, label) => {
  const btn = tree.root.findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)).at(-1);
  if (!btn) throw new Error(`no button labelled ${label}: ${texts(tree).join(' | ')}`);
  return act(async () => btn.props.onPress());
};

const CASES = [
  {
    name: 'LabelScanner',
    Component: LabelScanner,
    scan: scanWineLabel,
    cta: 'Scan a label',
    result: { success: true, fields: { wine_name: 'Octagon' }, note: 'Nice' },
    handedUp: { wine_name: 'Octagon' },
    photoArgs: ['file:///label.jpg'],
  },
  {
    name: 'TastingMenuScanner',
    Component: TastingMenuScanner,
    scan: scanTastingCard,
    cta: 'Scan a card',
    result: { success: true, wines: [{ wine_name: 'A' }, { wine_name: 'B' }], count: 2, note: 'Nice' },
    handedUp: [{ wine_name: 'A' }, { wine_name: 'B' }],
    // Dense cards ask for the larger tested edge so small print survives.
    photoArgs: ['file:///label.jpg', { maxEdge: 1568 }],
  },
];

let gate;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  gate = jest.fn(() => true);
  usePro.mockReturnValue({ gate, isPro: false, remaining: () => 3, presentPaywall: jest.fn() });
  picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
  picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///label.jpg' }] });
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///label.jpg' }] });
  aiService.photoToBase64.mockResolvedValue({ base64: 'AAAA', mediaType: 'image/jpeg' });
});
afterEach(() => Alert.alert.mockRestore());

describe.each(CASES)('$name', ({ Component, scan, cta, result, handedUp, photoArgs }) => {
  async function mount(onScanned = jest.fn()) {
    let tree;
    await act(async () => { tree = create(<Component onScanned={onScanned} />); });
    return { tree, onScanned };
  }

  test('a spent meter opens the paywall before the camera or library is touched', async () => {
    gate.mockReturnValue(false);
    const { tree } = await mount();
    await pressText(tree, cta);
    await pressText(tree, 'Choose from library');
    expect(gate).toHaveBeenCalledWith('label_scan');
    expect(gate).toHaveBeenCalledTimes(2);
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
  });

  test('a photo from the camera is read, scanned, and the result handed up', async () => {
    scan.mockResolvedValue(result);
    const { tree, onScanned } = await mount();
    await pressText(tree, cta);
    await flush();
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, quality: 0.7 }));
    expect(aiService.photoToBase64).toHaveBeenCalledWith(...photoArgs);
    expect(scan).toHaveBeenCalledWith({ base64: 'AAAA', mediaType: 'image/jpeg' });
    expect(onScanned).toHaveBeenCalledWith(handedUp);
    // Back to the CTA so the prefilled form below is the focus.
    expect(texts(tree)).toContain(cta);
  });

  test('the library path scans too, and a cancelled picker scans nothing', async () => {
    scan.mockResolvedValue(result);
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
    const { tree, onScanned } = await mount();
    await pressText(tree, 'Choose from library');
    await flush();
    expect(scan).not.toHaveBeenCalled();
    await pressText(tree, 'Choose from library');
    await flush();
    expect(onScanned).toHaveBeenCalledWith(handedUp);
  });

  test('a denied permission explains itself and never scans', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { tree, onScanned } = await mount();
    await pressText(tree, cta);
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith('Permission needed', expect.stringMatching(/camera/i));
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(onScanned).not.toHaveBeenCalled();
  });

  test('a native picker failure is an alert with the manual fallback named, not a throw', async () => {
    picker.launchCameraAsync.mockRejectedValue(new Error('no camera'));
    const { tree, onScanned } = await mount();
    await pressText(tree, cta);
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith('Camera unavailable', expect.stringMatching(/manually/));
    expect(onScanned).not.toHaveBeenCalled();
  });

  test("an unreadable photo shows an inline error and offers manual entry, without spending a scan", async () => {
    aiService.photoToBase64.mockResolvedValue(null);
    const { tree, onScanned } = await mount();
    await pressText(tree, cta);
    await flush();
    expect(texts(tree).join(' ')).toMatch(/Couldn't read that photo/);
    expect(scan).not.toHaveBeenCalled();
    expect(onScanned).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Retry scan');
  });

  test('a soft scan failure shows the server copy inline and Retry scans again', async () => {
    scan.mockResolvedValueOnce({ success: false, error: 'You have used your 3 free scans.' }).mockResolvedValueOnce(result);
    const { tree, onScanned } = await mount();
    await pressText(tree, cta);
    await flush();
    expect(texts(tree)).toContain('You have used your 3 free scans.');
    expect(onScanned).not.toHaveBeenCalled();
    await pressText(tree, 'Retry scan');
    await flush();
    expect(picker.launchCameraAsync).toHaveBeenCalledTimes(2);
    expect(onScanned).toHaveBeenCalledWith(handedUp);
  });
});
