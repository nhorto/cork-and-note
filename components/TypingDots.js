// components/TypingDots.js
// Animated three-dot "thinking" indicator for the sommelier chat. The dots pulse
// in a staggered wave. Respects the OS reduce-motion setting (falls back to a
// calm static row). Opacity-only, so it runs on the native driver.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../styles/theme';

const REST = 0.4;

export default function TypingDots({ color = colors.neutral.pewter, size = 6, style }) {
  const values = useRef([
    new Animated.Value(REST),
    new Animated.Value(REST),
    new Animated.Value(REST),
  ]).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(!!v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) =>
      mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const pulse = (v, delay) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: REST, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(300 - delay),
      ]);
    const loop = Animated.loop(
      Animated.parallel([pulse(values[0], 0), pulse(values[1], 150), pulse(values[2], 300)])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, values]);

  return (
    <View
      style={[styles.row, { gap: Math.round(size * 0.7) }, style]}
      accessibilityRole="text"
      accessibilityLabel="Thinking"
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: reduceMotion ? 0.6 : v,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
