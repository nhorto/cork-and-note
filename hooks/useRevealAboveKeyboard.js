// hooks/useRevealAboveKeyboard.js
//
// Keeps a whole multiline box above the iOS keyboard, not just its caret.
//
// The ScrollView's automaticallyAdjustKeyboardInsets adds the bottom inset and
// scrolls until the CARET touches the keyboard's top edge, which leaves a
// notes box almost entirely hidden (owner feedback 2026-09-27, the #129 bug
// again). ScrollView's own scrollResponderScrollNativeHandleToKeyboard assumes
// the scroll view starts at the top of the screen, so it is off by the header
// height. This measures the box and the keyboard in window coordinates and
// scrolls the remaining distance.
//
// Usage: spread `scrollProps` on the ScrollView (with
// automaticallyAdjustKeyboardInsets) and call `reveal(inputRef)` from the
// input's onFocus.
import { useCallback, useMemo, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

// Breathing room between the box and the keyboard.
const MARGIN = 16;
// If the keyboard never shows (hardware keyboard), stop waiting.
const GIVE_UP_MS = 1500;

export function useRevealAboveKeyboard() {
  const scrollRef = useRef(null);
  const offsetY = useRef(0);

  const onScroll = useCallback((event) => {
    offsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const reveal = useCallback((inputRef) => {
    // Android resizes the window for the keyboard; this is an iOS gap.
    if (Platform.OS !== 'ios') return;

    const scrollClear = (keyboardTop) => {
      inputRef.current?.measureInWindow?.((_x, y, _w, height) => {
        const overflow = y + height + MARGIN - keyboardTop;
        if (overflow > 0) {
          scrollRef.current?.scrollTo({ y: offsetY.current + overflow, animated: true });
        }
      });
    };

    const metrics = Keyboard.metrics();
    if (Keyboard.isVisible() && metrics) {
      scrollClear(metrics.screenY);
      return;
    }
    // Focus fires before the keyboard animates in; wait until it has landed
    // (and the native inset scroll has run) before measuring.
    const sub = Keyboard.addListener('keyboardDidShow', (event) => {
      sub.remove();
      clearTimeout(timer);
      scrollClear(event.endCoordinates.screenY);
    });
    const timer = setTimeout(() => sub.remove(), GIVE_UP_MS);
  }, []);

  const scrollProps = useMemo(
    () => ({ ref: scrollRef, onScroll, scrollEventThrottle: 16 }),
    [onScroll]
  );

  return { scrollProps, reveal };
}
