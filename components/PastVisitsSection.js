// Updated PastVisitsSection.js with photo display support
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { createThemedStyles } from '../styles/ThemeProvider';


// pagingEnabled snaps to the screen width, so the photo pages must match it —
// a hardcoded 400 desyncs the pager and the "N of M" indicator.
const SCREEN_WIDTH = Dimensions.get('window').width;

const PastVisitsSection = ({ wineryId, wineryName }) => {
  const { colors, styles } = useScreenTheme();

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [expandedVisit, setExpandedVisit] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoModalTitle, setPhotoModalTitle] = useState('');
  const router = useRouter();

  // Load visits for this winery. Reload on focus (not just once per wineryId)
  // so changes made via "Edit log" appear when the user navigates back.
  useFocusEffect(
    useCallback(() => {
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

            // Auto-expand the most recent visit — the notes are why the user
            // opened this page, so don't hide them behind a collapsed row
            // (#170 item 7). Only on first load; don't fight a manual toggle.
            if (wineryVisits.length > 0) {
              const mostRecent = wineryVisits.reduce((a, b) =>
                new Date(b.visit_date) > new Date(a.visit_date) ? b : a
              );
              setExpandedVisit(prev => prev ?? mostRecent.id);
            }
          }
        } catch (error) {
          console.error('Error loading visits:', error);
        } finally {
          setLoading(false);
        }
      };

      loadVisits();
    }, [wineryId])
  );

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

  // Format date for display. visit_date is a date-only value parsed as UTC
  // midnight, so format in UTC too — otherwise it renders a day early west of UTC.
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
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
          <Ionicons name="wine-outline" size={24} color={colors.accent.border} />
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
          <Ionicons name="calendar-outline" size={32} color={colors.accent.border} />
        </View>
        <Text style={styles.emptyText}>
          You haven’t logged any visits to this winery yet.
        </Text>
        <TouchableOpacity
          style={styles.addVisitButton}
          onPress={() =>
            // Straight into the log form for this winery — the old Alert named
            // a button that doesn't exist on this screen (#170 item 9).
            router.push({
              pathname: '/log-session',
              params: { mode: 'winery', wineryId, ...(wineryName ? { wineryName } : {}) },
            })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={colors.onPrimary} />
          <Text style={styles.addVisitButtonText}>Log your first visit</Text>
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
              color={colors.primary.ink}
            />
          </TouchableOpacity>

          {/* Visit Photos Preview */}
          {visit.photos && visit.photos.length > 0 && (
            <View style={styles.visitPhotosSection}>
              <Text style={styles.photosSectionTitle}>Visit photos</Text>
              {renderPhotoThumbnails(visit.photos, `Visit Photos - ${formatDate(visit.visit_date)}`)}
            </View>
          )}

          {/* Expanded Content */}
          {expandedVisit === visit.id && (
            <View style={styles.expandedContent}>
              {/* Visit Notes */}
              {visit.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Visit notes</Text>
                  <Text style={styles.notesText}>{visit.notes}</Text>
                </View>
              )}

              {/* Wine List */}
              <View style={styles.winesSection}>
                <View style={styles.winesSectionHeader}>
                  <Text style={styles.winesSectionTitle}>Wines tasted</Text>
                  <TouchableOpacity
                    style={styles.editLogLink}
                    onPress={() => router.push(`/log-session?editVisitId=${visit.id}`)}
                    accessibilityLabel="Edit log"
                  >
                    <Ionicons name="pencil-outline" size={15} color={colors.primary.ink} />
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
                            <Ionicons name="star" size={16} color={colors.accent.base} />
                            <Text style={styles.ratingText}>
                              {wine.overall_rating.toFixed(1)}
                            </Text>
                          </>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={colors.primary.ink} />
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
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={28} color={colors.onPhoto} />
            </TouchableOpacity>
          </View>
          
          {selectedPhotos.length > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedPhotoIndex * SCREEN_WIDTH, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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


export default PastVisitsSection;

const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
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
    backgroundColor: colors.accent.border,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginHorizontal: spacing.md,
  },
  visitCount: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
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
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
  },

  // Empty State
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  emptyIcon: {
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
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 260,
  },
  addVisitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  addVisitButtonText: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '600',
  },

  // Visit Card
  visitCard: {
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
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
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.xs,
  },
  wineCount: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginBottom: 2,
  },
  photoCount: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontSize: 12,
  },

  // Visit Photos Section
  visitPhotosSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  photosSectionTitle: {
    ...typography.body.small,
    fontWeight: '500',
    color: colors.neutral.inkTertiary,
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
    borderColor: colors.neutral.border,
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
    color: colors.onPrimary,
    fontWeight: '600',
  },

  // Expanded Content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  notesSection: {
    padding: spacing.md,
    backgroundColor: colors.neutral.divider,
  },
  notesTitle: {
    ...typography.body.small,
    fontWeight: '600',
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
  },
  notesText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
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
    color: colors.neutral.ink,
  },
  editLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLogLinkText: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontWeight: '600',
  },
  wineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.xs,
  },
  wineDetails: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
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
    color: colors.neutral.ink,
    marginRight: spacing.xs,
  },
  noWinesText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },

  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.photo,
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
    color: colors.onPrimary,
    fontWeight: '600',
    flex: 1,
  },
  photoModalClose: {
    padding: spacing.sm,
  },
  photoModalContainer: {
    width: SCREEN_WIDTH,
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
    color: colors.onPrimary,
  },
});
return { colors, styles };
});
