// app/wine/[id].js - Wine Detail Screen with Photo Gallery
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { cellarService } from '../../lib/cellar';
import { matchWineToCellar } from '../../lib/cellarMatch';
import { varietalText } from '../../lib/varietals';
import { visitsService } from '../../lib/visits';
import { wineDisplayName } from '../../lib/wineDisplay';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

export default function WineDetail() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const [wine, setWine] = useState(null);
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  // If this same wine is also a bottle in the cellar, surface a tap-through
  // card (#117). null = no match / not yet checked.
  const [cellarMatch, setCellarMatch] = useState(null);

  // Reload whenever the screen regains focus so edits made on the
  // log-session edit screen (#42) are reflected on return.
  useFocusEffect(
    useCallback(() => {
      loadWineDetails();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

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
            title: wineDisplayName(foundWine)
          });

          // Cross-reference the cellar (cached — see #83, so this is cheap) to
          // see if the user also owns this wine, and link to that bottle (#117).
          cellarService
            .getCellar()
            .then((res) => {
              if (!res?.success) {
                setCellarMatch(null);
                return;
              }
              const fuzzy = matchWineToCellar(foundWine, res.bottles);
              // Honor an explicit manual link too (#140): a bottle the user linked
              // to this tasting should surface here even if the fuzzy matcher
              // (producer + name/varietal) wouldn't have caught it.
              const linked = res.bottles.find((b) => b.tasting_wine_id === foundWine.id);
              setCellarMatch(
                fuzzy ||
                  (linked
                    ? {
                        primary: linked,
                        count: Number(linked.quantity) || 1,
                        relation: 'same',
                        differentVintage: null,
                      }
                    : null)
              );
            })
            .catch(() => setCellarMatch(null));
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

  const viewPhoto = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };

  // Open the saved log for editing (#42). On return, useFocusEffect reloads.
  const handleEditLog = () => {
    if (!visit?.id) return;
    router.push(`/log-session?editVisitId=${visit.id}`);
  };

  const renderPhotoGallery = () => {
    if (!wine.photos || wine.photos.length === 0) {
      return (
        <View style={styles.noPhotosContainer}>
          <Ionicons name="camera-outline" size={40} color={colors.gold.shimmer} />
          <Text style={styles.noPhotosText}>No photos yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>PHOTOS ({wine.photos.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {wine.photos.map((photo, index) => (
            <TouchableOpacity
              key={index}
              style={styles.photoThumbnailContainer}
              onPress={() => viewPhoto(index)}
            >
              <Image source={{ uri: photo }} style={styles.photoThumbnail} />
              <View style={styles.photoOverlay}>
                <Ionicons name="expand-outline" size={18} color={colors.neutral.cream} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary.burgundy} />
        <Text style={styles.loadingText}>Loading wine details…</Text>
      </SafeAreaView>
    );
  }

  if (!wine || !visit) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Wine not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Where the wine came from — surfaced right under the name. Prefer the
  // winemaker/producer, then the winery (or free-text place) it was tasted at;
  // join with "·" and skip whichever is missing or duplicated.
  const producer = wine.winemaker?.trim();
  const tastedAt = visit?.wineries?.name || visit?.place_name;
  const originLabel = [producer, tastedAt && tastedAt !== producer ? tastedAt : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary.burgundy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wine Details</Text>
        <TouchableOpacity onPress={handleEditLog} style={styles.iconBtn} accessibilityLabel="Edit log">
          <Ionicons name="create-outline" size={22} color={colors.primary.burgundy} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerBorder} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Wine Basic Info */}
        <Text style={styles.wineName}>
          {wineDisplayName(wine)}
        </Text>
        <View style={styles.wineTypeContainer}>
          {wine.wine_type ? <Text style={styles.wineType}>{wine.wine_type}</Text> : null}
          {/* Show the varietal here only when it isn't already serving as the
              title (i.e. the wine has its own name) — avoids "Prosecco · Prosecco". */}
          {varietalText(wine.wine_varietal) && wine.wine_name ? <Text style={styles.wineMeta}>· {varietalText(wine.wine_varietal)}</Text> : null}
          {wine.wine_year ? <Text style={styles.wineMeta}>· {wine.wine_year}</Text> : null}
        </View>
        {originLabel ? (
          <View style={styles.wineryRow}>
            <Ionicons name="business-outline" size={15} color={colors.primary.burgundy} />
            <Text style={styles.wineryText}>{originLabel}</Text>
          </View>
        ) : null}

        {/* Overall Rating */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingValue}>
            {wine.overall_rating ? wine.overall_rating.toFixed(1) : '0.0'}
          </Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.round(wine.overall_rating || 0) ? 'star' : 'star-outline'}
                size={20}
                color={colors.gold.rich}
              />
            ))}
          </View>
        </View>

        {/* "In your cellar" link (#117) — shown when this same wine is also a
            bottle the user owns; taps through to that bottle. */}
        {cellarMatch ? (
          <TouchableOpacity
            style={styles.cellarCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/cellar/${cellarMatch.primary.id}`)}
            accessibilityLabel="View this wine in your cellar"
          >
            <View style={styles.cellarIcon}>
              <Ionicons name="file-tray-stacked" size={20} color={colors.neutral.cream} />
            </View>
            <View style={styles.cellarText}>
              <Text style={styles.cellarTitle}>
                {cellarMatch.relation === 'same' ? 'In your cellar' : 'You have this wine'}
              </Text>
              <Text style={styles.cellarSub}>
                {cellarMatch.relation === 'same'
                  ? `${cellarMatch.count} bottle${cellarMatch.count === 1 ? '' : 's'} · tap to view`
                  : `A different vintage${cellarMatch.differentVintage ? ` (${cellarMatch.differentVintage})` : ''} · tap to view`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gold.rich} />
          </TouchableOpacity>
        ) : null}

        {/* Photo Gallery */}
        {renderPhotoGallery()}

        {/* Detailed Ratings */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DETAILED RATINGS</Text>
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
                <View style={[styles.ratingFill, { width: `${(value || 0) * 20}%` }]} />
              </View>
              <Text style={styles.ratingNumber}>
                {value ? value.toFixed(1) : '0.0'}
              </Text>
            </View>
          ))}
        </View>

        {/* Flavor Notes */}
        {wine.flavorNotes && wine.flavorNotes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>FLAVOR NOTES</Text>
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
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notesText}>{wine.additional_notes}</Text>
          </View>
        )}

        {/* Visit Information */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>VISIT INFORMATION</Text>
          <TouchableOpacity style={styles.editLogLink} onPress={handleEditLog} accessibilityLabel="Edit log">
            <Ionicons name="create-outline" size={16} color={colors.primary.burgundy} />
            <Text style={styles.editLogLinkText}>Edit log</Text>
          </TouchableOpacity>
        </View>

        {/* When the log has a linked winery, the card taps through to it.
            Location-optional logs (no winery_id) just show the place name. */}
        {visit.winery_id ? (
          <TouchableOpacity
            style={styles.visitInfo}
            activeOpacity={0.85}
            onPress={() => router.push(`/winery/${visit.winery_id}`)}
          >
            <View style={styles.visitDetails}>
              <Text style={styles.wineryName}>
                {visit.wineries?.name || visit.place_name || 'Winery'}
              </Text>
              <Text style={styles.visitDate}>Visited on {formatDate(visit.visit_date)}</Text>
              {visit.notes ? (
                <Text style={styles.visitNotes} numberOfLines={2}>{visit.notes}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral.silver} />
          </TouchableOpacity>
        ) : (
          <View style={styles.visitInfo}>
            <View style={styles.visitDetails}>
              {visit.place_name ? <Text style={styles.wineryName}>{visit.place_name}</Text> : null}
              <Text style={styles.visitDate}>Logged on {formatDate(visit.visit_date)}</Text>
              {visit.notes ? (
                <Text style={styles.visitNotes} numberOfLines={2}>{visit.notes}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Ask the Sommelier */}
        <TouchableOpacity
          style={styles.sommelierButton}
          onPress={() => router.push('/(tabs)/sommelier')}
          activeOpacity={0.9}
        >
          <Ionicons name="sparkles" size={20} color={colors.neutral.cream} />
          <Text style={styles.sommelierButtonText}>Ask about this wine</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoModal} animationType="fade" transparent={true}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalClose} onPress={() => setShowPhotoModal(false)}>
            <Ionicons name="close" size={32} color={colors.neutral.cream} />
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
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    flex: 1,
    textAlign: 'center',
  },
  headerBorder: { height: 1, backgroundColor: colors.gold.muted, marginHorizontal: spacing.lg },

  wineName: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginTop: spacing.lg,
  },
  wineTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.xs },
  wineType: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600' },
  wineMeta: { ...typography.body.regular, color: colors.neutral.pewter, marginLeft: spacing.xs },
  wineryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  wineryText: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600' },

  // "In your cellar" link card (#117)
  cellarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  cellarIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.rich,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellarText: { flex: 1 },
  cellarTitle: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '700',
  },
  cellarSub: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },

  // Overall rating
  ratingCard: {
    alignItems: 'center',
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  ratingValue: { fontFamily: 'Georgia', fontSize: 40, color: colors.primary.burgundy, marginBottom: spacing.xs },
  starsContainer: { flexDirection: 'row', gap: spacing.xs },

  // Cards
  card: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  sectionLabel: { ...typography.body.caption, color: colors.gold.shimmer, marginBottom: spacing.md },

  // Photos
  photoScroll: { marginHorizontal: -spacing.xs },
  photoThumbnailContainer: { position: 'relative', marginHorizontal: spacing.xs },
  photoThumbnail: { width: 120, height: 120, borderRadius: borderRadius.md },
  photoOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.overlay.dark,
    borderRadius: borderRadius.round,
    padding: spacing.xs,
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderStyle: 'dashed',
    marginTop: spacing.md,
  },
  noPhotosText: { marginTop: spacing.sm, color: colors.neutral.pewter, ...typography.body.regular },

  // Detailed ratings
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  ratingLabel: { width: 80, ...typography.body.small, color: colors.neutral.graphite },
  ratingBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.neutral.linen,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
  },
  ratingFill: { height: '100%', borderRadius: borderRadius.sm, backgroundColor: colors.primary.burgundy },
  ratingNumber: { width: 32, ...typography.body.small, color: colors.neutral.charcoal, textAlign: 'right' },

  // Flavor notes
  flavorTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flavorTag: {
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  flavorTagText: { ...typography.body.small, color: colors.primary.burgundy },

  notesText: { ...typography.body.regular, color: colors.neutral.charcoal, lineHeight: 22 },

  // Visit information
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  editLogLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editLogLinkText: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600' },
  visitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  visitDetails: { flex: 1 },
  wineryName: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600', marginBottom: 2 },
  visitDate: { ...typography.body.small, color: colors.neutral.pewter },
  visitNotes: { ...typography.body.small, color: colors.neutral.pewter, fontStyle: 'italic', marginTop: 2 },

  // Sommelier CTA
  sommelierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl,
  },
  sommelierButtonText: { ...typography.body.large, color: colors.neutral.cream, fontWeight: '600' },

  // Loading / error
  loadingText: { marginTop: spacing.md, ...typography.body.regular, color: colors.neutral.pewter },
  errorText: { ...typography.heading.h3, color: colors.neutral.graphite, marginBottom: spacing.lg, fontFamily: 'Georgia' },
  backButton: {
    backgroundColor: colors.primary.burgundy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  backButtonText: { ...typography.body.regular, color: colors.neutral.cream, fontWeight: '600' },

  // Photo modal (dark overlay intentional)
  photoModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  photoModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 1, padding: spacing.sm },
  photoModalContainer: { width: 400, height: 400, justifyContent: 'center', alignItems: 'center' },
  photoModalImage: { width: '90%', height: '90%', resizeMode: 'contain' },
  photoModalIndicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
  },
  photoModalText: { color: colors.neutral.cream, ...typography.body.small },
});
