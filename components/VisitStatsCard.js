// components/VisitStatsCard.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { varietalText } from '../lib/varietals';
import { visitsService } from '../lib/visits';
import { createThemedStyles } from '../styles/ThemeProvider';


const VisitStatsCard = () => {
  const { colors, styles } = useScreenTheme();

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
        // "Places" = distinct real wineries. Location-optional logs have a
        // null winery_id and must not be counted as a place.
        const uniqueWineries = new Set(
          visits.map(v => v.winery_id).filter(Boolean)
        );
        const totalWineries = uniqueWineries.size;

        let totalWines = 0;
        visits.forEach(visit => {
          totalWines += visit.wines?.length || 0;
        });

        // Only surface logs that actually have a tagged place as "visits" —
        // place-less logs would render as blank, nameless rows (#99) and tapping
        // one would crash on a null winery_id (#98). They still appear under
        // Recent Wines below.
        const recentVisits = [...visits]
          .filter(visit => visit.winery_id && visit.wineries?.name)
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

  // visit_date is a date-only value parsed as UTC midnight, so format in UTC
  // too — otherwise it renders a day early west of UTC.
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Never route to a winery detail without a real id (place-less logs) — see #98.
  const goToWinery = (wineryId) => {
    if (!wineryId) return;
    router.push(`/winery/${wineryId}`);
  };
  const goToWine = (wineId) => router.push(`/wine/${wineId}`);

  // Get wine color based on type
  const getWineColor = (wineType) => {
    const type = wineType?.toLowerCase();
    if (type === 'red') return colors.primary.base;
    if (type === 'white') return colors.accent.surface;
    if (type === 'rosé' || type === 'rose') return colors.primary.soft;
    return colors.accent.strong; // Default for sparkling, etc.
  };

  const getWineIconColor = (wineType) => {
    const type = wineType?.toLowerCase();
    if (type === 'white') return colors.neutral.ink;
    return colors.onPrimary;
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
            <Ionicons name="business-outline" size={20} color={colors.primary.ink} />
          </View>
          <Text style={styles.statValue}>{stats.totalWineries}</Text>
          <Text style={styles.statLabel}>Places</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary.ink} />
          </View>
          <Text style={styles.statValue}>{stats.totalVisits}</Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="wine-outline" size={20} color={colors.primary.ink} />
          </View>
          <Text style={styles.statValue}>{stats.totalWines}</Text>
          <Text style={styles.statLabel}>Wines</Text>
        </View>
      </View>

      {/* Recent Visits Section */}
      {stats.recentVisits.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent visits</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/map')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary.ink} />
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
                  <Ionicons name="location" size={18} color={colors.primary.ink} />
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
                  <Ionicons name="chevron-forward" size={16} color={colors.accent.strong} />
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
            <Text style={styles.sectionTitle}>Recent wines</Text>
            <TouchableOpacity
              onPress={() => router.push('/wines')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary.ink} />
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
                    {wine.wine_name || varietalText(wine.wine_varietal) || wine.wine_type || 'Unnamed Wine'}
                  </Text>
                  <Text style={styles.listItemSubtitle} numberOfLines={1}>
                    {wine.wineryName ? `${wine.wineryName} · ` : ''}{formatDate(wine.visitDate)}
                  </Text>
                </View>
                <View style={styles.listItemArrow}>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent.strong} />
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
            <Ionicons name="wine-outline" size={32} color={colors.accent.border} />
          </View>
          <Text style={styles.emptyTitle}>Begin your journey</Text>
          <Text style={styles.emptySubtitle}>
            Visit a winery to start tracking your wine discoveries
          </Text>
        </View>
      )}
    </View>
  );
};


export default VisitStatsCard;


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
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
    backgroundColor: colors.primary.base,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  loadingText: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
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
    backgroundColor: colors.accent.border,
  },
  headerLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
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
    backgroundColor: colors.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.neutral.ink,
    fontFamily: SERIF,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.accent.border,
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
    borderBottomColor: colors.neutral.divider,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontWeight: '500',
  },

  // List Styles
  listContainer: {
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.divider,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    // Supporting purple tint keeps the summary card legible in both modes.
    backgroundColor: colors.primary.surface,
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
    borderColor: colors.neutral.border,
  },
  listItemContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  listItemTitle: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '500',
    marginBottom: 2,
  },
  listItemSubtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
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
    backgroundColor: colors.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    maxWidth: 240,
  },
});
return { colors, styles };
});
