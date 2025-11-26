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
// import { visitsService } from '../../lib/visits';

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
    // try {
    //   setLoading(true);
    //   const { success, visits } = await visitsService.getUserVisits();
      
    //   if (success && visits) {
    //     let foundWine = null;
    //     let foundVisit = null;
        
    //     // Search through all visits to find the wine
    //     visits.forEach(visit => {
    //       if (visit.wines) {
    //         const wineInVisit = visit.wines.find(w => w.id === id);
    //         if (wineInVisit) {
    //           foundWine = {
    //             ...wineInVisit,
    //             flavorNotes: wineInVisit.wine_flavor_notes?.map(fn => fn.flavor_notes?.name) || [],
    //             // Ensure photos is always an array
    //             photos: wineInVisit.photos || []
    //           };
    //           foundVisit = visit;
    //         }
    //       }
    //     });
        
    //     if (foundWine && foundVisit) {
    //       setWine(foundWine);
    //       setVisit(foundVisit);
          
    //       // Set navigation title
    //       navigation.setOptions({
    //         title: foundWine.wine_name || `${foundWine.wine_type} Wine`
    //       });
    //     } else {
    //       router.back();
    //     }
    //   }
    // } catch (error) {
    //   console.error('Error loading wine details:', error);
    //   router.back();
    // } finally {
    //   setLoading(false);
    // }
    // Mocked data for demonstration purposes
    setTimeout(() => {
      const mockedWine = {
        id: id,
        wine_name: "Chateau Mock 2018",
        wine_type: "Red",
        wine_varietal: "Cabernet Sauvignon",
        wine_year: 2018,
        overall_rating: 4.2,
        sweetness: 2.5,
        tannin: 4.0,
        acidity: 3.5,
        body: 4.0,
        alcohol: 13.5,
        flavorNotes: ["Blackberry", "Oak", "Vanilla"],
        additional_notes: "A rich and full-bodied wine with a smooth finish.",
      };
      const mockedVisit = {
        visit_date: "2023-05-15",
        winery_id: "winery123",
        wineries: {
          name: "Mock Winery"
        },
        notes: "Had a wonderful time tasting various wines."
      };
      setWine(mockedWine);
      setVisit(mockedVisit);
      navigation.setOptions({
        title: mockedWine.wine_name || `${mockedWine.wine_type} Wine`
      });
      setLoading(false);
    });
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

  const viewPhoto = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };

  // const renderPhotoGallery = () => {
  //   if (!wine.photos || wine.photos.length === 0) {
  //     return (
  //       <View style={styles.noPhotosContainer}>
  //         <Ionicons name="camera-outline" size={48} color="#999" />
  //         <Text style={styles.noPhotosText}>No photos available</Text>
  //       </View>
  //     );
  //   }

  //   return (
  //     <View style={styles.photoGallery}>
  //       <Text style={styles.photoGalleryTitle}>Wine Photos ({wine.photos.length})</Text>
  //       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
  //         {wine.photos.map((photo, index) => (
  //           <TouchableOpacity
  //             key={index}
  //             style={styles.photoThumbnailContainer}
  //             onPress={() => viewPhoto(index)}
  //           >
  //             <Image source={{ uri: photo }} style={styles.photoThumbnail} />
  //             <View style={styles.photoOverlay}>
  //               <Ionicons name="expand-outline" size={20} color="#fff" />
  //             </View>
  //           </TouchableOpacity>
  //         ))}
  //       </ScrollView>
  //     </View>
  //   );
  // };

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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wine Details</Text>
        </View>

        {/* Wine Basic Info */}
        <View style={styles.section}>
          <Text style={styles.wineName}>
            {wine.wine_name || `${wine.wine_type} Wine`}
          </Text>
          
          <View style={styles.wineBasicInfo}>
            <View style={styles.wineTypeContainer}>
              <Text style={styles.wineType}>{wine.wine_type}</Text>
              {wine.wine_varietal && (
                <Text style={styles.wineVarietal}>• {wine.wine_varietal}</Text>
              )}
              {wine.wine_year && (
                <Text style={styles.wineYear}>• {wine.wine_year}</Text>
              )}
            </View>
          </View>

          {/* Overall Rating */}
          <View style={styles.overallRating}>
            <View style={styles.ratingDisplay}>
              <Text style={[styles.ratingValue, { color: getRatingColor(wine.overall_rating) }]}>
                {wine.overall_rating ? wine.overall_rating.toFixed(1) : '0.0'}
              </Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= (wine.overall_rating || 0) ? "star" : "star-outline"}
                    size={20}
                    color="#FFD700"
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Photo Gallery */}
        {/* {renderPhotoGallery()} */}

        {/* Detailed Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Ratings</Text>
          
          {[
            { key: 'sweetness', label: 'Sweetness', value: wine.sweetness },
            { key: 'tannin', label: 'Tannins', value: wine.tannin },
            { key: 'acidity', label: 'Acidity', value: wine.acidity },
            { key: 'body', label: 'Body', value: wine.body },
            { key: 'alcohol', label: 'Alcohol', value: wine.alcohol }
          ].map(({ key, label, value }) => (
            <View key={key} style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>{label}</Text>
              <View style={styles.ratingBar}>
                <View 
                  style={[
                    styles.ratingFill, 
                    { 
                      width: `${(value || 0) * 20}%`,
                      backgroundColor: getRatingColor(value || 0)
                    }
                  ]} 
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