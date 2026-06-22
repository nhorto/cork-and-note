// Updated PastVisitsSection.js with photo display support
// Château Label Design - Elegant & Refined
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
import { varietalText } from '../lib/varietals';
import { visitsService } from '../lib/visits';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

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
          // Filter visits to this winery (winery_id can be null for
          // location-optional logs, so guard the toString()).
          const wineryVisits = visits.filter(visit =>
            visit.winery_id?.toString() === wineryId?.toString()
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
        <View style={styles.loadingIcon}>
          <Ionicons name="wine-outline" size={24} color={colors.gold.muted} />
        </View>
        <Text style={styles.loadingText}>Loading your past visits...</Text>
      </View>
    );
  }

  // If no visits
  if (visits.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="calendar-outline" size={32} color={colors.gold.muted} />
        </View>
        <Text style={styles.emptyText}>
          You haven't logged any visits to this winery yet.
        </Text>
        <TouchableOpacity
          style={styles.addVisitButton}
          onPress={() => Alert.alert('Log Visit', 'Use the "Log Your Visit" button at the top to add a visit.')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={colors.neutral.cream} />
          <Text style={styles.addVisitButtonText}>Log Your First Visit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.decorativeLine} />
        <Text style={styles.sectionLabel}>YOUR VISITS</Text>
        <View style={styles.decorativeLine} />
      </View>
      <Text style={styles.visitCount}>{visits.length} {visits.length === 1 ? 'visit' : 'visits'} logged</Text>
      
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
              color={colors.primary.burgundy}
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
                <View style={styles.winesSectionHeader}>
                  <Text style={styles.winesSectionTitle}>Wines Tasted</Text>
                  <TouchableOpacity
                    style={styles.editLogLink}
                    onPress={() => router.push(`/log-session?editVisitId=${visit.id}`)}
                    accessibilityLabel="Edit log"
                  >
                    <Ionicons name="pencil-outline" size={15} color={colors.primary.burgundy} />
                    <Text style={styles.editLogLinkText}>Edit log</Text>
                  </TouchableOpacity>
                </View>
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
                          {varietalText(wine.wine_varietal) && ` • ${varietalText(wine.wine_varietal)}`}
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
                            <Ionicons name="star" size={16} color={colors.gold.rich} />
                            <Text style={styles.ratingText}>
                              {wine.overall_rating.toFixed(1)}
                            </Text>
                          </>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={colors.primary.burgundy} />
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
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold.muted,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginHorizontal: spacing.md,
  },
  visitCount: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Loading
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },

  // Empty State
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  emptyIcon: {
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
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 260,
  },
  addVisitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.burgundy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  addVisitButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Visit Card
  visitCard: {
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    overflow: 'hidden',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  visitHeaderLeft: {
    flex: 1,
  },
  visitDate: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.xs,
  },
  wineCount: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginBottom: 2,
  },
  photoCount: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontSize: 12,
  },

  // Visit Photos Section
  visitPhotosSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
  },
  photosSectionTitle: {
    ...typography.body.small,
    fontWeight: '500',
    color: colors.neutral.pewter,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  moreThumbnailContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreThumbnailText: {
    ...typography.body.small,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Expanded Content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
  },
  notesSection: {
    padding: spacing.md,
    backgroundColor: colors.neutral.linen,
  },
  notesTitle: {
    ...typography.body.small,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
  },
  notesText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    lineHeight: 22,
  },

  // Wines Section
  winesSection: {
    padding: spacing.md,
  },
  winesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  winesSectionTitle: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.charcoal,
  },
  editLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLogLinkText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '600',
  },
  wineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.xs,
  },
  wineDetails: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginBottom: spacing.xs,
  },
  winePhotosPreview: {
    marginTop: spacing.xs,
  },
  wineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.body.small,
    fontWeight: '500',
    color: colors.neutral.charcoal,
    marginRight: spacing.xs,
  },
  noWinesText: {
    ...typography.body.regular,
    color: colors.neutral.silver,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },

  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  photoModalTitle: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
    flex: 1,
  },
  photoModalClose: {
    padding: spacing.sm,
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
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  photoModalText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
  },
});

export default PastVisitsSection;