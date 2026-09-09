// components/PinActionModal.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';
import Button from './Button';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;
const PinActionModal = ({
  visible,
  winery,
  onClose,
  onLogVisit,
  onAddToWishlist,
  onRemovePin,
  onViewDetails
}) => {
  if (!winery) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.container}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header with winery info */}
            <View style={styles.header}>
              <View style={styles.headerDecoration}>
                <View style={styles.decorativeLine} />
                <View style={styles.headerIcon}>
                  <Ionicons name="wine" size={20} color={colors.primary.base} />
                </View>
                <View style={styles.decorativeLine} />
              </View>

              <Text style={styles.title}>{winery.name}</Text>
              {winery.address && (
                <Text style={styles.address}>{winery.address}</Text>
              )}
            </View>

            {/* Action Options — look first, create second (#170 item 6): the
                primary row opens the winery page with your notes; logging goes
                straight to the log form. */}
            <View style={styles.options}>
              {onViewDetails && (
                <TouchableOpacity
                  style={styles.option}
                  onPress={onViewDetails}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.status.visited }]}>
                    <Ionicons name="reader" size={20} color={colors.neutral.bg} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionText}>View winery & your notes</Text>
                    <Text style={styles.optionSubtext}>Past visits and the wines you logged</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.option}
                onPress={onLogVisit}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.primary.base }]}>
                  <Ionicons name="wine" size={20} color={colors.neutral.bg} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Log a visit here</Text>
                  <Text style={styles.optionSubtext}>Record wines and tasting notes</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={onAddToWishlist}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.status.wishlist }]}>
                  <Ionicons name="bookmark" size={20} color={colors.neutral.bg} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Add to wishlist</Text>
                  <Text style={styles.optionSubtext}>Save for a future visit</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
              </TouchableOpacity>

              {/* Divider before destructive action */}
              <View style={styles.destructiveDivider} />

              <TouchableOpacity
                style={[styles.option, styles.destructiveOption]}
                onPress={onRemovePin}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, styles.destructiveIcon]}>
                  <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, styles.destructiveText]}>Remove pin</Text>
                  <Text style={styles.optionSubtext}>Delete from your map</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <Button variant="secondary" title="Cancel" onPress={onClose} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
    marginBottom: spacing.md,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accent.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
  },

  // Options
  options: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionSubtext: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },

  // Destructive
  destructiveDivider: {
    height: spacing.sm,
    backgroundColor: colors.neutral.divider,
  },
  destructiveOption: {
    borderBottomWidth: 0,
  },
  destructiveIcon: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  destructiveText: {
    color: colors.status.error,
  },
});

export default PinActionModal;
