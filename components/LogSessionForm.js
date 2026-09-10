// components/LogSessionForm.js
// Château Label Design - Elegant & Refined
// The location-optional logging session (Epic #5, docs/design/logging-flow.md).
// One session holds 1…N wines + an optional place. A single wine reads like a
// quick entry (the "B" feel); add another and it becomes a winery-trip recap
// (the "A" feel) — same underlying data, two experiences.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TIER, findPriorTastings, flattenTastedWines } from '../lib/cellarMatch';
import { parseVarietals, varietalText } from '../lib/varietals';
import { visitsService } from '../lib/visits';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';
import PlacePicker from './PlacePicker';
import TastingMenuScanner from './TastingMenuScanner';
import WineEntryForm from './WineEntryForm';


const PLACE_META = {
  winery: { icon: 'wine', label: 'Winery' },
  restaurant: { icon: 'restaurant', label: 'Restaurant' },
  other: { icon: 'location', label: 'Elsewhere' },
};

const todayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDate = (s) => {
  if (!s) return '';
  const date = new Date(s);
  if (isNaN(date.getTime())) return s;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

// Strict YYYY-MM-DD check: format + real-calendar round-trip, so junk like
// "2024-13-45" never reaches Postgres and fails with a raw DB error.
const isValidISODate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};

// Map a DB wine row (snake_case, singular ratings) to the in-app wine shape
// WineEntryForm / the wine cards expect. Preserves the row id so the edit flow
// can diff existing wines from new ones.
const dbWineToApp = (w) => ({
  id: w.id,
  winemaker: w.winemaker || '',
  name: w.wine_name || '',
  type: w.wine_type || '',
  // Varietals are a list now (#135); WineEntryForm/createVisit accept arrays.
  varietal: parseVarietals(w.wine_varietal),
  year: w.wine_year != null ? String(w.wine_year) : '',
  overallRating: w.overall_rating || 0,
  ratings: {
    sweetness: w.sweetness || 0,
    tannins: w.tannin || 0, // DB column is singular `tannin`
    acidity: w.acidity || 0,
    body: w.body || 0,
    alcohol: w.alcohol || 0,
  },
  flavorNotes:
    w.wine_flavor_notes?.map((fn) => fn.flavor_notes?.name).filter(Boolean) || [],
  additionalNotes: w.additional_notes || '',
  photos: w.photos || [],
});

// Map a DB visit row to LogSessionForm's `place` shape (or null when no place).
const dbVisitToPlace = (v) => {
  if (!v.place_type && !v.winery_id && !v.place_name) return null;
  return {
    placeType: v.place_type || (v.winery_id ? 'winery' : 'other'),
    placeName: v.place_name ?? v.wineries?.name ?? null,
    wineryId: v.winery_id ?? null,
    latitude: v.latitude != null ? Number(v.latitude) : null,
    longitude: v.longitude != null ? Number(v.longitude) : null,
  };
};

export default function LogSessionForm({
  mode = 'wine',
  winery = null,
  initialSession = null,
  onSave,
  onCancel,
}) {
  const { colors, spacing, styles } = useScreenTheme();

  const insets = useSafeAreaInsets();

  const isEditing = !!initialSession;

  const [wines, setWines] = useState(
    initialSession ? (initialSession.wines || []).map(dbWineToApp) : []
  );
  const [place, setPlace] = useState(() => {
    if (initialSession) return dbVisitToPlace(initialSession);
    return winery
      ? {
          placeType: 'winery',
          placeName: winery.name,
          wineryId: winery.id,
          latitude: winery.latitude != null ? Number(winery.latitude) : null,
          longitude: winery.longitude != null ? Number(winery.longitude) : null,
        }
      : null;
  });
  const [visitDate, setVisitDate] = useState(
    initialSession?.visit_date ? initialSession.visit_date.slice(0, 10) : todayISO
  );
  const [notes, setNotes] = useState(initialSession?.notes || '');
  // Visit-level photos for the whole visit (#137) — e.g. the tasting card or a
  // shot at the winery. Stored on the visit (photo_url) and shown in winery
  // history. On edit, hydrate the existing photo URLs.
  const [visitPhotos, setVisitPhotos] = useState(
    initialSession ? visitsService.parsePhotoUrls(initialSession.photo_url) : []
  );
  const [saving, setSaving] = useState(false);

  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  // B-first: "Log a wine" drops you straight into the wine form.
  // Skip this when editing an existing log — we land on the session overview.
  useEffect(() => {
    if (!isEditing && mode === 'wine' && wines.length === 0) {
      setCurrentWineIndex(null);
      setShowWineForm(true);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSession = wines.length >= 2;
  const winemakerDefault = place?.placeType === 'winery' ? place?.placeName || '' : '';

  // ── Duplicate-tasting awareness (#93) ──────────────────────────────────────
  // Prior tastings from OTHER visits, for the "you've logged this before"
  // banner. getUserVisits is cached (#83), so this is usually free; a failure is
  // silent because the banner is a nicety and must never block logging.
  const [priorTastings, setPriorTastings] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { success, visits } = await visitsService.getUserVisits();
        if (!alive || !success) return;
        // Drop the session being edited — its own wines would self-match.
        const others = (visits || []).filter((v) => v.id !== initialSession?.id);
        setPriorTastings(flattenTastedWines(others));
      } catch {
        // non-fatal: no banner
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialSession?.id]);

  // Drafts already on THIS visit, projected onto the field names the matcher
  // reads (the in-app wine shape uses name/varietal/year, the DB shape uses
  // wine_name/wine_varietal/wine_year). Excludes the row being edited.
  const sessionWines = useMemo(
    () =>
      wines
        .map((w, i) => ({ w, i }))
        .filter(({ i }) => i !== currentWineIndex)
        .map(({ w }) => ({
          winemaker: w.winemaker,
          wine_name: w.name,
          wine_varietal: w.varietal,
          wine_year: w.year,
          wine_type: w.type,
          overall_rating: w.overallRating,
          additional_notes: w.additionalNotes,
          placeName: place?.placeName || null,
          visitDate,
        })),
    [wines, currentWineIndex, place?.placeName, visitDate]
  );

  // Compact per-row flag for the review list (#93E). A full banner per row would
  // be overwhelming when a tasting-card scan (#139) drops eight drafts in at
  // once, so each row gets a quiet badge instead; the banner is reserved for the
  // form, where there's only ever one wine in view.
  const priorFlags = useMemo(() => {
    if (priorTastings.length === 0) return {};
    const out = {};
    wines.forEach((w, i) => {
      const hit = findPriorTastings(
        {
          winemaker: w.winemaker,
          wine_name: w.name,
          wine_varietal: w.varietal,
          wine_year: w.year,
        },
        priorTastings
      );
      if (hit) out[i] = hit;
    });
    return out;
  }, [wines, priorTastings]);

  const handleAddWine = () => {
    setCurrentWineIndex(null);
    setShowWineForm(true);
  };

  const handleEditWine = (index) => {
    setCurrentWineIndex(index);
    setShowWineForm(true);
  };

  const handleDeleteWine = (index) => {
    Alert.alert('Remove wine', 'Remove this wine from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setWines((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  };

  const handleSaveWine = (wineData) => {
    setWines((prev) => {
      if (currentWineIndex !== null) {
        const next = [...prev];
        next[currentWineIndex] = wineData;
        return next;
      }
      return [...prev, wineData];
    });
    setShowWineForm(false);
    setCurrentWineIndex(null);
  };

  // Append wines read from a tasting card (#139). Each scanned field-set becomes
  // an unrated DRAFT wine (prefilled name/producer/type/varietal/year, no
  // ratings yet); the user then opens each one to rate it and add notes. When
  // the card omits a producer but the place is a winery, fall back to its name.
  const applyMenuScan = (scanned) => {
    if (!Array.isArray(scanned) || scanned.length === 0) return;
    const drafts = scanned.map((f) => ({
      winemaker: f.producer || winemakerDefault || '',
      name: f.wine_name || '',
      type: f.wine_type || '',
      varietal: parseVarietals(f.varietal),
      year: f.vintage || '',
      overallRating: 0,
      ratings: { sweetness: 0, tannins: 0, acidity: 0, body: 0, alcohol: 0 },
      flavorNotes: [],
      additionalNotes: '',
      photos: [],
    }));
    setWines((prev) => [...prev, ...drafts]);
    Alert.alert(
      'Wines added',
      `Added ${drafts.length} wine${drafts.length !== 1 ? 's' : ''} from the card. Open each one to rate it and add your notes.`
    );
  };

  const handleExitWineForm = () => {
    setShowWineForm(false);
    setCurrentWineIndex(null);
  };

  const handlePlaceSaved = (placeData) => {
    setPlace(placeData); // null = skipped / no location
    setShowPlacePicker(false);
  };

  // Visit photos (#137). Camera + library (multi-select); thumbnails with remove.
  // The save path uploads new local URIs and keeps existing https URLs as-is.
  const addVisitPhotoFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is needed to add a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        setVisitPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera. Try choosing from your library.');
    }
  };

  const addVisitPhotosFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is needed to add photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        setVisitPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } catch {
      Alert.alert('Library unavailable', 'Could not open your photo library. Try the camera instead.');
    }
  };

  const removeVisitPhoto = (index) =>
    setVisitPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleCancel = () => {
    if (wines.length === 0 && !place && !notes && visitPhotos.length === 0) {
      onCancel();
      return;
    }
    Alert.alert('Discard log?', 'Your unsaved wine log will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  };

  const handleSaveSession = async () => {
    // When editing, removing every wine means the user wants the log gone —
    // let the host confirm-and-delete instead of blocking on "add a wine".
    if (wines.length === 0 && !isEditing) {
      Alert.alert('Add a wine', 'Log at least one wine before saving.');
      return;
    }
    if (!visitDate) {
      Alert.alert('Add a date', 'Please enter a date for this log.');
      return;
    }
    if (!isValidISODate(visitDate)) {
      Alert.alert('Check the date', 'Please enter the date as YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        wineryId: place?.wineryId ?? null,
        placeType: place?.placeType ?? null,
        placeName: place?.placeName ?? null,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        date: visitDate,
        notes,
        wineryPhotos: visitPhotos, // visit-level photos (#137)
        wines,
        // Original ids let the edit orchestrator diff removed wines without a refetch.
        originalWineIds: initialSession
          ? (initialSession.wines || []).map((w) => w.id)
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderWineCard = (wine, index) => {
    const typeColor =
      wine.type?.toLowerCase() === 'red'
        ? colors.primary.base
        : wine.type?.toLowerCase() === 'white'
        ? colors.accent.base
        : colors.primary.soft;
    return (
      // Wines are removable, so an index key would misalign rows after a delete.
      <View key={wine.id ?? `draft-${index}-${wine.name ?? ''}`} style={styles.wineCard}>
        <View style={styles.wineCardHeader}>
          <View style={[styles.wineTypeBar, { backgroundColor: typeColor }]} />
          <View style={styles.wineInfo}>
            <Text style={styles.wineName} numberOfLines={1}>
              {wine.name || varietalText(wine.varietal) || 'Wine'}
            </Text>
            <Text style={styles.wineMeta} numberOfLines={1}>
              {[wine.winemaker, wine.year, wine.type].filter(Boolean).join(' · ')}
            </Text>
            {priorFlags[index] ? (
              <View style={styles.priorTag}>
                <Ionicons name="time-outline" size={10} color={colors.primary.ink} />
                <Text style={styles.priorTagText}>
                  {priorFlags[index].tier === TIER.RELATED && priorFlags[index].otherVintage
                    ? `You've tasted the ${priorFlags[index].otherVintage}`
                    : 'Logged before'}
                </Text>
              </View>
            ) : null}
          </View>
          {wine.overallRating ? (
            <View style={styles.scorePill}>
              <Ionicons name="star" size={13} color={colors.accent.base} />
              <Text style={styles.scoreText}>{Number(wine.overallRating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.wineActions}>
          <TouchableOpacity style={styles.actionLink} onPress={() => handleEditWine(index)}>
            <Ionicons name="pencil-outline" size={15} color={colors.primary.ink} />
            <Text style={styles.actionLinkText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionLink} onPress={() => handleDeleteWine(index)}>
            <Ionicons name="trash-outline" size={15} color={colors.status.error} />
            <Text style={[styles.actionLinkText, { color: colors.status.error }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPlace = () => {
    if (!place) {
      return (
        <TouchableOpacity
          style={styles.addPlaceCard}
          onPress={() => setShowPlacePicker(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="location-outline" size={20} color={colors.primary.ink} />
          <View style={styles.addPlaceText}>
            <Text style={styles.addPlaceTitle}>
              Add a place <Text style={styles.optTag}>· optional</Text>
            </Text>
            <Text style={styles.addPlaceSub}>Say where you had it, and drop a pin.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
        </TouchableOpacity>
      );
    }
    const meta = PLACE_META[place.placeType] || PLACE_META.other;
    const hasPin = place.latitude != null && place.longitude != null;
    return (
      <View style={styles.placeCard}>
        <View style={styles.placeIcon}>
          <Ionicons name={meta.icon} size={20} color={colors.primary.ink} />
        </View>
        <View style={styles.placeBody}>
          <Text style={styles.placeName} numberOfLines={1}>
            {place.placeName || meta.label}
          </Text>
          <View style={styles.placeMetaRow}>
            <Text style={styles.placeMeta}>{meta.label}</Text>
            {hasPin && (
              <View style={styles.pinChip}>
                <Ionicons name="location" size={11} color={colors.status.success} />
                <Text style={styles.pinChipText}>Pinned</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.placeActions}>
          <TouchableOpacity
            onPress={() => setShowPlacePicker(true)}
            style={styles.placeActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.primary.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPlace(null)}
            style={styles.placeActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={colors.neutral.inkTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.neutral.ink} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit log' : isSession ? 'Session' : 'Log a wine'}
          </Text>
          {wines.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {wines.length} wine{wines.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Scan a tasting card → add one draft wine per listing (#139). */}
        <TastingMenuScanner onScanned={applyMenuScan} />

        {/* Wines */}
        {wines.length === 0 ? (
          <View style={styles.emptyWines}>
            <Ionicons name="wine-outline" size={28} color={colors.neutral.placeholder} />
            <Text style={styles.emptyWinesText}>No wines yet</Text>
          </View>
        ) : (
          wines.map(renderWineCard)
        )}

        <TouchableOpacity style={styles.addWineBtn} onPress={handleAddWine} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.addWineBtnText}>
            {wines.length === 0 ? 'Add wine' : 'Add another wine'}
          </Text>
        </TouchableOpacity>

        {/* Place */}
        <Text style={styles.sectionLabel}>PLACE</Text>
        {renderPlace()}

        {/* Date */}
        <Text style={styles.sectionLabel}>DATE</Text>
        <TextInput
          style={styles.input}
          value={visitDate}
          onChangeText={setVisitDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.neutral.placeholder}
          selectionColor={colors.primary.ink}
        />
        <Text
          style={[
            styles.datePreview,
            // Surface a bad date before save: non-empty but unparseable → error color.
            !!visitDate && !isValidISODate(visitDate) && { color: colors.status.error },
          ]}
        >
          {formatDate(visitDate)}
        </Text>

        {/* Notes */}
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything about the occasion (optional)…"
          placeholderTextColor={colors.neutral.placeholder}
          multiline
          textAlignVertical="top"
          selectionColor={colors.primary.ink}
        />

        {/* Visit photos (#137) — a shot of the tasting card or the visit itself. */}
        <Text style={styles.sectionLabel}>PHOTOS</Text>
        {visitPhotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.visitPhotoRow}
          >
            {visitPhotos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.visitPhotoWrap}>
                <Image source={{ uri }} style={styles.visitPhoto} />
                <TouchableOpacity
                  style={styles.visitPhotoRemove}
                  onPress={() => removeVisitPhoto(index)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.status.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={styles.visitPhotoButtons}>
          <TouchableOpacity
            style={styles.visitPhotoBtn}
            onPress={addVisitPhotoFromCamera}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary.ink} />
            <Text style={styles.visitPhotoBtnText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.visitPhotoBtn}
            onPress={addVisitPhotosFromLibrary}
            activeOpacity={0.85}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary.ink} />
            <Text style={styles.visitPhotoBtnText}>Choose photos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: spacing.md + (insets.bottom || 0) }]}>
        <Button
          variant="primary"
          title={
            isEditing ? 'Save changes' : isSession ? 'Save session' : 'Save wine'
          }
          icon="checkmark-circle"
          loading={saving}
          disabled={wines.length === 0 && !isEditing}
          onPress={handleSaveSession}
        />
      </View>

      {/* Wine form modal */}
      <Modal visible={showWineForm} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.modalContainer, { paddingTop: insets.top || 10 }]} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={handleExitWineForm}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.neutral.ink} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentWineIndex !== null ? 'Edit wine' : 'Add wine'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <WineEntryForm
            onSave={handleSaveWine}
            onCancel={handleExitWineForm}
            initialData={currentWineIndex !== null ? wines[currentWineIndex] : null}
            defaultWinemaker={winemakerDefault}
            priorTastings={priorTastings}
            sessionWines={sessionWines}
          />
        </SafeAreaView>
      </Modal>

      {/* Place picker modal */}
      <PlacePicker
        visible={showPlacePicker}
        initialPlace={place}
        onSave={handlePlaceSaved}
        onClose={() => setShowPlacePicker(false)}
      />
    </SafeAreaView>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  headerSubtitle: { ...typography.body.small, color: colors.neutral.inkTertiary },
  headerSpacer: { width: 40 },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing.xl },

  emptyWines: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
  },
  emptyWinesText: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: spacing.sm },

  wineCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.soft,
  },
  wineCardHeader: { flexDirection: 'row', alignItems: 'center' },
  priorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 3,
    paddingVertical: 1,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  // body.small, not body.caption — caption uppercases (it's the label style), so
  // a vintage-aware badge would read "YOU'VE TASTED THE 2019".
  priorTagText: { ...typography.body.small, fontSize: 11, color: colors.primary.ink },
  wineTypeBar: { width: 4, height: 40, borderRadius: 2, marginRight: spacing.md },
  wineInfo: { flex: 1 },
  wineName: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '600',
    fontFamily: SERIF,
  },
  wineMeta: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  scoreText: { ...typography.body.small, color: colors.neutral.ink, fontWeight: '600' },
  wineActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginLeft: spacing.lg,
  },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLinkText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '500' },

  addWineBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addWineBtnText: { ...typography.body.regular, color: colors.onPrimary, fontWeight: '600' },

  sectionLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  addPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderStyle: 'dashed',
    backgroundColor: colors.neutral.surface,
  },
  addPlaceText: { flex: 1 },
  addPlaceTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  addPlaceSub: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
  optTag: { ...typography.body.small, color: colors.neutral.inkTertiary, fontWeight: '400' },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    ...shadows.soft,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: { flex: 1 },
  placeName: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '600',
    fontFamily: SERIF,
  },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  placeMeta: { ...typography.body.small, color: colors.neutral.inkTertiary },
  pinChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pinChipText: { ...typography.body.small, color: colors.status.success },
  placeActions: { flexDirection: 'row', gap: spacing.xs },
  placeActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.ink,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  datePreview: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  // Visit photos (#137)
  visitPhotoRow: {
    marginTop: spacing.sm,
  },
  visitPhotoWrap: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  visitPhoto: {
    width: 84,
    height: 84,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  visitPhotoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.bg,
    borderRadius: 12,
  },
  visitPhotoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  visitPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: colors.neutral.surface,
  },
  visitPhotoBtnText: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontWeight: '600',
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
    backgroundColor: colors.neutral.bg,
  },

  modalContainer: { flex: 1, backgroundColor: colors.neutral.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  modalTitle: {
    flex: 1,
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    textAlign: 'center',
  },
});
return { colors, spacing, styles };
});
