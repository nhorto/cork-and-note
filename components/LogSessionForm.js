// components/LogSessionForm.js
// Château Label Design - Elegant & Refined
// The location-optional logging session (Epic #5, docs/design/logging-flow.md).
// One session holds 1…N wines + an optional place. A single wine reads like a
// quick entry (the "B" feel); add another and it becomes a winery-trip recap
// (the "A" feel) — same underlying data, two experiences.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../styles/theme';
import PlacePicker from './PlacePicker';
import WineEntryForm from './WineEntryForm';

const { colors, typography, spacing, shadows, borderRadius } = theme;

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

export default function LogSessionForm({ mode = 'wine', winery = null, onSave, onCancel }) {
  const insets = useSafeAreaInsets();

  const [wines, setWines] = useState([]);
  const [place, setPlace] = useState(
    winery
      ? {
          placeType: 'winery',
          placeName: winery.name,
          wineryId: winery.id,
          latitude: winery.latitude != null ? Number(winery.latitude) : null,
          longitude: winery.longitude != null ? Number(winery.longitude) : null,
        }
      : null
  );
  const [visitDate, setVisitDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  // B-first: "Log a wine" drops you straight into the wine form.
  useEffect(() => {
    if (mode === 'wine' && wines.length === 0) {
      setCurrentWineIndex(null);
      setShowWineForm(true);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSession = wines.length >= 2;
  const winemakerDefault = place?.placeType === 'winery' ? place?.placeName || '' : '';

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

  const handleExitWineForm = () => {
    setShowWineForm(false);
    setCurrentWineIndex(null);
  };

  const handlePlaceSaved = (placeData) => {
    setPlace(placeData); // null = skipped / no location
    setShowPlacePicker(false);
  };

  const handleCancel = () => {
    if (wines.length === 0 && !place && !notes) {
      onCancel();
      return;
    }
    Alert.alert('Discard log?', 'Your unsaved wine log will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  };

  const handleSaveSession = async () => {
    if (wines.length === 0) {
      Alert.alert('Add a wine', 'Log at least one wine before saving.');
      return;
    }
    if (!visitDate) {
      Alert.alert('Add a date', 'Please enter a date for this log.');
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
        wines,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderWineCard = (wine, index) => {
    const typeColor =
      wine.type?.toLowerCase() === 'red'
        ? colors.primary.burgundy
        : wine.type?.toLowerCase() === 'white'
        ? colors.gold.rich
        : colors.primary.rosé;
    return (
      <View key={index} style={styles.wineCard}>
        <View style={styles.wineCardHeader}>
          <View style={[styles.wineTypeBar, { backgroundColor: typeColor }]} />
          <View style={styles.wineInfo}>
            <Text style={styles.wineName} numberOfLines={1}>
              {wine.varietal || wine.name || 'Wine'}
            </Text>
            <Text style={styles.wineMeta} numberOfLines={1}>
              {[wine.winemaker, wine.year, wine.type].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {wine.overallRating ? (
            <View style={styles.scorePill}>
              <Ionicons name="star" size={13} color={colors.gold.rich} />
              <Text style={styles.scoreText}>{Number(wine.overallRating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.wineActions}>
          <TouchableOpacity style={styles.actionLink} onPress={() => handleEditWine(index)}>
            <Ionicons name="pencil-outline" size={15} color={colors.primary.burgundy} />
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
          <Ionicons name="location-outline" size={20} color={colors.primary.burgundy} />
          <View style={styles.addPlaceText}>
            <Text style={styles.addPlaceTitle}>
              Add a place <Text style={styles.optTag}>· optional</Text>
            </Text>
            <Text style={styles.addPlaceSub}>Say where you had it, and drop a pin.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
        </TouchableOpacity>
      );
    }
    const meta = PLACE_META[place.placeType] || PLACE_META.other;
    const hasPin = place.latitude != null && place.longitude != null;
    return (
      <View style={styles.placeCard}>
        <View style={styles.placeIcon}>
          <Ionicons name={meta.icon} size={20} color={colors.primary.burgundy} />
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
          <TouchableOpacity onPress={() => setShowPlacePicker(true)} style={styles.placeActionBtn}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary.burgundy} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPlace(null)} style={styles.placeActionBtn}>
            <Ionicons name="close" size={18} color={colors.neutral.pewter} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{isSession ? 'Session' : 'Log a Wine'}</Text>
          {wines.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {wines.length} wine{wines.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Wines */}
        {wines.length === 0 ? (
          <View style={styles.emptyWines}>
            <Ionicons name="wine-outline" size={28} color={colors.neutral.silver} />
            <Text style={styles.emptyWinesText}>No wines yet</Text>
          </View>
        ) : (
          wines.map(renderWineCard)
        )}

        <TouchableOpacity style={styles.addWineBtn} onPress={handleAddWine} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={colors.neutral.cream} />
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
          placeholderTextColor={colors.neutral.silver}
          selectionColor={colors.primary.burgundy}
        />
        <Text style={styles.datePreview}>{formatDate(visitDate)}</Text>

        {/* Notes */}
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything about the occasion (optional)…"
          placeholderTextColor={colors.neutral.silver}
          multiline
          textAlignVertical="top"
          selectionColor={colors.primary.burgundy}
        />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: spacing.md + (insets.bottom || 0) }]}>
        <TouchableOpacity
          style={[styles.saveBtn, (wines.length === 0 || saving) && styles.saveBtnDisabled]}
          onPress={handleSaveSession}
          activeOpacity={0.85}
          disabled={wines.length === 0 || saving}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.neutral.cream} />
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving…' : isSession ? 'Save session' : 'Save wine'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Wine form modal */}
      <Modal visible={showWineForm} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.modalContainer, { paddingTop: insets.top || 10 }]} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalClose} onPress={handleExitWineForm}>
              <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentWineIndex !== null ? 'Edit Wine' : 'Add Wine'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <WineEntryForm
            onSave={handleSaveWine}
            onCancel={handleExitWineForm}
            initialData={currentWineIndex !== null ? wines[currentWineIndex] : null}
            defaultWinemaker={winemakerDefault}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerSubtitle: { ...typography.body.small, color: colors.neutral.pewter },
  headerSpacer: { width: 40 },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing.xl },

  emptyWines: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderStyle: 'dashed',
  },
  emptyWinesText: { ...typography.body.small, color: colors.neutral.silver, marginTop: spacing.sm },

  wineCard: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },
  wineCardHeader: { flexDirection: 'row', alignItems: 'center' },
  wineTypeBar: { width: 4, height: 40, borderRadius: 2, marginRight: spacing.md },
  wineInfo: { flex: 1 },
  wineName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  wineMeta: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 2 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  scoreText: { ...typography.body.small, color: colors.neutral.charcoal, fontWeight: '600' },
  wineActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginLeft: spacing.lg,
  },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLinkText: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '500' },

  addWineBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addWineBtnText: { ...typography.body.regular, color: colors.neutral.cream, fontWeight: '600' },

  sectionLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
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
    borderColor: colors.gold.muted,
    borderStyle: 'dashed',
    backgroundColor: colors.neutral.parchment,
  },
  addPlaceText: { flex: 1 },
  addPlaceTitle: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  addPlaceSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 2 },
  optTag: { ...typography.body.small, color: colors.neutral.silver, fontWeight: '400' },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
    ...shadows.soft,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: { flex: 1 },
  placeName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  placeMeta: { ...typography.body.small, color: colors.neutral.pewter },
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
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  datePreview: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
    backgroundColor: colors.neutral.cream,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },

  modalContainer: { flex: 1, backgroundColor: colors.neutral.cream },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  modalTitle: {
    flex: 1,
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
});
