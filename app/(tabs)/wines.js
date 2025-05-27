// Updated wines.js with comprehensive filtering
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { AuthContext } from '../_layout';

export default function Wines() {
  const [search, setSearch] = useState('');
  const [wines, setWines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
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

  const loadUserWines = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { success, visits } = await visitsService.getUserVisits();
      
      if (success && visits) {
        const allWines = [];
        visits.forEach(visit => {
          if (visit.wines) {
            visit.wines.forEach(wine => {
              allWines.push({
                ...wine,
                wineryName: visit.wineries?.name,
                wineryId: visit.winery_id,
                visitDate: visit.visit_date,
                visitId: visit.id,
                flavorNotes: wine.wine_flavor_notes?.map(fn => fn.flavor_notes?.name) || []
              });
            });
          }
        });
        setWines(allWines);
      }
    } catch (error) {
      console.error('Error loading wines:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateFilterOptions = () => {
    const types = ['All', ...new Set(wines.map(wine => wine.wine_type).filter(Boolean))];
    const wineries = ['All', ...new Set(wines.map(wine => wine.wineryName).filter(Boolean))];
    const varietals = ['All', ...new Set(wines.map(wine => wine.wine_varietal).filter(Boolean))];
    
    setFilterOptions({
      types,
      wineries,
      varietals,
      ratings: ['All', 'Highest to Lowest', 'Lowest to Highest']
    });
  };

  // Apply all filters
  const getFilteredWines = () => {
    let filtered = wines.filter(wine => {
      // Search filter
      const matchesSearch = 
        (wine.wine_name?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wineryName?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wine_type?.toLowerCase().includes(search.toLowerCase()) || '') ||
        (wine.wine_varietal?.toLowerCase().includes(search.toLowerCase()) || '');
      
      // Type filter
      const matchesType = filters.type === 'All' || wine.wine_type === filters.type;
      
      // Winery filter
      const matchesWinery = filters.winery === 'All' || wine.wineryName === filters.winery;
      
      // Varietal filter
      const matchesVarietal = filters.varietal === 'All' || wine.wine_varietal === filters.varietal;
      
      return matchesSearch && matchesType && matchesWinery && matchesVarietal;
    });

    // Apply rating sort
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

  const renderWineItem = ({ item }) => {
    // THIS IS THE NEW LOGIC - determining what to show in bold
    const primaryName = item.wine_name || item.wine_varietal || item.wine_type || 'Unnamed Wine';
    const showVarietal = item.wine_varietal && item.wine_name; // Only show varietal separately if we have both
    
    return (
      <TouchableOpacity 
        style={styles.wineCard}
        onPress={() => navigateToWineDetail(item)}
      >
        <View style={styles.wineImageContainer}>
          <View style={[styles.wineImagePlaceholder, 
            { backgroundColor: 
              item.wine_type === 'Red' ? '#8C1C13' : 
              item.wine_type === 'White' ? '#f9f9f9' : 
              item.wine_type === 'Rosé' ? '#FFB6C1' : 
              item.wine_type === 'Sparkling' ? '#FFD700' : '#E0E0E0'
            }
          ]}>
            <Ionicons 
              name="wine" 
              size={24} 
              color={item.wine_type === 'White' ? '#3E3E3E' : '#fff'} 
            />
          </View>
        </View>
        
        <View style={styles.wineInfo}>
          {/* NEW WAY - Smart primary name display */}
          <Text style={styles.wineName}>
            {primaryName}
            {item.wine_year && ` (${item.wine_year})`}
          </Text>
          
          {/* NEW - Show varietal separately if we have both name and varietal */}
          {showVarietal && (
            <Text style={styles.wineVarietal}>{item.wine_varietal}</Text>
          )}
          
          {/* NEW - Show "Varietal" label if varietal is the primary name */}
          {!item.wine_name && item.wine_varietal && (
            <Text style={styles.wineVarietalSecondary}>Varietal</Text>
          )}
          
          <Text style={styles.wineryName}>{item.wineryName}</Text>
          <Text style={styles.visitDate}>
            Visited: {new Date(item.visitDate).toLocaleDateString()}
          </Text>
          
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star}
                  name={star <= Math.floor(item.overall_rating) ? "star" : star <= item.overall_rating ? "star-half" : "star-outline"} 
                  size={14} 
                  color="#FFD700" 
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{item.overall_rating?.toFixed(1) || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.wineTypeContainer}>
          <Text style={[
            styles.wineTypeText, 
            {
              color: 
                item.wine_type === 'Red' ? '#8C1C13' : 
                item.wine_type === 'White' ? '#3E3E3E' : 
                item.wine_type === 'Rosé' ? '#D23669' : '#3E3E3E'
            }
          ]}>
            {item.wine_type}
          </Text>
        </View>
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
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filter Wines</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#3E3E3E" />
            </TouchableOpacity>
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
        <ActivityIndicator size="large" color="#8C1C13" />
        <Text style={styles.loadingText}>Loading your wines...</Text>
      </View>
    );
  }

  const filteredWines = getFilteredWines();
  const activeFilterCount = getActiveFilterCount();

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} style={styles.searchIcon} />
        <TextInput
          placeholder="Search wines or wineries..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filter Button */}
      <View style={styles.filterButtonContainer}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={20} color="#8C1C13" />
          <Text style={styles.filterButtonText}>
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Text>
        </TouchableOpacity>
        
        {activeFilterCount > 0 && (
          <TouchableOpacity 
            style={styles.clearFiltersSmall}
            onPress={clearAllFilters}
          >
            <Text style={styles.clearFiltersSmallText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Wine List */}
      <FlatList
        data={filteredWines}
        keyExtractor={item => item.id.toString()}
        renderItem={renderWineItem}
        contentContainerStyle={styles.wineList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wine-outline" size={48} color="#8C1C13" />
            <Text style={styles.emptyTitle}>No wines found</Text>
            <Text style={styles.emptyText}>
              {wines.length === 0 
                ? "Start logging your winery visits to see your wines here!"
                : "Try adjusting your search or filters"
              }
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
    backgroundColor: '#E7E3E2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E7E3E2',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#3E3E3E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  searchIcon: {
    marginRight: 10,
    color: '#8C1C13',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#3E3E3E',
  },
  clearButton: {
    padding: 5,
  },
  filterButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#3E3E3E',
    fontWeight: '500',
  },
  clearFiltersSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearFiltersSmallText: {
    color: '#8C1C13',
    fontSize: 14,
    fontWeight: '500',
  },
  wineList: {
    padding: 15,
    backgroundColor: '#E7E3E2',
  },
  wineCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wineImageContainer: {
    marginRight: 15,
  },
  wineImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    color: '#3E3E3E',
  },
  wineVarietal: {
    fontSize: 14,
    color: '#8C1C13',
    fontWeight: '500',
    marginBottom: 2,
  },
  wineVarietalSecondary: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  wineryName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  visitDate: {
    fontSize: 12,
    color: '#8C1C13',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 5,
  },
  ratingText: {
    fontSize: 12,
    color: '#888',
  },
  wineTypeContainer: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  wineTypeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#3E3E3E',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#E7E3E2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 25,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterOptionActive: {
    backgroundColor: '#8C1C13',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#3E3E3E',
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  clearFiltersButton: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  clearFiltersText: {
    color: '#3E3E3E',
    fontSize: 16,
    fontWeight: '500',
  },
  applyFiltersButton: {
    flex: 1,
    backgroundColor: '#8C1C13',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  applyFiltersText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  wineVarietal: {
    fontSize: 14,
    color: '#8C1C13',
    fontWeight: '500',
    marginBottom: 2,
  },
  wineVarietalSecondary: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 2,
  },
});