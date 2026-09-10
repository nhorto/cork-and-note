// Updated WineEntryForm.js with multiple photos support
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import theme from '../styles/theme';

import { findPriorTastings } from '../lib/cellarMatch';
import { inferTypeFromVarietals, parseVarietals } from '../lib/varietals';
import AutocompleteVarietal from './AutocompleteVarietal';
import Button from './Button';
import CollapsibleSection from './CollapsibleSection';
import FlavorTagSelector from './FlavorTagSelector';
import LabelScanner from './LabelScanner';
import PriorTastingBanner from './PriorTastingBanner';
import SegmentedRating from './SegmentedRating';
import StarRatingInput from './StarRatingInput';
import WineChatModal from './WineChatModal';

const { colors, typography, spacing, shadows, borderRadius } = theme;
const SERIF = typography.fonts.serif;
// pagingEnabled snaps to the screen width, so the photo pages must match it —
// a hardcoded 400 desyncs the pager and the "N of M" indicator.
const SCREEN_WIDTH = Dimensions.get('window').width;

const WINE_TYPES = [
  'Red', 'White', 'Rosé', 'Sparkling', 'Dessert',
  'Red Blend', 'White Blend', 'Orange'
];

export default function WineEntryForm({
  onSave,
  onCancel,
  initialData,
  defaultWinemaker = '',
  // Duplicate-tasting awareness (#93). Both default to empty so the form still
  // works standalone — no banner, no crash.
  priorTastings = [], // flattened tastings from OTHER visits
  sessionWines = [], // match-shaped drafts already on the current visit
  onOpenTasting, // (wine) => void — deep-link to a prior tasting
}) {
  // Form state
  const [winemaker, setWinemaker] = useState(defaultWinemaker);
  const [wineName, setWineName] = useState('');
  const [wineType, setWineType] = useState(''); // optional — no longer defaults to "Red"
  // Who set the type (#216): 'none' | 'auto' (inferred from varietals) |
  // 'user' (picked in the modal, scanned off the label, edited data, or an
  // applied AI suggestion). Varietal-based inference only ever writes over
  // 'none'/'auto' — a type the user chose is never silently replaced.
  const [typeSource, setTypeSource] = useState('none');
  // Varietals are now a list (a blend can have several grapes, #135). The text
  // box feeds `varietalInput`; confirmed grapes live in `wineVarietals`.
  const [wineVarietals, setWineVarietals] = useState([]);
  const [varietalInput, setVarietalInput] = useState('');
  const [wineYear, setWineYear] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [ratings, setRatings] = useState({
    sweetness: 0,
    tannins: 0,
    acidity: 0,
    body: 0,
    alcohol: 0
  });
  const [flavorNotes, setFlavorNotes] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [photos, setPhotos] = useState([]); // Changed from single photo to array
  
  // Modal state
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showChatModal, setShowChatModal] = useState(false);
  // Conversation id for the in-form sommelier chat. Tracked here so closing and
  // reopening "Ask the Sommelier" during a single logging session resumes the
  // SAME thread instead of starting over (#121). Resets when the form remounts.
  const [chatConversationId, setChatConversationId] = useState(null);

  // AI suggestion confirmation state
  const [pendingFields, setPendingFields] = useState([]); // [{ key, label, current, suggested, apply, set }]
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // iOS can't present the confirm modal while the chat modal is still up, so we
  // close the chat first and open confirm from its onDismiss. This flag marks
  // that a confirm is pending for that dismissal (vs. a plain chat close) (#120).
  const pendingConfirmRef = useRef(false);

  // Double-tap guard for "Save Wine": two rapid presses would call onSave twice
  // and append the wine to the session twice. Resets when the form remounts
  // (the wine-form modal unmounts its children when hidden) or when new
  // initialData loads.
  const submittedRef = useRef(false);

  // Load initial data if editing an existing wine
  useEffect(() => {
    submittedRef.current = false;
    if (initialData) {
      setWinemaker(initialData.winemaker || defaultWinemaker || '');
      setWineName(initialData.name || '');
      setWineType(initialData.type || '');
      // An existing type came from the user (or a scan they accepted) — don't
      // let varietal edits overwrite it.
      setTypeSource(initialData.type ? 'user' : 'none');
      setWineVarietals(parseVarietals(initialData.varietal));
      setWineYear(initialData.year || '');
      setOverallRating(initialData.overallRating || 0);
      setRatings(initialData.ratings || {
        sweetness: 0,
        tannins: 0,
        acidity: 0,
        body: 0,
        alcohol: 0
      });
      setFlavorNotes(initialData.flavorNotes || []);
      setAdditionalNotes(initialData.additionalNotes || '');
      
      // Handle both legacy single photo and new multiple photos
      if (initialData.photos && Array.isArray(initialData.photos)) {
        setPhotos(initialData.photos);
      } else if (initialData.photo) {
        setPhotos([initialData.photo]);
      } else {
        setPhotos([]);
      }
    }
  }, [initialData]);

  // ── Duplicate-tasting awareness (#93) ────────────────────────────────────
  // Debounced so the banner doesn't flicker mid-word. The corpus is already in
  // memory (visits are cached) and the match is a linear scan over a few hundred
  // objects, so this costs nothing — the delay is purely cosmetic.
  const [matchDraft, setMatchDraft] = useState(null);
  const [dupDismissed, setDupDismissed] = useState(false);

  // A wine that's already SAVED always matches itself, and editing is a
  // different mental mode (fixing a typo, not discovering a duplicate) — so the
  // banner is suppressed there. Scanned drafts have no id yet, so they still get it.
  const isPersisted = initialData?.id != null;

  useEffect(() => {
    const t = setTimeout(() => {
      setMatchDraft({
        winemaker,
        wine_name: wineName,
        wine_varietal: wineVarietals,
        wine_year: wineYear,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [winemaker, wineName, wineVarietals, wineYear]);

  // Re-arm the banner when the identity changes — a dismissal applies to the
  // wine it was shown for, not to the rest of the editing session.
  useEffect(() => {
    setDupDismissed(false);
  }, [winemaker, wineName, wineYear, wineVarietals]);

  // A duplicate WITHIN the current visit is the stronger signal (that one is
  // probably a genuine mistake), so it wins when both would fire.
  const sessionDup = useMemo(
    () => (isPersisted || !matchDraft ? null : findPriorTastings(matchDraft, sessionWines)),
    [isPersisted, matchDraft, sessionWines]
  );
  const priorDup = useMemo(
    () =>
      isPersisted || !matchDraft
        ? null
        : findPriorTastings(matchDraft, priorTastings, { excludeIds: [initialData?.id] }),
    [isPersisted, matchDraft, priorTastings, initialData?.id]
  );
  const duplicate = sessionDup || priorDup;

  // Request permissions for camera and media library
  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and media library permissions are needed to take and save photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  };
  
  // Take a photo with the camera
  const takePhoto = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhoto = result.assets[0].uri;
        setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
      }
    } catch (error) {
      console.log('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Pick an image from the media library
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Photo library permission is needed to select photos.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true, // Allow multiple selection
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Remove a photo
  const removePhoto = (index) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
          }
        }
      ]
    );
  };

  // View photo in full screen
  const viewPhoto = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };
  
  // Update specific rating value
  const updateRating = (key, value) => {
    setRatings((prevRatings) => ({
      ...prevRatings,
      [key]: value,
    }));
  };
  
  // Handle wine type selection
  const handleWineTypeSelect = (type) => {
    setWineTypeByUser(type);
    setShowTypeModal(false);
  };

  // A deliberate type choice — from the picker modal, a label scan, or an
  // applied AI suggestion. Marks the field user-owned so inference backs off.
  const setWineTypeByUser = (type) => {
    setWineType(type);
    setTypeSource('user');
  };

  // Varietal → type inference (#216): adding "Cabernet Sauvignon" flips the
  // type to Red; a second red grape upgrades it to Red Blend. Only fires while
  // the type is unset or was itself inferred, and clears an inferred type when
  // the varietals stop supporting it (e.g. all chips removed) — so the field
  // never keeps a stale guess, and never fights the user.
  useEffect(() => {
    if (typeSource === 'user') return;
    const inferred = inferTypeFromVarietals(wineVarietals);
    if (inferred) {
      setWineType(inferred);
      setTypeSource('auto');
    } else if (typeSource === 'auto') {
      setWineType('');
      setTypeSource('none');
    }
  }, [wineVarietals, typeSource]);

  // Label scan → prefill (#138). Reuses the cellar's LabelScanner; we map the
  // whitelisted, normalized fields onto the form's state. Only non-null values
  // are applied (a scan never blanks a field), and varietals MERGE into the chip
  // list. Prefill-only: the user reviews/edits everything before saving.
  const applyScan = (fields) => {
    if (!fields) return;
    if (fields.producer != null) setWinemaker(fields.producer);
    if (fields.wine_name != null) setWineName(fields.wine_name);
    if (fields.wine_type != null) setWineTypeByUser(fields.wine_type);
    if (fields.vintage != null) setWineYear(String(fields.vintage));
    if (fields.varietal != null) {
      const incoming = parseVarietals(fields.varietal);
      setWineVarietals((prev) => {
        const merged = [...prev];
        incoming.forEach((g) => {
          if (!merged.some((x) => x.toLowerCase() === g.toLowerCase())) merged.push(g);
        });
        return merged;
      });
    }
    // region: the tasting form has no region field — ignored.
  };

  // Add / remove a varietal chip (#135). Case-insensitive de-dupe; trims blanks.
  const addVarietal = (raw) => {
    const g = (raw || '').trim();
    if (!g) return;
    setWineVarietals((prev) =>
      prev.some((x) => x.toLowerCase() === g.toLowerCase()) ? prev : [...prev, g]
    );
    setVarietalInput('');
  };
  const removeVarietal = (g) =>
    setWineVarietals((prev) => prev.filter((x) => x !== g));
  
  // Clamp a numeric rating into the 0–5 range; returns null if not a finite number
  const clampRating = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.min(5, num));
  };

  // Handle AI suggestions — build a non-destructive confirmation list.
  // Each field is pre-checked ONLY when the corresponding form field is empty,
  // so user-entered values are never silently clobbered.
  const handleUseSuggestions = (suggestions) => {
    if (!suggestions || typeof suggestions !== 'object') {
      setShowChatModal(false);
      return;
    }

    const fields = [];

    // --- Text / select fields ---
    const addTextField = (key, label, suggested, current, setter) => {
      if (suggested == null) return;
      const suggestedStr = String(suggested).trim();
      if (!suggestedStr) return;
      const currentStr = (current ?? '').toString();
      if (currentStr.trim() === suggestedStr) return; // no change
      fields.push({
        key,
        label,
        current: currentStr,
        suggestedDisplay: suggestedStr,
        apply: !currentStr.trim(), // pre-checked only when currently empty
        applyValue: () => setter(suggestedStr),
      });
    };

    addTextField('winemaker', 'Winemaker', suggestions.winemaker, winemaker, setWinemaker);
    addTextField('wine_name', 'Wine name', suggestions.wine_name, wineName, setWineName);
    addTextField('wine_type', 'Type', suggestions.wine_type, wineType, setWineTypeByUser);
    addTextField('year', 'Year', suggestions.year, wineYear, setWineYear);

    // Varietal(s): MERGE into the chip list (multi-varietal, #135) — never discard
    // grapes the user already added.
    if (suggestions.varietal != null) {
      const incoming = parseVarietals(suggestions.varietal);
      const newOnes = incoming.filter(
        (g) => !wineVarietals.some((x) => x.toLowerCase() === g.toLowerCase())
      );
      if (newOnes.length > 0) {
        fields.push({
          key: 'varietal',
          label: 'Varietal',
          current: wineVarietals.length ? wineVarietals.join(', ') : '(none)',
          suggestedDisplay: `+ ${newOnes.join(', ')}`,
          apply: wineVarietals.length === 0, // pre-check only when none added yet
          applyValue: () =>
            setWineVarietals((prev) => {
              const merged = [...prev];
              newOnes.forEach((g) => {
                if (!merged.some((x) => x.toLowerCase() === g.toLowerCase())) merged.push(g);
              });
              return merged;
            }),
        });
      }
    }

    // --- Flavor tags: MERGE with existing (dedup), never discard user's choices ---
    if (Array.isArray(suggestions.flavor_tags) && suggestions.flavor_tags.length > 0) {
      const incoming = suggestions.flavor_tags
        .map(t => (t == null ? '' : String(t).trim()))
        .filter(Boolean);
      const merged = Array.from(new Set([...flavorNotes, ...incoming]));
      const newOnes = incoming.filter(t => !flavorNotes.includes(t));
      if (newOnes.length > 0) {
        fields.push({
          key: 'flavor_tags',
          label: 'Flavor notes',
          current: flavorNotes.length ? flavorNotes.join(', ') : '(none)',
          suggestedDisplay: `+ ${newOnes.join(', ')}`,
          apply: true, // merge is additive, safe to pre-check
          applyValue: () => setFlavorNotes(merged),
        });
      }
    }

    // --- Detailed characteristics → ratings state (keys must exist in ratings) ---
    const chars = suggestions.characteristics;
    if (chars && typeof chars === 'object') {
      Object.keys(ratings).forEach((key) => {
        if (!(key in chars)) return;
        const clamped = clampRating(chars[key]);
        if (clamped == null) return;
        const currentVal = ratings[key];
        if (currentVal === clamped) return;
        fields.push({
          key: `rating_${key}`,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          current: `${currentVal}/5`,
          suggestedDisplay: `${clamped}/5`,
          apply: !currentVal, // pre-checked only when currently unset (0)
          applyValue: () => updateRating(key, clamped),
        });
      });
    }

    // --- Overall rating ---
    const overall = clampRating(suggestions.overall_rating);
    if (overall != null && overall !== overallRating) {
      fields.push({
        key: 'overall_rating',
        label: 'Overall rating',
        current: `${overallRating}/5`,
        suggestedDisplay: `${overall}/5`,
        apply: !overallRating,
        applyValue: () => setOverallRating(overall),
      });
    }

    // --- Additional notes ---
    if (suggestions.additional_notes != null) {
      const note = String(suggestions.additional_notes).trim();
      if (note && note !== additionalNotes.trim()) {
        fields.push({
          key: 'additional_notes',
          label: 'Additional notes',
          current: additionalNotes.trim() || '(empty)',
          suggestedDisplay: note,
          apply: !additionalNotes.trim(),
          applyValue: () => setAdditionalNotes(note),
        });
      }
    }

    if (fields.length === 0) {
      // Nothing new to apply
      Alert.alert('Nothing to apply', "These suggestions already match what you've entered.");
      setShowChatModal(false);
      return;
    }

    setPendingFields(fields);
    // Don't nest modals (#120): close the chat sheet first, then present the
    // confirm sheet. On iOS you can't present a 2nd modal while the 1st is still
    // dismissing — so we wait for the chat modal's onDismiss. Android has no such
    // restriction, so we can open the confirm immediately.
    setShowChatModal(false);
    if (Platform.OS === 'ios') {
      pendingConfirmRef.current = true; // opened in handleChatDismissed()
    } else {
      setShowConfirmModal(true);
    }
  };

  // Fired after the chat modal has fully dismissed (iOS). If we closed it to show
  // the suggestions confirmation, open that now — never while the chat is still up.
  const handleChatDismissed = () => {
    if (pendingConfirmRef.current) {
      pendingConfirmRef.current = false;
      setShowConfirmModal(true);
    }
  };

  // Toggle a single field's apply flag in the confirmation panel
  const togglePendingField = (key) => {
    setPendingFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, apply: !f.apply } : f))
    );
  };

  // Apply only the toggled-on suggestions, then close. (The chat modal was
  // already closed before this confirm modal opened — see handleUseSuggestions.)
  const applyPendingSuggestions = () => {
    pendingFields.forEach((f) => {
      if (f.apply) f.applyValue();
    });
    setShowConfirmModal(false);
    setPendingFields([]);
  };

  // Dismiss the confirmation without applying anything
  const cancelPendingSuggestions = () => {
    setShowConfirmModal(false);
    setPendingFields([]);
  };

  // Handle form submission
  const handleSave = () => {
    // Ignore a second rapid tap — the first one already saved this wine.
    if (submittedRef.current) return;

    // Required = winemaker only. Everything else (incl. varietal) is optional —
    // blends and unknowns shouldn't block a save (#133). Display falls back to
    // name → varietal → type via lib/wineDisplay.js.
    if (!winemaker.trim()) {
      Alert.alert('Missing Information', 'Please enter the winemaker (a winery or producer).');
      return;
    }

    submittedRef.current = true;

    // Create wine data object
    const wineData = {
      // Preserve the id when editing an existing wine so the edit flow can
      // diff/update it rather than treating it as a brand-new wine.
      id: initialData?.id,
      winemaker: winemaker.trim(),
      name: wineName,
      type: wineType || null,
      varietal: wineVarietals,
      year: wineYear,
      overallRating: overallRating,
      ratings: ratings,
      flavorNotes: flavorNotes,
      additionalNotes: additionalNotes,
      photos: photos, // Send array of photos
      // Keep legacy support
      photo: photos.length > 0 ? photos[0] : null
    };
    
    onSave(wineData);
  };

  // Render photo gallery
  const renderPhotoGallery = () => {
    if (photos.length === 0) {
      return (
        <View style={styles.noPhotosContainer}>
          <Ionicons name="camera-outline" size={32} color="#999" />
          <Text style={styles.noPhotosText}>No photos added</Text>
        </View>
      );
    }

    return (
      <View style={styles.photoGallery}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <TouchableOpacity onPress={() => viewPhoto(index)}>
                <Image source={{ uri: photo }} style={styles.photoThumbnail} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => removePhoto(index)}
                accessibilityRole="button"
                accessibilityLabel="Remove"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Live summaries for the collapsed sections (#216) — collapsed must never
  // mean hidden, so each header shows what's inside once data exists.
  const ratingsSummaryParts = Object.entries(ratings)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v % 1 ? v.toFixed(1) : v}`);
  const ratingsSummary = ratingsSummaryParts.length
    ? ratingsSummaryParts.join(' · ')
    : 'Sweetness, tannins, acidity, body, alcohol';
  const flavorSummary = flavorNotes.length
    ? flavorNotes.slice(0, 3).join(', ') + (flavorNotes.length > 3 ? ` +${flavorNotes.length - 3}` : '')
    : 'What did you taste?';
  const photosSummary = photos.length
    ? `${photos.length} photo${photos.length === 1 ? '' : 's'}`
    : 'Label, glass, the view…';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Scan a bottle label to prefill the fields below (#138) */}
      <LabelScanner onScanned={applyScan} />

      {/* Wine Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wine information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Winemaker *</Text>
          <TextInput
            style={styles.input}
            value={winemaker}
            onChangeText={setWinemaker}
            placeholder="Winery or producer — whatever made it"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Varietal{wineVarietals.length ? ` (${wineVarietals.length})` : ''}
          </Text>

          {/* Selected grapes as removable chips (#135) */}
          {wineVarietals.length > 0 && (
            <View style={styles.varietalChips}>
              {wineVarietals.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={styles.varietalChip}
                  onPress={() => removeVarietal(g)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.varietalChipText}>{g}</Text>
                  <Ionicons name="close" size={14} color={colors.primary.base} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Type a grape (autocomplete) and add it; repeat for blends. */}
          <View style={styles.varietalAddRow}>
            <View style={styles.varietalAddInput}>
              <AutocompleteVarietal
                value={varietalInput}
                onChangeText={setVarietalInput}
                onSelect={addVarietal}
                wineType={wineType}
                placeholder="Add a grape — e.g. Cabernet (optional)"
              />
            </View>
            <TouchableOpacity
              style={[styles.varietalAddButton, !varietalInput.trim() && styles.varietalAddButtonDisabled]}
              onPress={() => addVarietal(varietalInput)}
              disabled={!varietalInput.trim()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add grape"
            >
              <Ionicons name="add" size={22} color={colors.neutral.bg} />
            </TouchableOpacity>
          </View>
          <Text style={styles.varietalHint}>
            Not listed? Type the grape and tap +. Add each grape for a blend.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wine name</Text>
          <TextInput
            style={styles.input}
            value={wineName}
            onChangeText={setWineName}
            placeholder="Optional — a specific bottling or label"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={[styles.selectorText, !wineType && styles.selectorPlaceholder]}>
              {wineType || 'Select type (optional)'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={wineYear}
            onChangeText={setWineYear}
            placeholder="e.g., 2021"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>

        {/* "You've logged this before" (#93). Sits with the identity fields it
            is derived from, and ABOVE the ratings — never blocks the save. */}
        {duplicate && !dupDismissed ? (
          <PriorTastingBanner
            result={duplicate}
            variant={sessionDup ? 'session' : 'prior'}
            onDismiss={() => setDupDismissed(true)}
            onOpen={sessionDup ? undefined : onOpenTasting}
          />
        ) : null}

        {/* Ask the Sommelier button */}
        <TouchableOpacity
          style={styles.sommelierButton}
          onPress={() => setShowChatModal(true)}
        >
          <Ionicons name="sparkles" size={18} color={colors.accent.base} />
          <Text style={styles.sommelierButtonText}>Ask the sommelier</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent.strong} />
        </TouchableOpacity>
      </View>

      {/* Your verdict — stars + notes, right after the identity fields so a
          quick log is info → stars → save with zero scrolling (#216). The
          old "verdict last" ordering (#170 item 10) lost to logging speed:
          the deep-dive sections below are optional and collapsed. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your verdict</Text>
        <StarRatingInput value={overallRating} onChange={setOverallRating} />
        <Text style={[styles.label, styles.notesLabel]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          placeholder="Any additional thoughts about this wine..."
          placeholderTextColor="#999"
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Optional deep-dive sections — collapsed by default (#216) */}
      <Text style={styles.moreDetailLabel}>More detail — optional</Text>

      <CollapsibleSection
        icon="options-outline"
        title="Detailed ratings"
        summary={ratingsSummary}
        hasData={ratingsSummaryParts.length > 0}
      >
        {Object.entries(ratings).map(([key, value]) => (
          <SegmentedRating
            key={key}
            value={value}
            onValueChange={(newValue) => updateRating(key, newValue)}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
          />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        icon="pricetags-outline"
        title="Flavor notes"
        summary={flavorSummary}
        hasData={flavorNotes.length > 0}
      >
        <FlavorTagSelector
          selectedTags={flavorNotes}
          onTagsChange={setFlavorNotes}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon="camera-outline"
        title="Photos"
        summary={photosSummary}
        hasData={photos.length > 0}
      >
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={20} color={colors.neutral.bg} />
            <Text style={styles.photoButtonText}>Take photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="images" size={20} color={colors.neutral.bg} />
            <Text style={styles.photoButtonText}>Choose photos</Text>
          </TouchableOpacity>
        </View>

        {renderPhotoGallery()}
      </CollapsibleSection>

      {/* Wine Type Modal */}
      <Modal
        visible={showTypeModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select wine type</Text>
              <TouchableOpacity
                onPress={() => setShowTypeModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {WINE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    wineType === type && styles.selectedTypeOption
                  ]}
                  onPress={() => handleWineTypeSelect(type)}
                >
                  <Text style={[
                    styles.typeOptionText,
                    wineType === type && styles.selectedTypeOptionText
                  ]}>
                    {type}
                  </Text>
                  {wineType === type && (
                    <Ionicons name="checkmark" size={20} color={colors.primary.deep} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wine Chat Modal */}
      <WineChatModal
        visible={showChatModal}
        onClose={() => setShowChatModal(false)}
        onDismiss={handleChatDismissed}
        onUseSuggestions={handleUseSuggestions}
        existingConversationId={chatConversationId}
        onConversationStarted={setChatConversationId}
        currentWineData={{
          winemaker: winemaker,
          name: wineName,
          type: wineType,
          varietal: wineVarietals.join(', '),
          year: wineYear,
          overallRating,
          ratings,
          flavorNotes,
          additionalNotes,
          photoCount: photos.length,
        }}
      />

      {/* AI Suggestions Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelPendingSuggestions}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.modalHeader}>
              <View style={styles.confirmHeaderLeft}>
                <Ionicons name="sparkles" size={18} color={colors.accent.base} />
                <Text style={styles.modalTitle}>Review suggestions</Text>
              </View>
              <TouchableOpacity
                onPress={cancelPendingSuggestions}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.confirmSubtitle}>
              Choose which suggestions to apply. Fields you&apos;ve already filled in are left
              unchecked so your input isn&apos;t overwritten.
            </Text>

            <ScrollView style={styles.confirmList}>
              {pendingFields.map((field) => (
                <TouchableOpacity
                  key={field.key}
                  style={styles.confirmRow}
                  activeOpacity={0.7}
                  onPress={() => togglePendingField(field.key)}
                >
                  <Ionicons
                    name={field.apply ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={field.apply ? colors.primary.base : colors.neutral.placeholder}
                    style={styles.confirmCheckbox}
                  />
                  <View style={styles.confirmRowBody}>
                    <Text style={styles.confirmFieldLabel}>{field.label}</Text>
                    <Text style={styles.confirmCurrent} numberOfLines={2}>
                      Current: {field.current || '(empty)'}
                    </Text>
                    <Text style={styles.confirmSuggested} numberOfLines={3}>
                      Suggested: {field.suggestedDisplay}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.confirmActions}>
              <Button variant="secondary" title="Cancel" onPress={cancelPendingSuggestions} style={{ flex: 1 }} />
              <Button variant="primary" title="Apply selected" onPress={applyPendingSuggestions} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

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
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {photos.length > 0 && (
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
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoModalContainer}>
                  <Image source={{ uri: photo }} style={styles.photoModalImage} />
                </View>
              ))}
            </ScrollView>
          )}
          
          <View style={styles.photoModalIndicator}>
            <Text style={styles.photoModalText}>
              {selectedPhotoIndex + 1} of {photos.length}
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Sticky save bar (#216) — Save/Cancel always reachable, so a quick log
        never scrolls past the optional sections just to find the button. */}
    <View style={styles.saveBar}>
      <Button variant="secondary" title="Cancel" onPress={onCancel} style={{ flex: 1 }} />
      <Button variant="primary" title="Save wine" onPress={handleSave} style={{ flex: 2 }} />
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
    padding: spacing.lg,
  },
  // Extra bottom room so the keyboard-driven scroll can lift the last field
  // (Additional notes) clear of the keyboard (#129).
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    backgroundColor: colors.neutral.surface,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  notesLabel: {
    marginTop: spacing.md,
  },
  // Kicker above the collapsed deep-dive sections (#216)
  moreDetailLabel: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
  },
  selectorText: {
    ...typography.body.regular,
    color: colors.neutral.ink,
  },
  selectorPlaceholder: {
    color: colors.neutral.placeholder,
  },

  // Multi-varietal chips + add row (#135)
  varietalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  varietalHint: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.xs,
  },
  varietalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  varietalChipText: {
    ...typography.body.small,
    color: colors.primary.base,
    fontWeight: '600',
  },
  varietalAddRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  varietalAddInput: {
    flex: 1,
  },
  varietalAddButton: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  varietalAddButtonDisabled: {
    opacity: 0.4,
  },

  // Sommelier button
  sommelierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  sommelierButtonText: {
    ...typography.body.regular,
    color: colors.accent.ink,
    fontWeight: '600',
    fontFamily: SERIF,
    flex: 1,
  },

  // Photo Buttons
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.base,
  },
  photoButtonText: {
    ...typography.body.regular,
    color: colors.neutral.bg,
    fontWeight: '500',
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
  },
  noPhotosText: {
    ...typography.body.small,
    marginTop: spacing.sm,
    color: colors.neutral.inkTertiary,
  },
  photoGallery: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  photoContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.bg,
    borderRadius: 12,
  },

  // Sticky save bar (#216)
  saveBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
    backgroundColor: colors.neutral.bg,
  },

  // Wine Type Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  modalTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  selectedTypeOption: {
    backgroundColor: colors.neutral.surface,
  },
  typeOptionText: {
    ...typography.body.regular,
    color: colors.neutral.ink,
  },
  selectedTypeOptionText: {
    fontWeight: '600',
    color: colors.primary.base,
  },

  // AI Suggestions Confirmation Modal
  confirmContent: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    paddingBottom: spacing.lg,
  },
  confirmHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmSubtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
  confirmList: {
    paddingHorizontal: spacing.lg,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  confirmCheckbox: {
    marginTop: 2,
    marginRight: spacing.md,
  },
  confirmRowBody: {
    flex: 1,
  },
  confirmFieldLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.xs,
  },
  confirmCurrent: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },
  confirmSuggested: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginTop: 2,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
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
    color: colors.neutral.bg,
  },
});
