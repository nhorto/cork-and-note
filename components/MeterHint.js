// components/MeterHint.js — the one line that stops a paywall being a surprise.
//
// Launch plan §4.5 item 5: every gated action states what is left BEFORE it is
// used, never after. Renders nothing for a Pro user and nothing when the count is
// unknown — an empty space is better than "undefined free scans left".
//
// Tapping it opens the paywall, so the hint is also the way out.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { meterHint } from '../lib/pro';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function MeterHint({ task, text, source, style }) {
  const { colors, styles } = useScreenTheme();

  const { isPro, remaining, presentPaywall } = usePro();

  const label = text ?? meterHint({ isPro, task, remaining: remaining(task) });
  if (!label) return null;

  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={() => presentPaywall(source ?? task)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to see Cork and Note Pro.`}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="information-circle-outline" size={14} color={colors.neutral.inkTertiary} />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, spacing } = theme;
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: colors.neutral.inkTertiary,
  },
});
return { colors, styles };
});
