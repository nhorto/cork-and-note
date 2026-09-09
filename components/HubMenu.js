// components/HubMenu.js — the "＋ Log" quick-actions hub.
//
// Tabs are DESTINATIONS (Home / Journal / Wineries / Somm / Cellar); this hub
// is the single front door for the "start / create" ACTIONS. The floating
// "＋ Log" pill (components/LogFab.js) opens this bottom sheet:
//   • Log a wine        → the existing log chooser (/(tabs)/log)
//   • Add a bottle      → /cellar/add
//   • Add to wishlist   → Wineries, which opens its winery-entry modal (?quickAdd)
//
// Browse links and the sommelier shortcut left with the flat-five bar (#203):
// Journal, Wineries, and Somm are first-class tabs now, so the hub is
// create-only again.
//
// Every item just closes the sheet and navigates — deliberately NO nested modal.
// Presenting a second modal while this one dismisses leaves iOS's modal system
// stuck (the hub then won't reopen). So the wishlist add reuses the map's
// existing single modal via a ?quickAdd param instead of opening one here.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

const SERIF = typography.fonts.serif;
export default function HubMenu({ visible, onClose }) {
  const router = useRouter();

  // Dismiss the sheet, then navigate. Closing + pushing in the same tick is fine
  // — the sheet animates out while the destination mounts underneath.
  const go = (path) => {
    onClose();
    router.push(path);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Quick actions</Text>

          <Action
            icon="wine"
            color={colors.primary.base}
            title="Log a wine"
            subtitle="Capture a wine you tasted"
            onPress={() => go('/(tabs)/log')}
          />
          <Action
            icon="file-tray-stacked"
            color={colors.accent.base}
            title="Add a bottle"
            subtitle="Add a bottle to your cellar"
            onPress={() => go('/cellar/add')}
          />
          <Action
            icon="bookmark"
            color={colors.status.wishlist}
            title="Add to wishlist"
            subtitle="Save a winery you'd like to visit"
            onPress={() => go('/(tabs)/map?quickAdd=wishlist')}
            last
          />
        </View>
      </View>
    </Modal>
  );
}

function Action({ icon, color, title, subtitle, onPress, last }) {
  return (
    <TouchableOpacity
      style={[styles.item, !last && styles.itemBorder]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[styles.itemIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color={colors.neutral.bg} />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.neutral.placeholder} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    ...shadows.strong,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1 },
  itemTitle: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '600',
  },
  itemSub: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },
});
