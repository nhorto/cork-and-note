// app/(tabs)/wishlist.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import { wishlistService } from '../../lib/wishlist';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function WishlistScreen() {
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    loadWishlist();
  }, [user]);

  const loadWishlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { success, wishlist: data } = await wishlistService.getUserWishlist();
      if (success) setWishlist(data);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      Alert.alert('Error', 'Failed to load your wishlist. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleWineryPress = (wineryId) => {
    router.push(`/winery/${wineryId}`);
  };

  const handleRemoveItem = (item) => {
    Alert.alert(
      'Remove from Wishlist',
      `Remove ${item.wineries.name} from your wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { success } = await wishlistService.removeFromWishlist(item.id);
              if (success) {
                setWishlist(curr => curr.filter(i => i.id !== item.id));
              }
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Could not remove item. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const renderWishlistItem = ({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.wineryItem,
        index === wishlist.length - 1 && styles.wineryItemLast
      ]}
      onPress={() => handleWineryPress(item.winery_id)}
      activeOpacity={0.7}
    >
      <View style={styles.wineryIcon}>
        <Ionicons name="wine" size={20} color={colors.primary.burgundy} />
      </View>

      <View style={styles.wineryInfo}>
        <Text style={styles.wineryName}>{item.wineries.name}</Text>
        {item.wineries.address && (
          <Text style={styles.wineryAddress} numberOfLines={1}>
            {item.wineries.address}
          </Text>
        )}
        <WineryStatusBadges
          status={{
            isWantToVisit: true,
            visited: item.status?.visited ?? false
          }}
        />
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.removeButtonInner}>
          <Ionicons name="close" size={16} color={colors.status.error} />
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Sign in required state
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bookmark-outline" size={40} color={colors.gold.muted} />
        </View>
        <Text style={styles.messageTitle}>Sign In Required</Text>
        <Text style={styles.messageText}>
          Please sign in to view and manage your wishlist
        </Text>
      </View>
    );
  }

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="wine-outline" size={32} color={colors.gold.muted} />
        </View>
        <Text style={styles.loadingText}>Loading your wishlist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Screen Header */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderContent}>
          <View style={styles.screenHeaderLeft}>
            <Ionicons name="bookmark" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.screenHeaderTitle}>Wishlist</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{wishlist.length}</Text>
          </View>
        </View>
        <View style={styles.screenHeaderBorder} />
      </View>

      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerDecoration}>
          <View style={styles.decorativeLine} />
          <Text style={styles.headerLabel}>WANT TO VISIT</Text>
          <View style={styles.decorativeLine} />
        </View>
        <Text style={styles.headerCount}>
          {wishlist.length} {wishlist.length === 1 ? 'winery' : 'wineries'}
        </Text>
      </View>

      <FlatList
        data={wishlist}
        keyExtractor={item => item.id.toString()}
        renderItem={renderWishlistItem}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          wishlist.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark-outline" size={40} color={colors.gold.muted} />
            </View>
            <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
            <Text style={styles.emptyText}>
              Add wineries you'd like to visit to keep track of them here
            </Text>

            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={18} color={colors.neutral.cream} />
              <Text style={styles.exploreButtonText}>Explore Map</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },

  // Custom Screen Header
  screenHeader: {
    backgroundColor: colors.neutral.cream,
    paddingTop: 60, // Safe area for iOS
  },
  screenHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  screenHeaderLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  screenHeaderTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  countBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
  screenHeaderBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginHorizontal: spacing.lg,
  },

  // Section Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold.muted,
  },
  headerLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginHorizontal: spacing.md,
  },
  headerCount: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    textAlign: 'center',
  },

  // Center Container
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.cream,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },

  // List Content
  listContent: {
    padding: spacing.lg,
  },
  wineryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },
  wineryItemLast: {
    marginBottom: 0,
  },
  wineryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  wineryInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  wineryName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
    fontFamily: 'Georgia',
    marginBottom: 2,
  },
  wineryAddress: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginBottom: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
  },
  removeButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.status.error,
  },

  // Empty State
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyInner: {
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  exploreButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Message State
  messageTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
  },
  messageText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    maxWidth: 280,
  },
});
