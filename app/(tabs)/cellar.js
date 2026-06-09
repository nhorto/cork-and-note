// app/(tabs)/cellar.js - Wine Cellar (inventory) — placeholder shell
// Château Label Design - Elegant & Refined
// The full cellar lands with Epic #6 once the backend is back. This is the
// shell so the tab exists and is on-brand.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../../styles/theme';

const { colors, typography, spacing } = theme;

export default function CellarScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="file-tray-stacked-outline" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.headerTitle}>Cellar</Text>
          <View style={styles.headerIcon} />
        </View>
        <View style={styles.headerBorder} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconRing}>
          <Ionicons name="file-tray-stacked-outline" size={36} color={colors.gold.shimmer} />
        </View>
        <Text style={styles.title}>Your cellar</Text>
        <Text style={styles.sub}>
          Track the bottles you own — vintages, quantities, and when they are
          ready to drink. Coming soon.
        </Text>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  header: { backgroundColor: colors.neutral.cream, paddingTop: 60 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginHorizontal: spacing.lg,
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    marginTop: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.gold.muted },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold.rich,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },
});
