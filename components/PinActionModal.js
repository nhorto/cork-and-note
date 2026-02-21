// components/PinActionModal.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

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
                  <Ionicons name="wine" size={20} color={colors.primary.burgundy} />
                </View>
                <View style={styles.decorativeLine} />
              </View>

              <Text style={styles.title}>{winery.name}</Text>
              {winery.address && (
                <Text style={styles.address}>{winery.address}</Text>
              )}
            </View>

            {/* Action Options */}
            <View style={styles.options}>
              <TouchableOpacity
                style={styles.option}
                onPress={onLogVisit}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.primary.burgundy }]}>
                  <Ionicons name="wine" size={20} color={colors.neutral.cream} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Log Visit</Text>
                  <Text style={styles.optionSubtext}>Record wines and tasting notes</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={onAddToWishlist}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.status.wishlist }]}>
                  <Ionicons name="bookmark" size={20} color={colors.neutral.cream} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Add to Wishlist</Text>
                  <Text style={styles.optionSubtext}>Save for a future visit</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
              </TouchableOpacity>

              {onViewDetails && (
                <TouchableOpacity
                  style={styles.option}
                  onPress={onViewDetails}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.status.visited }]}>
                    <Ionicons name="information-circle" size={20} color={colors.neutral.cream} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionText}>View Details</Text>
                    <Text style={styles.optionSubtext}>See past visits and notes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
                </TouchableOpacity>
              )}

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
                  <Text style={[styles.optionText, styles.destructiveText]}>Remove Pin</Text>
                  <Text style={styles.optionSubtext}>Delete from your map</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.stone,
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
    backgroundColor: colors.gold.muted,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    textAlign: 'center',
  },

  // Options
  options: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
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
    color: colors.neutral.charcoal,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionSubtext: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },

  // Destructive
  destructiveDivider: {
    height: spacing.sm,
    backgroundColor: colors.neutral.linen,
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

  // Cancel Button
  cancelButton: {
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontWeight: '500',
  },
});

export default PinActionModal;
