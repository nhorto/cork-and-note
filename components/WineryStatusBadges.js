// components/WineryStatusBadges.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const WineryStatusBadges = ({ status, compact = false }) => {
  if (!status) return null;

  const { visited, visitCount, isWantToVisit } = status;

  // Use different layouts based on compact mode
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {visited && (
          <View style={[styles.badge, styles.visitedBadge]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.neutral.cream} />
          </View>
        )}

        {isWantToVisit && (
          <View style={[styles.badge, styles.wishlistBadge]}>
            <Ionicons name="bookmark" size={14} color={colors.neutral.cream} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {visited && (
        <View style={[styles.statusBadge, styles.visitedBadge]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.neutral.cream} />
          <Text style={styles.badgeText}>
            {visitCount > 1 ? `Visited ${visitCount} times` : 'Visited'}
          </Text>
        </View>
      )}

      {isWantToVisit && (
        <View style={[styles.statusBadge, styles.wishlistBadge]}>
          <Ionicons name="bookmark" size={16} color={colors.neutral.cream} />
          <Text style={styles.badgeText}>Want to Visit</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  compactContainer: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  visitedBadge: {
    backgroundColor: colors.status.visited,
  },
  wishlistBadge: {
    backgroundColor: colors.status.wishlist,
  },
  badgeText: {
    ...typography.body.small,
    color: colors.neutral.cream,
    fontWeight: '500',
  },
});

export default WineryStatusBadges;
