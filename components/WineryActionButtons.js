// components/WineryActionButtons.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { wishlistService } from '../lib/wishlist';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const WineryActionButtons = ({
  winery,
  initialStatus = null,
  onStatusChange = () => {},
  compact = false
}) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    isWantToVisit: false
  });

  const { width } = Dimensions.get('window');
  const isNarrowScreen = width < 375;
  const isVeryNarrowScreen = width < 320;

  // Load initial status
  useEffect(() => {
    if (initialStatus) {
      setStatus({
        isWantToVisit: initialStatus.isWantToVisit || false
      });
      setLoading(false);
    } else {
      loadStatus();
    }
  }, [winery.id, initialStatus]);

  const loadStatus = async () => {
    try {
      setLoading(true);

      // Check wishlist status
      const { isInWishlist } = await wishlistService.isInWishlist(winery.id);

      setStatus({
        isWantToVisit: isInWishlist
      });
    } catch (error) {
      console.error('Error loading winery status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle wishlist status
  const toggleWishlist = async () => {
    try {
      setLoading(true);

      if (status.isWantToVisit) {
        // Remove from wishlist
        const { success } = await wishlistService.removeFromWishlistByWineryId(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isWantToVisit: false }));
          onStatusChange({ ...status, isWantToVisit: false });
        }
      } else {
        // Add to wishlist
        const { success } = await wishlistService.addToWishlist(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isWantToVisit: true }));
          onStatusChange({ ...status, isWantToVisit: true });

          Alert.alert('Added', `${winery.name} has been added to your "Want to Visit" list.`);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to update wishlist: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Responsive button styles
  const getButtonStyle = () => {
    if (isVeryNarrowScreen) {
      return {
        ...styles.actionButton,
        paddingHorizontal: width * 0.02,
        paddingVertical: width * 0.025,
        marginHorizontal: width * 0.01,
      };
    } else if (isNarrowScreen) {
      return {
        ...styles.actionButton,
        paddingHorizontal: width * 0.03,
        paddingVertical: width * 0.03,
        marginHorizontal: width * 0.015,
      };
    } else {
      return styles.actionButton;
    }
  };

  const getTextStyle = () => ({
    ...styles.actionButtonText,
    fontSize: isVeryNarrowScreen ? 12 : isNarrowScreen ? 13 : 14,
  });

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity
          style={[
            styles.compactButton,
            status.isWantToVisit && styles.activeWishlistButton
          ]}
          onPress={toggleWishlist}
          disabled={loading}
        >
          <Ionicons
            name={status.isWantToVisit ? "bookmark" : "bookmark-outline"}
            size={24}
            color={status.isWantToVisit ? colors.neutral.cream : colors.primary.burgundy}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isNarrowScreen && styles.narrowContainer
    ]}>
      <TouchableOpacity
        style={[
          getButtonStyle(),
          status.isWantToVisit && styles.activeWishlistButton
        ]}
        onPress={toggleWishlist}
        disabled={loading}
      >
        <Ionicons
          name={status.isWantToVisit ? "bookmark" : "bookmark-outline"}
          size={isVeryNarrowScreen ? 20 : 24}
          color={status.isWantToVisit ? colors.neutral.cream : colors.primary.burgundy}
        />
        <Text
          style={[
            getTextStyle(),
            status.isWantToVisit && styles.activeButtonText
          ]}
        >
          {status.isWantToVisit ? "Want to Visit" : "Want to Visit"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  narrowContainer: {
    paddingHorizontal: spacing.xs,
  },
  compactContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary.burgundy,
    marginHorizontal: spacing.xs,
    maxWidth: 180,
    ...shadows.soft,
  },
  compactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary.burgundy,
    marginLeft: spacing.sm,
    width: 44,
    height: 44,
  },
  activeWishlistButton: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  actionButtonText: {
    marginLeft: spacing.sm,
    ...typography.body.regular,
    fontWeight: '500',
    color: colors.primary.burgundy,
    textAlign: 'center',
    flexShrink: 1,
  },
  activeButtonText: {
    color: colors.neutral.cream,
  },
});

export default WineryActionButtons;
