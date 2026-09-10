// components/SegmentedRating.js
// Tap-first replacement for the detailed-ratings drag slider (#216): ten
// half-step cells (0.5–5.0) that read like a level meter. A tap sets the value
// where you tapped; a horizontal swipe scrubs; tapping the current value again
// clears it back to 0 (unrated).
//
// Scroll safety — the core complaint with the old slider — works like this:
// a plain tap is handled by Pressable's onPress (which never fires if the
// gesture became a scroll), and the PanResponder only claims the gesture once
// the movement is clearly horizontal, so a vertical drag that happens to start
// on the bar still scrolls the form instead of mangling the rating.
//
// Legacy values (0.1-step data from the old slider, or AI suggestions) are
// shown as-is in the number and rounded to the nearest half-cell in the bar.
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';


const CELLS = 10; // 0.5 … 5.0

export default function SegmentedRating({ label, value = 0, onValueChange }) {
  const { styles } = useScreenTheme();

  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastHapticRef = useRef(0);

  const valueFromX = (x) => {
    const w = widthRef.current;
    if (!w) return null;
    const v = Math.ceil((x / w) * CELLS) / 2;
    return Math.max(0.5, Math.min(5, v));
  };

  const emit = (v, { toggle = false } = {}) => {
    if (v == null) return;
    // Tapping the cell that's already the value clears the rating.
    const next = toggle && v === valueRef.current ? 0 : v;
    if (next === valueRef.current) return;
    if (next !== lastHapticRef.current) {
      lastHapticRef.current = next;
      Haptics.selectionAsync().catch(() => {});
    }
    onValueChange?.(next);
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim only once the gesture is clearly horizontal — vertical drags
      // stay with the parent ScrollView.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (evt) => emit(valueFromX(evt.nativeEvent.locationX)),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const filled = Math.round(value * 2) / 2;

  const cells = [];
  for (let i = 1; i <= CELLS; i++) {
    cells.push(
      <View
        key={i}
        pointerEvents="none"
        style={[
          styles.cell,
          i === 1 && styles.cellFirst,
          i === CELLS && styles.cellLast,
          i / 2 <= filled && styles.cellOn,
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, value === 0 && styles.valueEmpty]}>
          {value > 0 ? value.toFixed(1) : '—'}
        </Text>
      </View>
      {/* The pan responder lives on the WRAPPER, not the touchable — only the
          wrapper's move-negotiation claims clearly-horizontal drags, while the
          inner touchable handles plain taps (and its press auto-cancels the
          moment any responder — scrub or scroll — takes the gesture over). */}
      <View
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <TouchableWithoutFeedback
          onPress={(e) => emit(valueFromX(e.nativeEvent.locationX), { toggle: true })}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 5, now: value, text: `${value} out of 5` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const delta = e.nativeEvent.actionName === 'increment' ? 0.5 : -0.5;
            const next = Math.max(0, Math.min(5, Math.round((valueRef.current + delta) * 2) / 2));
            onValueChange?.(next);
          }}
        >
          <View style={styles.bar}>{cells}</View>
        </TouchableWithoutFeedback>
      </View>
      <View style={styles.ticks} pointerEvents="none">
        {[1, 2, 3, 4, 5].map((n) => (
          <Text key={n} style={styles.tick}>{n}</Text>
        ))}
      </View>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body.regular,
    fontWeight: '500',
    color: colors.neutral.ink,
  },
  value: {
    ...typography.body.regular,
    fontWeight: '700',
    color: colors.primary.ink,
    fontVariant: ['tabular-nums'],
  },
  valueEmpty: {
    color: colors.neutral.placeholder,
    fontWeight: '500',
  },
  bar: {
    flexDirection: 'row',
    gap: 3,
    // Comfortable touch height without a thumb to grab.
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral.divider,
  },
  cellFirst: {
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  cellLast: {
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  cellOn: {
    backgroundColor: colors.primary.base,
  },
  // One number under every second cell: each label spans a whole-point pair.
  ticks: {
    flexDirection: 'row',
    marginTop: 2,
  },
  tick: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: colors.neutral.placeholder,
  },
});
return { styles };
});
