// Updated wines.js with comprehensive filtering
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Chip from '../../components/Chip';
import LogFab from '../../components/LogFab';
import ScreenHeader from '../../components/ScreenHeader';
import WinesFilterModal from '../../components/WinesFilterModal';
import { cellarService } from '../../lib/cellar';
import { matchWineToCellar } from '../../lib/cellarMatch';
import { MIN_DISTINCT_FOR_REPORT, distinctRatedCount } from '../../lib/tasteProfile';
import { varietalText } from '../../lib/varietals';
import { visitsService } from '../../lib/visits';
import { wineDisplayName } from '../../lib/wineDisplay';
import {
  EMPTY_FILTERS,
  SORTS,
  activeFilterCount,
  applyFilters,
  applySort,
  facetOptions,
} from '../../lib/winesBrowse';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


export default function Wines() {
  const { colors, styles } = useScreenTheme();

  const [search, setSearch] = useState('');
  const [wines, setWines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters (multi-select facets, committed by the sheet's Apply) and sort —
  // split apart per #170 Layer C; pure logic lives in lib/winesBrowse.js.
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('recent');

  const router = useRouter();
  const { user } = useContext(AuthContext);

  // Quiet "See your taste" link once there is enough rated to report on
  // (research doc 2026-09-11 §3). Counted from the rows already loaded.
  const showTasteLink = useMemo(
    () => distinctRatedCount(wines) >= MIN_DISTINCT_FOR_REPORT,
    [wines]
  );

  // Reload whenever the tab gains focus so wines logged elsewhere show up
  // without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      loadUserWines();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadUserWines = async (isRefresh = false) => {         
    if (!user) {
      isRefresh ? setRefreshing(false) : setLoading(false);
      return;
    }

    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(false);

      // Both reads are cached (#83), so cross-referencing tasted wines against
      // the cellar to badge owned wines (#117) costs no extra DB round-trips.
      const [{ success, visits }, cellarRes] = await Promise.all([
        visitsService.getUserVisits(),
        cellarService.getCellar(),
      ]);
      const cellarBottles = cellarRes?.success ? cellarRes.bottles : [];
      // The service resolves { success: false } on a handled failure instead
      // of throwing; that is still a failure, not an empty journal.
      if (!success) {
        setError(true);
        return;
      }
      if (visits) {
        const allWines = [];
        visits.forEach((visit) => {
          if (visit.wines) {
            visit.wines.forEach((wine) => {
              allWines.push({
                ...wine,
                // Non-winery logs have no linked winery — fall back to the
                // session's place name, then the wine's winemaker (#21).
                wineryName:
                  visit.wineries?.name ||
                  visit.place_name ||
                  wine.winemaker ||
                  null,
                wineryId: visit.winery_id,
                visitDate: visit.visit_date,
                visitId: visit.id,
                flavorNotes:
                  wine.wine_flavor_notes?.map((fn) => fn.flavor_notes?.name) ||
                  [],
                // null when not owned; otherwise { primary, count, relation, ... }
                cellarMatch: matchWineToCellar(wine, cellarBottles),
              });
            });
          }
        });
        setWines(allWines);
      }
    } catch (error) {
      console.error('Error loading wines:', error);
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  const handleRefresh = () => loadUserWines(true); 

  // Free-text search over name / winery / type / varietal.
  const getSearchedWines = () => {
    const q = search.trim().toLowerCase();
    if (!q) return wines;
    return wines.filter((wine) =>
      [
        wine.wine_name,
        wine.wineryName,
        wine.wine_type,
        varietalText(wine.wine_varietal),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  };

  const navigateToWineDetail = (wine) => {
    router.push(`/wine/${wine.id}`);
  };

  // Get wine type color
  const getWineTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'red':
      case 'red blend':
        return colors.primary.base;
      case 'white':
      case 'white blend':
        return colors.accent.base;
      case 'rosé':
        return colors.primary.soft;
      case 'sparkling':
        return colors.accent.strong;
      default:
        return colors.neutral.inkTertiary;
    }
  };

  const renderWineItem = ({ item }) => {
    const primaryName = wineDisplayName(item);
    const varietalLabel = varietalText(item.wine_varietal);
    const showVarietal = varietalLabel && item.wine_name;
    const wineColor = getWineTypeColor(item.wine_type);

    return (
      <TouchableOpacity style={styles.wineCard} onPress={() => navigateToWineDetail(item)} activeOpacity={0.7}>
        <View style={styles.wineImageContainer}>
          <View style={[styles.wineImagePlaceholder, { backgroundColor: wineColor }]}>
            <Ionicons
              name="wine"
              size={22}
              color={item.wine_type === 'White' ? colors.neutral.ink : colors.onPrimary}
            />
          </View>
        </View>

        <View style={styles.wineInfo}>
          <Text style={styles.wineName}>
            {primaryName}
            {item.wine_year && ` (${item.wine_year})`}
          </Text>

          {showVarietal && (
            <Text style={styles.wineVarietal}>{varietalLabel}</Text>
          )}

          <Text style={styles.wineryName}>{item.wineryName}</Text>
          <Text style={styles.visitDate}>
            {new Date(item.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </Text>

          {/* Badge: this tasted wine is also in the cellar (#117). */}
          {item.cellarMatch ? (
            <View style={styles.cellarBadge}>
              <Ionicons name="file-tray-stacked" size={11} color={colors.accent.base} />
              <Text style={styles.cellarBadgeText}>
                {item.cellarMatch.relation === 'same' ? 'In your cellar' : 'In cellar · other vintage'}
              </Text>
            </View>
          ) : null}

          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={
                    star <= Math.floor(item.overall_rating)
                      ? 'star'
                      : star <= item.overall_rating
                      ? 'star-half'
                      : 'star-outline'
                  }
                  size={14}
                  color={colors.accent.base}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {item.overall_rating?.toFixed(1) || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={[styles.wineTypeIndicator, { backgroundColor: wineColor }]} />
      </TouchableOpacity>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="wine-outline" size={32} color={colors.accent.border} />
        </View>
        <Text style={styles.loadingText}>Loading your wines...</Text>
      </View>
    );
  }

  const searchedWines = getSearchedWines();
  // Facets reflect the search-narrowed set, so the sheet only offers choices
  // that exist and its counts are live.
  const facets = facetOptions(searchedWines);
  const filteredWines = applySort(applyFilters(searchedWines, filters), sort);
  const filterCount = activeFilterCount(filters);

  return (
    <View style={styles.container}>
      {/* Journal tab root (flat-five bar, #203) — no back chevron;
          "Your tastings" is the one vocabulary (#170 item 8). */}
      <ScreenHeader
        title="Your tastings"
        showBack={false}
        right={
          <TouchableOpacity
            style={[
              styles.filterHeaderButton,
              filterCount > 0 && styles.filterHeaderButtonActive
            ]}
            onPress={() => setShowFilters(true)}
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filterCount > 0 ? colors.onPrimary : colors.neutral.ink}
            />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={colors.primary.ink} style={styles.searchIcon} />
          <TextInput
            placeholder="Search wines or wineries..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={colors.neutral.placeholder}
            selectionColor={colors.primary.ink}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.neutral.inkTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Count & Sort — sort lives on the screen, not in the filter
          sheet (#170 Layer C). */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          {filteredWines.length} {filteredWines.length === 1 ? 'wine' : 'wines'}
        </Text>
        <View style={styles.sortRow}>
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              selected={sort === s.key}
              onPress={() => setSort(s.key)}
            />
          ))}
        </View>
      </View>
      
      {/* Wine List */}
      <FlatList
        data={filteredWines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderWineItem}
        contentContainerStyle={styles.wineList}
        onRefresh={handleRefresh}                // NEW
        refreshing={refreshing}                  // NEW
        ListHeaderComponent={
          showTasteLink ? (
            <TouchableOpacity
              style={styles.tasteLink}
              onPress={() => router.push('/sommelier/taste')}
              accessibilityRole="button"
              accessibilityLabel="See your taste"
              testID="see-your-taste"
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.accent.ink} />
              <Text style={styles.tasteLinkText}>See your taste</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.neutral.inkTertiary} />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.accent.border} />
              </View>
              <Text style={styles.emptyTitle}>Couldn&apos;t load your wines</Text>
              <Text style={styles.emptyText}>
                Something went wrong. Check your connection and try again.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadUserWines()}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="wine-outline" size={40} color={colors.accent.border} />
              </View>
              <Text style={styles.emptyTitle}>No wines found</Text>
              <Text style={styles.emptyText}>
                {wines.length === 0
                  ? 'Start logging your winery visits to see your wines here!'
                  : 'Try adjusting your search or filters'}
              </Text>
            </View>
          )
        }
      />

      <WinesFilterModal
        visible={showFilters}
        wines={searchedWines}
        facets={facets}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setShowFilters(false);
        }}
        onClose={() => setShowFilters(false)}
      />

      <LogFab />
    </View>
  );
}



const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },

  filterHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  filterHeaderButtonActive: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onAccent,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.bg,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.bg,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    ...typography.body.regular,
    color: colors.neutral.ink,
  },
  clearButton: {
    padding: spacing.xs,
  },

  // Results Bar
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.neutral.bg,
  },
  resultsCount: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // "See your taste" quiet row above the list
  tasteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  tasteLinkText: {
    ...typography.body.small,
    color: colors.accent.ink,
    fontWeight: '600',
    flex: 1,
  },

  // Wine List
  wineList: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.neutral.bg,
  },
  wineCard: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.soft,
    overflow: 'hidden',
  },
  wineImageContainer: {
    marginRight: spacing.md,
  },
  wineImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: 2,
  },
  wineVarietal: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontWeight: '500',
    marginBottom: 2,
  },
  wineryName: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginBottom: 2,
  },
  visitDate: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginBottom: spacing.xs,
  },
  cellarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  cellarBadgeText: {
    ...typography.body.caption,
    color: colors.neutral.ink,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: spacing.xs,
  },
  ratingText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    fontWeight: '500',
  },
  wineTypeIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.surface,
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
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 280,
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '600',
  },

});
return { colors, styles };
});
