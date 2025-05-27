// app/wine/[id].js - Wine Detail Screen
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { visitsService } from '../../lib/visits';

export default function WineDetail() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const [wine, setWine] = useState(null);
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWineDetails();
  }, [id]);

  const loadWineDetails = async () => {
    try {
      setLoading(true);
      // Get all user visits and find the wine
      const { success, visits } = await visitsService.getUserVisits();
      
      if (success && visits) {
        let foundWine = null;
        let foundVisit = null;
        
        // Search through all visits to find the wine
        visits.forEach(visit => {
          if (visit.wines) {
            const wineInVisit = visit.wines.find(w => w.id === id);
            if (wineInVisit) {
              foundWine = {
                ...wineInVisit,
                flavorNotes: wineInVisit.wine_flavor_notes?.map(fn => fn.flavor_notes?.name) || []
              };
              foundVisit = visit;
            }
          }
        });
        
        setWine(foundWine);
        setVisit(foundVisit);
      }
    } catch (error) {
      console.error('Error loading wine details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get color based on wine type
  const getWineTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'red':
      case 'red blend':
        return '#8C1C13';
      case 'white':
      case 'white blend':
        return '#f9f9f9';
      case 'rosé':
        return '#FFB6C1';
      case 'sparkling':
        return '#FFD700';
      case 'dessert':
        return '#D2691E';
      case 'orange':
        return '#FFA500';
      default:
        return '#8C1C13';
    }
  };

  // Helper to generate star rating display
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      let iconName = 'star-outline';
      if (i < fullStars) {
        iconName = 'star';
      } else if (i === fullStars && hasHalfStar) {
        iconName = 'star-half';
      }
      
      stars.push(
        <Ionicons 
          key={i} 
          name={iconName} 
          size={24} 
          color="#FFD700" 
          style={{ marginRight: 4 }}
        />
      );
    }
    
    return (
      <View style={styles.starContainer}>
        {stars}
      </View>
    );
  };

  // Render wine attributes
  const renderWineAttributes = () => {
    if (!wine) return null;
    
    const attributes = [
      { name: 'Sweetness', value: parseFloat(wine.sweetness) || 0 },
      { name: 'Tannin', value: parseFloat(wine.tannin) || 0 },
      { name: 'Acidity', value: parseFloat(wine.acidity) || 0 },
      { name: 'Body', value: parseFloat(wine.body) || 0 },
      { name: 'Alcohol', value: parseFloat(wine.alcohol) || 0 }
    ];
    
    return (
      <View style={styles.attributesContainer}>
        <Text style={styles.sectionTitle}>Wine Profile</Text>
        <View style={styles.attributesList}>
          {attributes.map((attr, index) => (
            <View key={index} style={styles.attributeItem}>
              <Text style={styles.attributeName}>{attr.name}</Text>
              <View style={styles.attributeBarContainer}>
                <View style={[styles.attributeBar, { width: `${(attr.value / 5) * 100}%` }]} />
              </View>
              <Text style={styles.attributeValue}>{attr.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render flavor notes
  const renderFlavorNotes = () => {
    if (!wine?.flavorNotes || wine.flavorNotes.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.flavorContainer}>
        <Text style={styles.sectionTitle}>Flavor Notes</Text>
        <View style={styles.tagsContainer}>
          {wine.flavorNotes.map((note, index) => (
            <View key={index} style={styles.flavorTag}>
              <Text style={styles.flavorTagText}>{note}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8C1C13" />
          <Text style={styles.loadingText}>Loading wine details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!wine) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#3E3E3E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wine Not Found</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Wine not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#3E3E3E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wine Details</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wine Header */}
        <View style={styles.wineHeader}>
          <View style={styles.wineImageContainer}>
            {wine.photo_url ? (
              <Image source={{ uri: wine.photo_url }} style={styles.wineImage} />
            ) : (
              <View style={[
                styles.wineImagePlaceholder,
                { backgroundColor: getWineTypeColor(wine.wine_type) }
              ]}>
                <Ionicons 
                  name="wine" 
                  size={80} 
                  color={wine.wine_type?.toLowerCase() === 'white' ? '#3E3E3E' : '#fff'} 
                />
              </View>
            )}
          </View>
          
          <View style={styles.wineInfo}>
            <Text style={styles.wineName}>
              {wine.wine_name || wine.wine_type || 'Unnamed Wine'}
            </Text>
            {wine.wine_varietal && (
              <Text style={styles.wineVarietal}>{wine.wine_varietal}</Text>
            )}
            {wine.wine_year && (
              <Text style={styles.wineYear}>{wine.wine_year}</Text>
            )}
            <View style={[
              styles.typeIndicator,
              { backgroundColor: getWineTypeColor(wine.wine_type) }
            ]}>
              <Text style={[
                styles.typeText,
                { color: wine.wine_type?.toLowerCase() === 'white' ? '#3E3E3E' : '#fff' }
              ]}>
                {wine.wine_type}
              </Text>
            </View>
          </View>
        </View>

        {/* Winery Info */}
        <View style={styles.wineryInfo}>
          <Text style={styles.wineryLabel}>From:</Text>
          <TouchableOpacity 
            onPress={() => router.push(`/winery/${visit?.winery_id}`)}
            style={styles.wineryButton}
          >
            <Text style={styles.wineryName}>{visit?.wineries?.name}</Text>
            <Ionicons name="chevron-forward" size={16} color="#8C1C13" />
          </TouchableOpacity>
          <Text style={styles.visitDate}>
            Visited: {new Date(visit?.visit_date).toLocaleDateString()}
          </Text>
        </View>

        {/* Overall Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Overall Rating</Text>
          <View style={styles.overallRating}>
            {renderStars(wine.overall_rating)}
            <Text style={styles.ratingValue}>
              {wine.overall_rating?.toFixed(1) || 'N/A'}/5
            </Text>
          </View>
        </View>

        {/* Wine Attributes */}
        {renderWineAttributes()}

        {/* Flavor Notes */}
        {renderFlavorNotes()}

        {/* Additional Notes */}
        {wine.additional_notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.sectionTitle}>Tasting Notes</Text>
            <Text style={styles.notes}>{wine.additional_notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#3E3E3E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#E7E3E2',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E3E3E',
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#3E3E3E',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  wineHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wineImageContainer: {
    marginRight: 16,
  },
  wineImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  wineImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  wineName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  wineVarietal: {
    fontSize: 16,
    color: '#8C1C13',
    fontWeight: '500',
    marginBottom: 2,
  },
  wineYear: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  typeIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  wineryInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wineryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  wineryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  wineryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8C1C13',
    marginRight: 4,
  },
  visitDate: {
    fontSize: 14,
    color: '#666',
  },
  ratingSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 10,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  attributesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  attributesList: {
    marginTop: 5,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attributeName: {
    width: 80,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  attributeBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  attributeBar: {
    height: '100%',
    backgroundColor: '#8C1C13',
    borderRadius: 4,
  },
  attributeValue: {
    width: 30,
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    fontWeight: '500',
  },
  flavorContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flavorTag: {
    backgroundColor: 'rgba(140, 28, 19, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  flavorTagText: {
    color: '#8C1C13',
    fontSize: 14,
    fontWeight: '500',
  },
  notesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  notes: {
    fontSize: 15,
    color: '#3E3E3E',
    lineHeight: 22,
  },
});