// components/MapLayersSheet.js: the Explore map's "Layers" picker.
//
// One row for now, "Wine regions" (US AVA boundaries), which is a Pro layer.
// The toggle is visible to everyone so free users can discover it: flipping it
// on a free account opens the paywall (the map owns that decision through
// onToggleWineRegions) and the switch stays off.
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function MapLayersSheet({
  visible,
  onClose,
  wineRegions = false,
  onToggleWineRegions,
  isPro = false,
  regionCount,
}) {
  const { colors, styles } = useScreenTheme();
  const detail = regionCount
    ? `US American Viticultural Areas, ${regionCount} boundaries`
    : 'US American Viticultural Areas';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Layers</Text>

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="map-outline" size={20} color={colors.primary.ink} />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>Wine regions</Text>
                {!isPro && (
                  <View style={styles.proChip}>
                    <Ionicons name="sparkles" size={10} color={colors.onAccent} />
                    <Text style={styles.proChipText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rowDetail}>{detail}</Text>
            </View>
            <Switch
              accessibilityLabel="Show wine regions"
              accessibilityHint={isPro ? undefined : 'Part of Pro. Opens the upgrade screen.'}
              value={isPro && wineRegions}
              onValueChange={(next) => onToggleWineRegions?.(next)}
              trackColor={{ false: colors.neutral.border, true: colors.primary.base }}
              thumbColor={colors.onPrimary}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const SERIF = typography.fonts.serif;

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.neutral.bg,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.neutral.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading.h3,
      color: colors.neutral.ink,
      fontFamily: SERIF,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: { flex: 1 },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    rowDetail: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
    proChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.accent.base,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    proChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.onAccent },
  });
  return { colors, styles };
});
