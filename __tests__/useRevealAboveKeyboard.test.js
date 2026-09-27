// The notes box must clear the keyboard as a whole, not just its caret
// (owner feedback 2026-09-27). The hook measures the box and the keyboard in
// window coordinates and scrolls the rest of the way.
import { act, create } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';
import { useRevealAboveKeyboard } from '../hooks/useRevealAboveKeyboard';

let hook;
function Probe() {
  hook = useRevealAboveKeyboard();
  return null;
}

// A box at window y with the given height.
const inputAt = (y, height) => ({ current: { measureInWindow: (cb) => cb(0, y, 300, height) } });

let listeners;
beforeEach(() => {
  Platform.OS = 'ios';
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
    listeners[name] = cb;
    return { remove: () => { delete listeners[name]; } };
  });
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  act(() => { create(<Probe />); });
  hook.scrollProps.ref.current = { scrollTo: jest.fn() };
});
afterEach(() => jest.restoreAllMocks());

test('waits for the keyboard, then scrolls the hidden part of the box into view', () => {
  hook.scrollProps.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
  hook.reveal(inputAt(600, 120)); // box spans 600..720
  expect(hook.scrollProps.ref.current.scrollTo).not.toHaveBeenCalled();

  listeners.keyboardDidShow({ endCoordinates: { screenY: 500 } });
  // 720 + 16 margin - 500 = 236 more, on top of the current 100.
  expect(hook.scrollProps.ref.current.scrollTo).toHaveBeenCalledWith({ y: 336, animated: true });
  expect(listeners.keyboardDidShow).toBeUndefined();
});

test('leaves the scroll alone when the box already clears the keyboard', () => {
  Keyboard.isVisible.mockReturnValue(true);
  Keyboard.metrics.mockReturnValue({ screenY: 500 });
  hook.reveal(inputAt(200, 120));
  expect(hook.scrollProps.ref.current.scrollTo).not.toHaveBeenCalled();
});

test('does nothing on Android, which resizes the window for the keyboard', () => {
  Platform.OS = 'android';
  hook.reveal(inputAt(600, 120));
  expect(Keyboard.addListener).not.toHaveBeenCalled();
});
