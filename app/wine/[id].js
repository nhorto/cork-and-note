// Updated app/wine/[id].js - Wine Detail Screen with Photo Gallery
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    loadWineDetails();
  }, [id]);

  const loadWineDetails = async () => {
    try {
      setLoading(true);
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
                flavorNotes: wineInVisit.wine_flavor_notes?.map(fn => fn.flavor_notes?.name) || [],
                // Ensure photos is always an array
                photos: wineInVisit.photos || []
              };
              foundVisit = visit;
            }
          }
        });
        
        if (foundWine && foundVisit) {
          setWine(foundWine);
          setVisit(foundVisit);
          
          // Set navigation title
          navigation.setOptions({
            title: foundWine.wine_name || `${foundWine.wine_type} Wine`
          });
        } else {
          router.back();
        }
      }
    } catch (error) {
      console.error('Error loading wine details:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return '#4CAF50';
    if (rating >= 3) return '#FF9800';
    return '#F44336';
  };

  const viewPhoto = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };

  const renderPhotoGallery = () => {
    if (!wine.photos || wine.photos.length === 0) {
      return (
        <View style={styles.noPhotosContainer}>
          <Ionicons name="camera-outline" size={48} color="#999" />
          <Text style={styles.noPhotosText}>No photos available</Text>
        </View>
      );
    }

    return (
      <View style={styles.photoGallery}>
        <Text style={styles.photoGalleryTitle}>Wine Photos ({wine.photos.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {wine.photos.map((photo, index) => (
            <TouchableOpacity
              key={index}
              style={styles.photoThumbnailContainer}
              onPress={() => viewPhoto(index)}
            >
              <Image source={{ uri: photo }} style={styles.photoThumbnail} />
              <View style={styles.photoOverlay}>
                <Ionicons name="expand-outline" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
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

  if (!wine || !visit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Wine not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
        {renderPhotoGallery()}

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
              <Text style={styles.ratingNumber}>
                {value ? value.toFixed(1) : '0.0'}
              </Text>
            </View>
          ))}
        </View>

        {/* Flavor Notes */}
        {wine.flavorNotes && wine.flavorNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flavor Notes</Text>
            <View style={styles.flavorTags}>
              {wine.flavorNotes.map((flavor, index) => (
                <View key={index} style={styles.flavorTag}>
                  <Text style={styles.flavorTagText}>{flavor}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Additional Notes */}
        {wine.additional_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.notesText}>{wine.additional_notes}</Text>
          </View>
        )}

        {/* Visit Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Information</Text>
          <TouchableOpacity 
            style={styles.visitInfo}
            onPress={() => router.push(`/winery/${visit.winery_id}`)}
          >
            <View style={styles.visitDetails}>
              <Text style={styles.wineryName}>{visit.wineries?.name}</Text>
              <Text style={styles.visitDate}>Visited on {formatDate(visit.visit_date)}</Text>
              {visit.notes && (
                <Text style={styles.visitNotes} numberOfLines={2}>
                  {visit.notes}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8C1C13" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Photo Viewer Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setShowPhotoModal(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {wine.photos && wine.photos.length > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedPhotoIndex * 400, y: 0 }}
            >
              {wine.photos.map((photo, index) => (
                <View key={index} style={styles.photoModalContainer}>
                  <Image source={{ uri: photo }} style={styles.photoModalImage} />
                </View>
              ))}
            </ScrollView>
          )}
          
          <View style={styles.photoModalIndicator}>
            <Text style={styles.photoModalText}>
              {selectedPhotoIndex + 1} of {wine.photos?.length || 0}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backIcon: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  wineName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 8,
  },
  wineBasicInfo: {
    marginBottom: 16,
  },
  wineTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  wineType: {
    fontSize: 16,
    color: '#8C1C13',
    fontWeight: '600',
  },
  wineVarietal: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  wineYear: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  overallRating: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  ratingDisplay: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  photoGallery: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  photoGalleryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  photoScroll: {
    marginHorizontal: -4,
  },
  photoThumbnailContainer: {
    position: 'relative',
    marginHorizontal: 4,
  },
  photoThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  noPhotosText: {
    marginTop: 8,
    color: '#999',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingLabel: {
    width: 80,
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  ratingBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingNumber: {
    width: 30,
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  flavorTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flavorTag: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  flavorTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 15,
    color: '#3E3E3E',
    lineHeight: 22,
  },
  visitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  visitDetails: {
    flex: 1,
  },
  wineryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8C1C13',
    marginBottom: 4,
  },
  visitDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitNotes: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  photoModalContainer: {
    width: 400,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  photoModalIndicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoModalText: {
    color: '#fff',
    fontSize: 14,
  },
});