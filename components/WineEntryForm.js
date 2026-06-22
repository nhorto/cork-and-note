// Updated WineEntryForm.js with multiple photos support
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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

import AutocompleteVarietal from './AutocompleteVarietal';
import FlavorTagSelector from './FlavorTagSelector';
import RatingSlider from './RatingSlider';
import WineChatModal from './WineChatModal';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const WINE_TYPES = [
  'Red', 'White', 'Rosé', 'Sparkling', 'Dessert',
  'Red Blend', 'White Blend', 'Orange'
];

export default function WineEntryForm({ onSave, onCancel, initialData, defaultWinemaker = '' }) {
  // Form state
  const [winemaker, setWinemaker] = useState(defaultWinemaker);
  const [wineName, setWineName] = useState('');
  const [wineType, setWineType] = useState(''); // optional — no longer defaults to "Red"
  const [wineVarietal, setWineVarietal] = useState('');
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

  // Scroll handle so focusing the bottom-most field ("Additional notes") can pull
  // it above the keyboard — the form is a plain ScrollView that otherwise leaves
  // the field hidden behind the keyboard (#129).
  const scrollRef = useRef(null);

  // AI suggestion confirmation state
  const [pendingFields, setPendingFields] = useState([]); // [{ key, label, current, suggested, apply, set }]
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // iOS can't present the confirm modal while the chat modal is still up, so we
  // close the chat first and open confirm from its onDismiss. This flag marks
  // that a confirm is pending for that dismissal (vs. a plain chat close) (#120).
  const pendingConfirmRef = useRef(false);

  // Load initial data if editing an existing wine
  useEffect(() => {
    if (initialData) {
      setWinemaker(initialData.winemaker || defaultWinemaker || '');
      setWineName(initialData.name || '');
      setWineType(initialData.type || '');
      setWineVarietal(initialData.varietal || '');
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
    setWineType(type);
    setShowTypeModal(false);
  };
  
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
    addTextField('wine_name', 'Wine Name', suggestions.wine_name, wineName, setWineName);
    addTextField('wine_type', 'Type', suggestions.wine_type, wineType, setWineType);
    addTextField('varietal', 'Varietal', suggestions.varietal, wineVarietal, setWineVarietal);
    addTextField('year', 'Year', suggestions.year, wineYear, setWineYear);

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
          label: 'Flavor Notes',
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
        label: 'Overall Rating',
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
          label: 'Additional Notes',
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
    // Required = winemaker only. Everything else (incl. varietal) is optional —
    // blends and unknowns shouldn't block a save (#133). Display falls back to
    // name → varietal → type via lib/wineDisplay.js.
    if (!winemaker.trim()) {
      Alert.alert('Missing Information', 'Please enter the winemaker (a winery or producer).');
      return;
    }

    // Create wine data object
    const wineData = {
      // Preserve the id when editing an existing wine so the edit flow can
      // diff/update it rather than treating it as a brand-new wine.
      id: initialData?.id,
      winemaker: winemaker.trim(),
      name: wineName,
      type: wineType || null,
      varietal: wineVarietal,
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
              >
                <Ionicons name="close-circle" size={24} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Wine Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wine Information</Text>

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
          <Text style={styles.label}>Varietal</Text>
          <AutocompleteVarietal
            value={wineVarietal}
            onChangeText={setWineVarietal}
            wineType={wineType}
            placeholder="Grape — e.g. Cabernet, Viognier (optional)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wine Name</Text>
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

        {/* Ask the Sommelier button */}
        <TouchableOpacity
          style={styles.sommelierButton}
          onPress={() => setShowChatModal(true)}
        >
          <Ionicons name="sparkles" size={18} color={colors.gold.rich} />
          <Text style={styles.sommelierButtonText}>Ask the Sommelier</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.gold.shimmer} />
        </TouchableOpacity>
      </View>

      {/* Overall Rating */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Rating</Text>
        <RatingSlider
          value={overallRating}
          onValueChange={setOverallRating}
          label="Overall Rating"
          showLabel={false}
        />
      </View>

      {/* Detailed Ratings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed Ratings</Text>
        
        {Object.entries(ratings).map(([key, value]) => (
          <RatingSlider
            key={key}
            value={value}
            onValueChange={(newValue) => updateRating(key, newValue)}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
          />
        ))}
      </View>

      {/* Flavor Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flavor Notes</Text>
        <FlavorTagSelector
          selectedTags={flavorNotes}
          onTagsChange={setFlavorNotes}
        />
      </View>

      {/* Photos Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
        
        {/* Photo buttons */}
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={20} color="#E7E3E2" />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="images" size={20} color="#E7E3E2" />
            <Text style={styles.photoButtonText}>Choose Photos</Text>
          </TouchableOpacity>
        </View>

        {/* Photo gallery */}
        {renderPhotoGallery()}
      </View>

      {/* Additional Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          placeholder="Any additional thoughts about this wine..."
          placeholderTextColor="#999"
          multiline
          textAlignVertical="top"
          // This field sits at the bottom of the form; scroll it into view once
          // the keyboard has animated in so it isn't hidden behind it (#129).
          onFocus={() => {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
          }}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Wine</Text>
        </TouchableOpacity>
      </View>

      {/* Wine Type Modal */}
      <Modal
        visible={showTypeModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Wine Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
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
                    <Ionicons name="checkmark" size={20} color="#8C1C13" />
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
          varietal: wineVarietal,
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
                <Ionicons name="sparkles" size={18} color={colors.gold.rich} />
                <Text style={styles.modalTitle}>Review Suggestions</Text>
              </View>
              <TouchableOpacity onPress={cancelPendingSuggestions}>
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
                    color={field.apply ? colors.primary.burgundy : colors.neutral.silver}
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
              <TouchableOpacity style={styles.cancelButton} onPress={cancelPendingSuggestions}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={applyPendingSuggestions}>
                <Text style={styles.saveButtonText}>Apply selected</Text>
              </TouchableOpacity>
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
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {photos.length > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedPhotoIndex * 400, y: 0 }}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
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
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    backgroundColor: colors.neutral.parchment,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
  },
  selectorText: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  selectorPlaceholder: {
    color: colors.neutral.silver,
  },

  // Sommelier button
  sommelierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  sommelierButtonText: {
    ...typography.body.regular,
    color: colors.gold.shimmer,
    fontWeight: '600',
    fontFamily: 'Georgia',
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
    backgroundColor: colors.primary.burgundy,
  },
  photoButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '500',
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderStyle: 'dashed',
  },
  noPhotosText: {
    ...typography.body.small,
    marginTop: spacing.sm,
    color: colors.neutral.silver,
  },
  photoGallery: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
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
    borderColor: colors.neutral.stone,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.cream,
    borderRadius: 12,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
  },
  cancelButtonText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Wine Type Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.cream,
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
    borderBottomColor: colors.neutral.linen,
  },
  modalTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  selectedTypeOption: {
    backgroundColor: colors.neutral.parchment,
  },
  typeOptionText: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  selectedTypeOptionText: {
    fontWeight: '600',
    color: colors.primary.burgundy,
  },

  // AI Suggestions Confirmation Modal
  confirmContent: {
    backgroundColor: colors.neutral.cream,
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
    color: colors.neutral.pewter,
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
    borderBottomColor: colors.neutral.linen,
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
    color: colors.gold.shimmer,
    marginBottom: spacing.xs,
  },
  confirmCurrent: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  confirmSuggested: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
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