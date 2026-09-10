// components/ProUpsellCard.js — a proactive Pro entry card, not a gate.
//
// Owner ask 2026-09-10: upgrading has to be easy from the surfaces where Pro
// actually lives (the Sommelier tab, Profile), not only from tripping a meter.
// One card, one tap, straight to the paywall. The screens own the copy so the
// pitch can match the surface ("Unlimited sommelier…" on the Somm tab).
//
// Renders nothing for Pro subscribers, and nothing while entitlements are
// still loading, for the same reason as UpgradePill.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePro } from '../hooks/usePro';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function ProUpsellCard({
  icon = 'sparkles',
  title = 'Go unlimited with Pro',
  subtitle = 'Unlimited sommelier, scans & cellar',
  source,
  style,
}) {
  const { colors, styles } = useScreenTheme();

  const { isPro, isLoading, presentPaywall } = usePro();
  if (isPro || isLoading) return null;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => presentPaywall(source)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Tap to see Cork and Note Pro.`}
      activeOpacity={0.85}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.onAccent} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Upgrade</Text>
      </View>
    </TouchableOpacity>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 56,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1 },
  title: {
    ...typography.body.small,
    color: colors.neutral.ink,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },
  cta: {
    backgroundColor: colors.primary.base,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  ctaText: {
    ...typography.body.caption,
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
return { colors, styles };
});
