// components/VisitStatsCard.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { visitsService } from '../lib/visits';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const VisitStatsCard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWineries: 0,
    totalVisits: 0,
    totalWines: 0,
    recentVisits: [],
    recentWines: []
  });
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      setLoading(true);
      const { success, visits } = await visitsService.getUserVisits();

      if (success && visits) {
        const totalVisits = visits.length;
        const uniqueWineries = new Set();
        visits.forEach(visit => uniqueWineries.add(visit.winery_id));
        const totalWineries = uniqueWineries.size;

        let totalWines = 0;
        visits.forEach(visit => {
          totalWines += visit.wines?.length || 0;
        });

        const recentVisits = [...visits]
          .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
          .slice(0, 3);

        const allWines = [];
        visits.forEach(visit => {
          if (visit.wines && visit.wines.length > 0) {
            visit.wines.forEach(wine => {
              allWines.push({
                ...wine,
                wineryName: visit.wineries?.name,
                visitDate: visit.visit_date
              });
            });
          }
        });

        const recentWines = allWines
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3);

        setStats({ totalWineries, totalVisits, totalWines, recentVisits, recentWines });
      }
    } catch (error) {
      console.error('Error loading visit stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const goToWinery = (wineryId) => router.push(`/winery/${wineryId}`);
  const goToWine = (wineId) => router.push(`/wine/${wineId}`);

  // Get wine color based on type
  const getWineColor = (wineType) => {
    const type = wineType?.toLowerCase();
    if (type === 'red') return colors.primary.burgundy;
    if (type === 'white') return colors.gold.light;
    if (type === 'rosé' || type === 'rose') return colors.primary.rosé;
    return colors.gold.shimmer; // Default for sparkling, etc.
  };

  const getWineIconColor = (wineType) => {
    const type = wineType?.toLowerCase();
    if (type === 'white') return colors.neutral.charcoal;
    return colors.neutral.cream;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <View style={styles.loadingDot} />
          <Text style={styles.loadingText}>Loading your journey...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Decorative Header */}
      <View style={styles.headerDecoration}>
        <View style={styles.decorativeLine} />
        <Text style={styles.headerLabel}>YOUR JOURNEY</Text>
        <View style={styles.decorativeLine} />
      </View>

      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="business-outline" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.statValue}>{stats.totalWineries}</Text>
          <Text style={styles.statLabel}>Châteaux</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.statValue}>{stats.totalVisits}</Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="wine-outline" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.statValue}>{stats.totalWines}</Text>
          <Text style={styles.statLabel}>Wines</Text>
        </View>
      </View>

      {/* Recent Visits Section */}
      {stats.recentVisits.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Visits</Text>
            <TouchableOpacity
              onPress={() => router.push('/wines')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary.burgundy} />
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {stats.recentVisits.map((visit, index) => (
              <TouchableOpacity
                key={visit.id}
                style={[
                  styles.listItem,
                  index === stats.recentVisits.length - 1 && styles.listItemLast
                ]}
                onPress={() => goToWinery(visit.winery_id)}
                activeOpacity={0.7}
              >
                <View style={styles.listItemIcon}>
                  <Ionicons name="location" size={18} color={colors.primary.burgundy} />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    {visit.wineries?.name}
                  </Text>
                  <Text style={styles.listItemSubtitle}>
                    {formatDate(visit.visit_date)}
                  </Text>
                </View>
                <View style={styles.listItemArrow}>
                  <Ionicons name="chevron-forward" size={16} color={colors.gold.shimmer} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recent Wines Section */}
      {stats.recentWines.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Wines</Text>
            <TouchableOpacity
              onPress={() => router.push('/wines')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary.burgundy} />
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {stats.recentWines.map((wine, index) => (
              <TouchableOpacity
                key={wine.id}
                style={[
                  styles.listItem,
                  index === stats.recentWines.length - 1 && styles.listItemLast
                ]}
                onPress={() => goToWine(wine.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.wineColorDot,
                  { backgroundColor: getWineColor(wine.wine_type) }
                ]}>
                  <Ionicons
                    name="wine"
                    size={14}
                    color={getWineIconColor(wine.wine_type)}
                  />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    {wine.wine_name || wine.wine_varietal || wine.wine_type || 'Unnamed Wine'}
                  </Text>
                  <Text style={styles.listItemSubtitle} numberOfLines={1}>
                    {wine.wineryName} · {formatDate(wine.visitDate)}
                  </Text>
                </View>
                <View style={styles.listItemArrow}>
                  <Ionicons name="chevron-forward" size={16} color={colors.gold.shimmer} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Empty State */}
      {stats.recentVisits.length === 0 && stats.recentWines.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="wine-outline" size={32} color={colors.gold.muted} />
          </View>
          <Text style={styles.emptyTitle}>Begin Your Journey</Text>
          <Text style={styles.emptySubtitle}>
            Visit a winery to start tracking your wine discoveries
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },

  // Loading State
  loadingState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.burgundy,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  loadingText: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },

  // Header Decoration
  headerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  statLabel: {
    ...typography.body.caption,
    color: colors.neutral.pewter,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.gold.muted,
    opacity: 0.5,
  },

  // Section Styles
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
  },

  // List Styles
  listContainer: {
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.linen,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.rosé,
    opacity: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  wineColorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  listItemContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  listItemTitle: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
    marginBottom: 2,
  },
  listItemSubtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  listItemArrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    textAlign: 'center',
    maxWidth: 240,
  },
});

export default VisitStatsCard;
