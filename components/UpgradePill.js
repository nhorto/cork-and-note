// components/UpgradePill.js — the standing header route to the paywall.
//
// Owner ask 2026-09-10: a free user should never have to hunt for a gated
// feature to find the upgrade — until this, the paywall was only reachable
// through the meters and the Near You teaser. This is the quiet, always-there
// answer: a small gold PRO chip that sits in a screen header and opens the
// paywall directly.
//
// Renders nothing for Pro subscribers, and nothing while entitlements are
// still loading — a paying user must never see an "upgrade" chip flash.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function UpgradePill({ source, style }) {
  const { colors, styles } = useScreenTheme();

  const { isPro, isLoading, presentPaywall } = usePro();
  if (isPro || isLoading) return null;

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={() => presentPaywall(source)}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to Cork and Note Pro"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.8}
    >
      <Ionicons name="sparkles" size={11} color={colors.onAccent} />
      <Text style={styles.pillText}>PRO</Text>
    </TouchableOpacity>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, spacing } = theme;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accent.base,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.onAccent,
  },
});
return { colors, styles };
});
