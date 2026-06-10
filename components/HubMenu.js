// components/HubMenu.js — the center "＋" quick-actions hub.
//
// Tabs are DESTINATIONS (Home / Cellar / Explore / Profile); this hub is the
// single front door for the "start / create" ACTIONS. Tapping the raised center
// "＋" opens this bottom sheet (mirrors the map's Quick Actions pattern):
//   • Log a wine        → the existing log chooser (/(tabs)/log)
//   • Add a bottle      → /cellar/add
//   • Add to wishlist   → Explore, which opens its winery-entry modal (?quickAdd)
//   • Ask the Sommelier → /(tabs)/sommelier
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
          <Text style={styles.title}>Quick Actions</Text>

          <Action
            icon="wine"
            color={colors.primary.burgundy}
            title="Log a wine"
            subtitle="Capture a wine you tasted"
            onPress={() => go('/(tabs)/log')}
          />
          <Action
            icon="file-tray-stacked"
            color={colors.gold.rich}
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
          />
          <Action
            icon="sparkles"
            color={colors.gold.shimmer}
            title="Ask the Sommelier"
            subtitle="Personalized to the wines you've rated"
            onPress={() => go('/(tabs)/sommelier')}
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
        <Ionicons name={icon} size={20} color={colors.neutral.cream} />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.neutral.silver} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral.cream,
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
    backgroundColor: colors.neutral.stone,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
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
    borderBottomColor: colors.neutral.linen,
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
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  itemSub: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },
});
