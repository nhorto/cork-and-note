// ChatInput: the one place a free user can be walked into a label scan by the
// back door (a photo in chat), and the only picker call site in the app that
// had no guard around the native picker.
import { act, create } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ChatInput from '../components/ChatInput';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mount(props = {}) {
  let tree;
  await act(async () => { tree = create(<ChatInput onSend={jest.fn()} {...props} />); });
  return tree;
}
const byLabel = (tree, label) => tree.root.findByProps({ accessibilityLabel: label });
const sheetButton = (title) => Alert.alert.mock.calls.at(-1)[2].find((b) => b.text === title);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
});
afterEach(() => {
  Alert.alert.mockRestore();
  console.error.mockRestore();
});

test('a locked camera button goes to the paywall and never opens a picker', async () => {
  const onLockedPhotoPress = jest.fn();
  const tree = await mount({ photosLocked: true, onLockedPhotoPress });
  await act(async () => byLabel(tree, 'Add photo').props.onPress());
  expect(onLockedPhotoPress).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test('a picked photo shows in the strip, rides along on send, and clears once the send succeeds', async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///label.jpg' }] });
  const onSend = jest.fn().mockResolvedValue(undefined);
  const tree = await mount({ onSend });

  await act(async () => byLabel(tree, 'Add photo').props.onPress());
  await act(async () => sheetButton('Photo Library').onPress());
  await flush();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove' }).length).toBeGreaterThan(0);

  await act(async () => tree.root.findByType(TextInput).props.onChangeText('  what is this?  '));
  await act(async () => byLabel(tree, 'Send').props.onPress());
  await flush();
  expect(onSend).toHaveBeenCalledWith('what is this?', ['file:///label.jpg']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove' })).toHaveLength(0);
  expect(tree.root.findByType(TextInput).props.value).toBe('');
});

test('a failed send keeps the typed text and photos so the user can retry', async () => {
  const onSend = jest.fn().mockRejectedValue(new Error('offline'));
  const tree = await mount({ onSend });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('keep me'));
  await act(async () => byLabel(tree, 'Send').props.onPress());
  await flush();
  expect(tree.root.findByType(TextInput).props.value).toBe('keep me');
});

test('a denied permission explains itself instead of opening the picker', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });
  const tree = await mount();
  await act(async () => byLabel(tree, 'Add photo').props.onPress());
  await act(async () => sheetButton('Camera').onPress());
  await flush();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith('Permission Required', expect.stringMatching(/camera/i));
});

test.each([
  ['Camera', 'launchCameraAsync'],
  ['Photo Library', 'launchImageLibraryAsync'],
])('a native %s failure is reported to the user, not thrown', async (button, method) => {
  jest.requireMock('expo-image-picker')[method].mockRejectedValue(new Error('Camera not available on simulator'));
  const tree = await mount();
  await act(async () => byLabel(tree, 'Add photo').props.onPress());
  await expect(sheetButton(button).onPress()).resolves.toBeUndefined();
  await flush();
  expect(Alert.alert).toHaveBeenLastCalledWith(expect.stringMatching(/unavailable/i), expect.stringMatching(/try again/i));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove' })).toHaveLength(0);
});
