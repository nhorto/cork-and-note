// app/(tabs)/wines.js (Enhanced Wines Screen)
import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  FlatList, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// In a real app, this would come from your database or API
// This is sample data only
const sampleWines = [
  { 
    id: '1', 
    name: 'Chardonnay', 
    winery: 'Early Mountain Vineyards', 
    wineryId: 88,
    type: 'White',
    year: '2021',
    rating: 4.5,
    image: 'https://example.com/chardonnay.jpg'
  },
  { 
    id: '2', 
    name: 'Cabernet Franc', 
    winery: 'King Family Vineyards', 
    wineryId: 146,
    type: 'Red',
    year: '2019',
    rating: 4.7,
    image: 'https://example.com/cabernet.jpg'
  },
  { 
    id: '3', 
    name: 'Viognier', 
    winery: 'Barboursville Vineyards', 
    wineryId: 18,
    type: 'White',
    year: '2020',
    rating: 4.3,
    image: 'https://example.com/viognier.jpg'
  },
  { 
    id: '4', 
    name: 'Petit Verdot', 
    winery: 'Veritas Vineyards and Winery', 
    wineryId: 278,
    type: 'Red',
    year: '2018',
    rating: 4.6,
    image: 'https://example.com/verdot.jpg'
  },
  { 
    id: '5', 
    name: 'Rosé', 
    winery: 'Pippin Hill Farm & Vineyards', 
    wineryId: 198,
    type: 'Rosé',
    year: '2022',
    rating: 4.2,
    image: 'https://example.com/rose.jpg'
  },
];

export default function Wines() {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const router = useRouter();

  // Define wine type filters
  const wineTypes = ['All', 'Red', 'White', 'Rosé', 'Sparkling'];

  // Filter wines based on search text and wine type
  const filteredWines = sampleWines.filter(wine => {
    const matchesSearch = 
      wine.name.toLowerCase().includes(search.toLowerCase()) ||
      wine.winery.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = selectedFilter === 'All' || wine.type === selectedFilter;
    
    return matchesSearch && matchesType;
  });

  const navigateToWinery = (wineryId) => {
    router.push(`/winery/${wineryId}`);
  };

  // Render a wine item
  const renderWineItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.wineCard}
      onPress={() => navigateToWinery(item.wineryId)}
    >
      <View style={styles.wineImageContainer}>
        {/* In a real app, you'd use actual images */}
        <View style={[styles.wineImagePlaceholder, 
          { backgroundColor: 
            item.type === 'Red' ? '#8E2DE2' : 
            item.type === 'White' ? '#f9f9f9' : 
            item.type === 'Rosé' ? '#FFC0CB' : '#E0E0E0'
          }
        ]}>
          <Ionicons name="wine" size={24} color={item.type === 'White' ? '#333' : '#fff'} />
        </View>
      </View>
      
      <View style={styles.wineInfo}>
        <Text style={styles.wineName}>{item.name} ({item.year})</Text>
        <Text style={styles.wineryName}>{item.winery}</Text>
        
        <View style={styles.ratingContainer}>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map(star => (
              <Ionicons 
                key={star}
                name={star <= Math.floor(item.rating) ? "star" : star <= item.rating ? "star-half" : "star-outline"} 
                size={14} 
                color="#FFD700" 
              />
            ))}
          </View>
          <Text style={styles.ratingText}>{item.rating}</Text>
        </View>
      </View>
      
      <View style={styles.wineType}>
        <Text style={[
          styles.wineTypeText, 
          {
            color: 
              item.type === 'Red' ? '#8E2DE2' : 
              item.type === 'White' ? '#333' : 
              item.type === 'Rosé' ? '#D23669' : '#333'
          }
        ]}>
          {item.type}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#777" style={styles.searchIcon} />
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
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={wineTypes}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === item && styles.filterTextActive
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
      
      {/* Wine List */}
      <FlatList
        data={filteredWines}
        keyExtractor={item => item.id}
        renderItem={renderWineItem}
        contentContainerStyle={styles.wineList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wine-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No wines found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  filterButtonActive: {
    backgroundColor: '#8E2DE2',
  },
  filterText: {
    fontSize: 14,
    color: '#555',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  wineList: {
    padding: 15,
  },
  wineCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  },
  wineryName: {
    fontSize: 14,
    color: '#666',
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
  wineType: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  wineTypeText: {
    fontSize: 13,
    fontWeight: '600'}})