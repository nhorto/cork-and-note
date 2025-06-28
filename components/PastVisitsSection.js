// Updated PastVisitsSection.js with photo display support
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { visitsService } from '../lib/visits';

const PastVisitsSection = ({ wineryId }) => {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [expandedVisit, setExpandedVisit] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoModalTitle, setPhotoModalTitle] = useState('');
  const router = useRouter();

  // Load visits for this winery
  useEffect(() => {
    const loadVisits = async () => {
      try {
        setLoading(true);
        const { success, visits } = await visitsService.getUserVisits();
        
        if (success && visits) {
          // Filter visits to this winery
          const wineryVisits = visits.filter(visit => 
            visit.winery_id.toString() === wineryId.toString()
          );
          setVisits(wineryVisits);
        }
      } catch (error) {
        console.error('Error loading visits:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVisits();
  }, [wineryId]);

  // Toggle visit expansion
  const toggleVisitExpansion = (visitId) => {
    if (expandedVisit === visitId) {
      setExpandedVisit(null);
    } else {
      setExpandedVisit(visitId);
    }
  };

  // Navigate to wine detail
  const handleWinePress = (wineId) => {
    router.push(`/wine/${wineId}`);
  };

  // View photos in modal
  const viewPhotos = (photos, title, startIndex = 0) => {
    if (photos && photos.length > 0) {
      setSelectedPhotos(photos);
      setSelectedPhotoIndex(startIndex);
      setPhotoModalTitle(title);
      setShowPhotoModal(true);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Render photo thumbnails
  const renderPhotoThumbnails = (photos, title, maxDisplay = 3) => {
    if (!photos || photos.length === 0) return null;

    const displayPhotos = photos.slice(0, maxDisplay);
    const remainingCount = photos.length - maxDisplay;

    return (
      <View style={styles.photoThumbnails}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {displayPhotos.map((photo, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => viewPhotos(photos, title, index)}
              style={styles.thumbnailContainer}
            >
              <Image source={{ uri: photo }} style={styles.thumbnail} />
            </TouchableOpacity>
          ))}
          {remainingCount > 0 && (
            <TouchableOpacity
              onPress={() => viewPhotos(photos, title, maxDisplay)}
              style={[styles.thumbnailContainer, styles.moreThumbnailContainer]}
            >
              <View style={styles.moreThumbnail}>
                <Text style={styles.moreThumbnailText}>+{remainingCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  // If loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8C1C13" />
        <Text style={styles.loadingText}>Loading your past visits...</Text>
      </View>
    );
  }

  // If no visits
  if (visits.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          You haven't logged any visits to this winery yet.
        </Text>
        <TouchableOpacity 
          style={styles.addVisitButton}
          onPress={() => Alert.alert('Log Visit', 'Use the "Log Your Visit" button at the top to add a visit.')}
        >
          <Text style={styles.addVisitButtonText}>Log Your First Visit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Your Past Visits ({visits.length})</Text>
      
      {visits.map((visit) => (
        <View key={visit.id} style={styles.visitCard}>
          {/* Visit Header */}
          <TouchableOpacity
            style={styles.visitHeader}
            onPress={() => toggleVisitExpansion(visit.id)}
          >
            <View style={styles.visitHeaderLeft}>
              <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
              <Text style={styles.wineCount}>
                {visit.wines?.length || 0} wine{(visit.wines?.length || 0) !== 1 ? 's' : ''} tasted
              </Text>
              {(visit.photos?.length > 0) && (
                <Text style={styles.photoCount}>
                  📷 {visit.photos.length} visit photo{visit.photos.length !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Ionicons
              name={expandedVisit === visit.id ? "chevron-up" : "chevron-down"}
              size={20}
              color="#8C1C13"
            />
          </TouchableOpacity>

          {/* Visit Photos Preview */}
          {visit.photos && visit.photos.length > 0 && (
            <View style={styles.visitPhotosSection}>
              <Text style={styles.photosSectionTitle}>Visit Photos</Text>
              {renderPhotoThumbnails(visit.photos, `Visit Photos - ${formatDate(visit.visit_date)}`)}
            </View>
          )}

          {/* Expanded Content */}
          {expandedVisit === visit.id && (
            <View style={styles.expandedContent}>
              {/* Visit Notes */}
              {visit.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Visit Notes</Text>
                  <Text style={styles.notesText}>{visit.notes}</Text>
                </View>
              )}

              {/* Wine List */}
              <View style={styles.winesSection}>
                <Text style={styles.winesSectionTitle}>Wines Tasted</Text>
                {visit.wines && visit.wines.length > 0 ? (
                  visit.wines.map((wine, index) => (
                    <TouchableOpacity
                      key={wine.id}
                      style={styles.wineItem}
                      onPress={() => handleWinePress(wine.id)}
                    >
                      <View style={styles.wineInfo}>
                        <Text style={styles.wineName}>
                          {wine.wine_name || `${wine.wine_type} Wine`}
                        </Text>
                        <Text style={styles.wineDetails}>
                          {wine.wine_type}
                          {wine.wine_varietal && ` • ${wine.wine_varietal}`}
                          {wine.wine_year && ` • ${wine.wine_year}`}
                        </Text>
                        
                        {/* Wine Photos Preview */}
                        {wine.photos && wine.photos.length > 0 && (
                          <View style={styles.winePhotosPreview}>
                            {renderPhotoThumbnails(
                              wine.photos, 
                              `${wine.wine_name || wine.wine_type} Photos`,
                              2
                            )}
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.wineRating}>
                        {wine.overall_rating > 0 && (
                          <>
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Text style={styles.ratingText}>
                              {wine.overall_rating.toFixed(1)}
                            </Text>
                          </>
                        )}
                        <Ionicons name="chevron-forward" size={16} color="#8C1C13" />
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noWinesText}>No wines recorded for this visit.</Text>
                )}
              </View>
            </View>
          )}
        </View>
      ))}

      {/* Photo Viewer Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalHeader}>
            <Text style={styles.photoModalTitle}>{photoModalTitle}</Text>
            <TouchableOpacity
              style={styles.photoModalClose}
              onPress={() => setShowPhotoModal(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {selectedPhotos.length > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedPhotoIndex * 400, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / 400);
                setSelectedPhotoIndex(newIndex);
              }}
            >
              {selectedPhotos.map((photo, index) => (
                <View key={index} style={styles.photoModalContainer}>
                  <Image source={{ uri: photo }} style={styles.photoModalImage} />
                </View>
              ))}
            </ScrollView>
          )}
          
          <View style={styles.photoModalIndicator}>
            <Text style={styles.photoModalText}>
              {selectedPhotoIndex + 1} of {selectedPhotos.length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  addVisitButton: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addVisitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  visitHeaderLeft: {
    flex: 1,
  },
  visitDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  wineCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  photoCount: {
    fontSize: 12,
    color: '#8C1C13',
  },
  visitPhotosSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  photoThumbnails: {
    marginHorizontal: -4,
  },
  thumbnailContainer: {
    marginHorizontal: 4,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  moreThumbnailContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreThumbnailText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  notesSection: {
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  winesSection: {
    padding: 16,
  },
  winesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  wineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f1ef',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  wineDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  winePhotosPreview: {
    marginTop: 4,
  },
  wineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3E3E3E',
    marginRight: 4,
  },
  noWinesText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  photoModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  photoModalClose: {
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

export default PastVisitsSection;