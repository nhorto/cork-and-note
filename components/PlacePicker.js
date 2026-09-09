// components/PlacePicker.js
// Château Label Design - Elegant & Refined
// The optional "Where did you have it?" step for the logging flow
// (docs/design/logging-flow.md, Screen 2). Place is attached to the whole
// session, so every wine in the log inherits it. Always skippable —
// no-location is the default.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { wineriesService } from '../lib/wineries';
import theme from '../styles/theme';
import Button from './Button';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;
const PLACE_TYPES = [
  { id: 'winery', label: 'Winery' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'other', label: 'Elsewhere' },
];

export default function PlacePicker({ visible, initialPlace, onSave, onClose }) {
  const [placeType, setPlaceType] = useState('winery');
  const [placeName, setPlaceName] = useState('');
  const [wineryId, setWineryId] = useState(null);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  const [knownWineries, setKnownWineries] = useState([]);
  const [locating, setLocating] = useState(false);

  // Hydrate from any place already set on the session
  useEffect(() => {
    if (!visible) return;
    setPlaceType(initialPlace?.placeType || 'winery');
    setPlaceName(initialPlace?.placeName || '');
    setWineryId(initialPlace?.wineryId || null);
    setLatitude(initialPlace?.latitude ?? null);
    setLongitude(initialPlace?.longitude ?? null);
  }, [visible, initialPlace]);

  // Load the user's known wineries once for search/suggestions
  useEffect(() => {
    let active = true;
    (async () => {
      const result = await wineriesService.getUserWineries();
      if (active && result?.success) setKnownWineries(result.wineries || []);
    })();
    return () => { active = false; };
  }, []);

  const hasPin = latitude != null && longitude != null;

  const suggestions =
    placeType === 'winery' && placeName.trim().length > 0
      ? knownWineries
          .filter(
            (w) =>
              w?.name &&
              w.name.toLowerCase().includes(placeName.trim().toLowerCase()) &&
              w.name.toLowerCase() !== placeName.trim().toLowerCase()
          )
          .slice(0, 4)
      : [];

  const selectKnownWinery = (winery) => {
    setPlaceName(winery.name);
    setWineryId(winery.id);
    if (winery.latitude != null && winery.longitude != null) {
      setLatitude(Number(winery.latitude));
      setLongitude(Number(winery.longitude));
    }
  };

  const onChangePlaceName = (text) => {
    setPlaceName(text);
    // Typing a new name detaches it from a previously matched winery record
    if (wineryId) setWineryId(null);
  };

  const useCurrentLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to drop a pin, or set it manually on the map.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
    } catch {
      Alert.alert('Could not get location', 'Please try again or set the pin manually.');
    } finally {
      setLocating(false);
    }
  };

  const clearPin = () => {
    setLatitude(null);
    setLongitude(null);
  };

  const handleUseThisPlace = () => {
    if (placeType !== 'other' && !placeName.trim()) {
      const what = placeType === 'winery' ? 'winery' : 'restaurant';
      Alert.alert('Add a name', `Enter the ${what} name, or choose Elsewhere.`);
      return;
    }
    onSave({
      placeType,
      placeName: placeType === 'other' ? (placeName.trim() || null) : placeName.trim(),
      wineryId: placeType === 'winery' ? wineryId : null,
      latitude: hasPin ? latitude : null,
      longitude: hasPin ? longitude : null,
    });
  };

  const handleSkip = () => {
    onSave(null); // no location
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="chevron-back" size={24} color={colors.neutral.ink} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Where?</Text>
            <Text style={styles.headerSubtitle}>Optional</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Place type segmented control */}
          <Text style={styles.label}>PLACE TYPE</Text>
          <View style={styles.segment}>
            {PLACE_TYPES.map((t) => {
              const on = placeType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.segItem, on && styles.segItemOn]}
                  onPress={() => setPlaceType(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Pick a type, or skip this entirely.</Text>

          {/* Name field (winery / restaurant) */}
          {placeType !== 'other' && (
            <>
              <Text style={styles.label}>{placeType === 'winery' ? 'WINERY' : 'RESTAURANT'}</Text>
              <TextInput
                style={styles.input}
                value={placeName}
                onChangeText={onChangePlaceName}
                placeholder={placeType === 'winery' ? 'Search or type a winery' : 'Restaurant name'}
                placeholderTextColor={colors.neutral.placeholder}
                selectionColor={colors.primary.base}
              />
              {wineryId && (
                <Text style={styles.matchedHint}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />{' '}
                  Matched from your wineries — pin set.
                </Text>
              )}
              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.suggestionRow}
                      onPress={() => selectKnownWinery(w)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="location-outline" size={16} color={colors.primary.base} />
                      <Text style={styles.suggestionText} numberOfLines={1}>{w.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {placeType === 'other' && (
            <Text style={styles.elsewhereNote}>
              No details needed — this log just won&apos;t have a location pinned.
            </Text>
          )}

          {/* Optional pin */}
          {placeType !== 'other' && (
            <>
              <View style={styles.pinHeader}>
                <Text style={styles.label}>PIN</Text>
                <Text style={styles.optTag}>optional</Text>
              </View>

              {hasPin ? (
                <View style={styles.mapWrap}>
                  <MapView
                    style={styles.map}
                    region={{
                      latitude,
                      longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    pointerEvents="none"
                  >
                    <Marker coordinate={{ latitude, longitude }} />
                  </MapView>
                  <TouchableOpacity
                    style={styles.clearPin}
                    onPress={clearPin}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove pin"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color={colors.neutral.bg} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.locButton}
                  onPress={useCurrentLocation}
                  activeOpacity={0.8}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={colors.primary.base} />
                  ) : (
                    <Ionicons name="navigate" size={18} color={colors.primary.base} />
                  )}
                  <Text style={styles.locButtonText}>
                    {locating ? 'Locating…' : 'Use my current location'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <Button variant="primary" title="Use this place" onPress={handleUseThisPlace} />
          <Button
            variant="ghost"
            title="Skip — no location"
            onPress={handleSkip}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

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
    // 44pt minimum touch target (launch plan §3.3)
    width: 44,
    height: 44,
    borderRadius: 22,
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

  label: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  hint: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.xs,
  },
  matchedHint: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.xs,
  },
  elsewhereNote: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  segment: { flexDirection: 'row', gap: spacing.sm },
  segItem: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
  },
  segItemOn: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  segText: { ...typography.body.regular, color: colors.neutral.inkSecondary, fontWeight: '500' },
  segTextOn: { color: colors.neutral.bg, fontWeight: '600' },

  input: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.ink,
  },

  suggestions: {
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  suggestionText: { ...typography.body.regular, color: colors.neutral.ink, flex: 1 },

  pinHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  optTag: { ...typography.body.small, color: colors.neutral.inkTertiary, fontStyle: 'italic' },

  mapWrap: {
    height: 150,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent.border,
    ...shadows.soft,
  },
  map: { ...StyleSheet.absoluteFillObject },
  clearPin: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.overlay.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderStyle: 'dashed',
    backgroundColor: colors.neutral.surface,
  },
  locButtonText: { ...typography.body.regular, color: colors.primary.base, fontWeight: '600' },

  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
    backgroundColor: colors.neutral.bg,
  },
});
