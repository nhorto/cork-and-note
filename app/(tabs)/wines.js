// Updated wines.js with comprehensive filtering
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { visitsService } from '../../lib/visits';
import { wineDisplayName } from '../../lib/wineDisplay';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function Wines() {
  const [search, setSearch] = useState('');
  const [wines, setWines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);  
  
  // Filter states
  const [filters, setFilters] = useState({
    type: 'All',
    winery: 'All',
    varietal: 'All',
    rating: 'All'
  });
  
  const router = useRouter();
  const { user } = useContext(AuthContext);

  // Get unique values for filter options
  const [filterOptions, setFilterOptions] = useState({
    types: ['All'],
    wineries: ['All'],
    varietals: ['All'],
    ratings: ['All', 'Highest to Lowest', 'Lowest to Highest']
  });

  useEffect(() => {
    loadUserWines();
  }, [user]);

  useEffect(() => {
    if (wines.length > 0) {
      generateFilterOptions();
    }
  }, [wines]);

  const loadUserWines = async (isRefresh = false) => {         
    if (!user) {
      isRefresh ? setRefreshing(false) : setLoading(false);
      return;
    }

    try {
      isRefresh ? setRefreshing(true) : setLoading(true);

      const { success, visits } = await visitsService.getUserVisits();
      if (success && visits) {
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
              });
            });
          }
        });
        setWines(allWines);
      }
    } catch (error) {
      console.error('Error loading wines:', error);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  const handleRefresh = () => loadUserWines(true); 

  const generateFilterOptions = () => {
    const types = ['All', ...new Set(wines.map((w) => w.wine_type).filter(Boolean))];
    const wineries = [
      'All',
      ...new Set(wines.map((w) => w.wineryName).filter(Boolean)),
    ];
    const varietals = [
      'All',
      ...new Set(wines.map((w) => w.wine_varietal).filter(Boolean)),
    ];

    setFilterOptions({
      types,
      wineries,
      varietals,
      ratings: ['All', 'Highest to Lowest', 'Lowest to Highest'],
    });
  };

  const getFilteredWines = () => {
    let filtered = wines.filter((wine) => {
      const matchesSearch =
        (wine.wine_name?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wineryName?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wine_type?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wine_varietal?.toLowerCase().includes(search.toLowerCase()) || '');

      const matchesType = filters.type === 'All' || wine.wine_type === filters.type;
      const matchesWinery =
        filters.winery === 'All' || wine.wineryName === filters.winery;
      const matchesVarietal =
        filters.varietal === 'All' || wine.wine_varietal === filters.varietal;

      return matchesSearch && matchesType && matchesWinery && matchesVarietal;
    });

    if (filters.rating === 'Highest to Lowest') {
      filtered.sort((a, b) => (b.overall_rating || 0) - (a.overall_rating || 0));
    } else if (filters.rating === 'Lowest to Highest') {
      filtered.sort((a, b) => (a.overall_rating || 0) - (b.overall_rating || 0));
    }

    return filtered;
  };

  const clearAllFilters = () => {
    setFilters({
      type: 'All',
      winery: 'All',
      varietal: 'All',
      rating: 'All'
    });
    setSearch('');
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== 'All').length;
  };

  const navigateToWineDetail = (wine) => {
    router.push(`/wine/${wine.id}`);
  };

  // Get wine type color
  const getWineTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'red':
      case 'red blend':
        return colors.primary.burgundy;
      case 'white':
      case 'white blend':
        return colors.gold.rich;
      case 'rosé':
        return colors.primary.rosé;
      case 'sparkling':
        return colors.gold.shimmer;
      default:
        return colors.neutral.pewter;
    }
  };

  const renderWineItem = ({ item }) => {
    const primaryName = wineDisplayName(item);
    const showVarietal = item.wine_varietal && item.wine_name;
    const wineColor = getWineTypeColor(item.wine_type);

    return (
      <TouchableOpacity style={styles.wineCard} onPress={() => navigateToWineDetail(item)} activeOpacity={0.7}>
        <View style={styles.wineImageContainer}>
          <View style={[styles.wineImagePlaceholder, { backgroundColor: wineColor }]}>
            <Ionicons
              name="wine"
              size={22}
              color={item.wine_type === 'White' ? colors.neutral.charcoal : colors.neutral.cream}
            />
          </View>
        </View>

        <View style={styles.wineInfo}>
          <Text style={styles.wineName}>
            {primaryName}
            {item.wine_year && ` (${item.wine_year})`}
          </Text>

          {showVarietal && (
            <Text style={styles.wineVarietal}>{item.wine_varietal}</Text>
          )}

          <Text style={styles.wineryName}>{item.wineryName}</Text>
          <Text style={styles.visitDate}>
            {new Date(item.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>

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
                  color={colors.gold.rich}
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

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModal}>
          {/* Modal Header */}
          <View style={styles.filterHeader}>
            <View style={styles.filterHeaderIcon}>
              <Ionicons name="options" size={20} color={colors.primary.burgundy} />
            </View>
            <Text style={styles.filterTitle}>Filter Wines</Text>
            <TouchableOpacity
              style={styles.filterCloseButton}
              onPress={() => setShowFilters(false)}
            >
              <Ionicons name="close" size={22} color={colors.neutral.charcoal} />
            </TouchableOpacity>
          </View>

          {/* Decorative Divider */}
          <View style={styles.filterDivider}>
            <View style={styles.filterDividerLine} />
            <View style={styles.filterDividerDiamond} />
            <View style={styles.filterDividerLine} />
          </View>
          
          <ScrollView style={styles.filterContent}>
            {/* Wine Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Wine Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {filterOptions.types.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        filters.type === type && styles.filterOptionActive
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, type }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.type === type && styles.filterOptionTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Winery Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Winery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {filterOptions.wineries.map(winery => (
                    <TouchableOpacity
                      key={winery}
                      style={[
                        styles.filterOption,
                        filters.winery === winery && styles.filterOptionActive
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, winery }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.winery === winery && styles.filterOptionTextActive
                      ]}>
                        {winery}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Varietal Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Varietal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {filterOptions.varietals.map(varietal => (
                    <TouchableOpacity
                      key={varietal}
                      style={[
                        styles.filterOption,
                        filters.varietal === varietal && styles.filterOptionActive
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, varietal }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.varietal === varietal && styles.filterOptionTextActive
                      ]}>
                        {varietal}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Rating Sort Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Sort by Rating</Text>
              <View style={styles.filterOptions}>
                {filterOptions.ratings.map(rating => (
                  <TouchableOpacity
                    key={rating}
                    style={[
                      styles.filterOption,
                      filters.rating === rating && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, rating }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.rating === rating && styles.filterOptionTextActive
                    ]}>
                      {rating}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.filterActions}>
            <TouchableOpacity 
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyFiltersButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyFiltersText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="wine-outline" size={32} color={colors.gold.muted} />
        </View>
        <Text style={styles.loadingText}>Loading your wines...</Text>
      </View>
    );
  }

  const filteredWines = getFilteredWines();
  const activeFilterCount = getActiveFilterCount();

  return (
    <View style={styles.container}>
      {/* Custom Screen Header */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderContent}>
          <View style={styles.screenHeaderLeft}>
            <Ionicons name="wine" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.screenHeaderTitle}>My Wines</Text>
          <TouchableOpacity
            style={[
              styles.filterHeaderButton,
              activeFilterCount > 0 && styles.filterHeaderButtonActive
            ]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? colors.neutral.cream : colors.neutral.charcoal}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.screenHeaderBorder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={colors.primary.burgundy} style={styles.searchIcon} />
          <TextInput
            placeholder="Search wines or wineries..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={colors.neutral.silver}
            selectionColor={colors.primary.burgundy}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.neutral.pewter} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Count & Quick Filter */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          {filteredWines.length} {filteredWines.length === 1 ? 'wine' : 'wines'}
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearAllFilters}>
            <Text style={styles.clearFiltersSmallText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Wine List */}
      <FlatList
        data={filteredWines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderWineItem}
        contentContainerStyle={styles.wineList}
        onRefresh={handleRefresh}                // NEW
        refreshing={refreshing}                  // NEW
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wine-outline" size={40} color={colors.gold.muted} />
            </View>
            <Text style={styles.emptyTitle}>No wines found</Text>
            <Text style={styles.emptyText}>
              {wines.length === 0
                ? 'Start logging your winery visits to see your wines here!'
                : 'Try adjusting your search or filters'}
            </Text>
          </View>
        }
      />

      {renderFilterModal()}
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
    paddingTop: 60,
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
  filterHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  filterHeaderButtonActive: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold.rich,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral.cream,
  },
  screenHeaderBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginHorizontal: spacing.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.cream,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
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
    backgroundColor: colors.neutral.cream,
  },
  resultsCount: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  clearFiltersSmallText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
  },

  // Wine List
  wineList: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.neutral.cream,
  },
  wineCard: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
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
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: 2,
  },
  wineVarietal: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
    marginBottom: 2,
  },
  wineryName: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginBottom: 2,
  },
  visitDate: {
    ...typography.body.caption,
    color: colors.neutral.silver,
    marginBottom: spacing.xs,
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
    color: colors.neutral.graphite,
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
    backgroundColor: colors.neutral.parchment,
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
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 280,
  },

  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    minHeight: '60%',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  filterTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  filterCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  filterDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold.muted,
  },
  filterDividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold.rich,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },
  filterContent: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  filterSection: {
    marginBottom: spacing.lg,
  },
  filterSectionTitle: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    backgroundColor: colors.neutral.parchment,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  filterOptionActive: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  filterOptionText: {
    ...typography.body.small,
    color: colors.neutral.charcoal,
  },
  filterOptionTextActive: {
    color: colors.neutral.cream,
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
    backgroundColor: colors.neutral.cream,
    paddingBottom: 34, // Safe area
  },
  clearFiltersButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
  },
  clearFiltersText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontWeight: '500',
  },
  applyFiltersButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginLeft: spacing.sm,
    backgroundColor: colors.primary.burgundy,
  },
  applyFiltersText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
});