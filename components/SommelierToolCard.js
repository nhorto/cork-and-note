// components/SommelierToolCard.js — one tile in the Sommelier tab's tool grid.
//
// The Somm tab is a home for guided help, not a menu of chats (owner direction
// 2026-09-11): the ask box stays the hero, and the three guided tools sit
// beneath it as compact tiles. Each tile is a navigation affordance only — the
// destination screen owns the free preview and the Pro gate, so a free user
// who taps sees what the tool does before they are asked for anything.
//
// The PRO chip renders for free users only, and only when `pro` is set. It is
// the same gold chip UpgradePill uses so "PRO" means one thing everywhere.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePro } from '../hooks/usePro';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function SommelierToolCard({
  icon = 'sparkles-outline',
  title,
  subtitle,
  pro = false,
  onPress,
  style,
  testID,
}) {
  const { colors, styles } = useScreenTheme();
  const { isPro, isLoading } = usePro();
  const showPro = pro && !isPro && !isLoading;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={showPro ? `${title}. Part of Pro.` : title}
      accessibilityHint={subtitle}
      testID={testID}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.primary.ink} />
        </View>
        {showPro ? (
          <View style={styles.proChip}>
            <Text style={styles.proChipText}>PRO</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;

  const styles = StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 100,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      padding: spacing.sm + 2,
      minHeight: 112,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proChip: {
      backgroundColor: colors.accent.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    proChipText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.accent.ink,
    },
    title: {
      ...typography.body.small,
      fontWeight: '700',
      color: colors.neutral.ink,
    },
    subtitle: {
      ...typography.body.caption,
      color: colors.neutral.inkTertiary,
      marginTop: 2,
    },
  });
  return { colors, styles };
});
