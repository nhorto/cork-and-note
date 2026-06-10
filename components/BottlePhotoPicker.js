// components/BottlePhotoPicker.js — bottle / label photo control for the cellar (#58)
//
// A single-photo control for a cellar bottle: tap to add (Camera or Choose from
// library), shows an uploading spinner while the JPEG is pushed to Storage, then
// renders a thumbnail with Replace / Remove affordances. One photo per bottle
// (MVP). Reuses the shipped expo-image-picker + the existing visitsService
// uploader — no new native dependency.
//
// Storage: photos live in the existing PUBLIC `wine-photos` bucket under a
// `cellar/` prefix (consistent with the app's other wine/visit photos).
//
// Fail-soft by contract: a denied permission or a failed upload surfaces an
// Alert and leaves the current value untouched — it never blocks the save.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { visitsService } from '../lib/visits';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const BUCKET = 'wine-photos';
const PREFIX = 'cellar/';

export default function BottlePhotoPicker({ value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);

  // Upload one local URI and hand the public URL back to the form. The replaced
  // photo's file is intentionally left in Storage (delete-on-replace is a
  // deferred nicety — see issue #58 follow-ups); only the reference changes.
  const upload = async (uri) => {
    setUploading(true);
    try {
      const urls = await visitsService.uploadPhotos([uri], BUCKET, PREFIX);
      const url = urls?.[0];
      if (!url) throw new Error('Upload failed');
      onChange(url);
    } catch {
      Alert.alert('Upload failed', 'That photo could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Camera — mirrors components/ChatInput.js / LabelScanner.js.
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        await upload(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera. You can choose from your library instead.');
    }
  };

  // Library — mirrors components/ChatInput.js / LabelScanner.js.
  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is needed to choose a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        await upload(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Library unavailable', 'Could not open your photo library. You can use the camera instead.');
    }
  };

  const choose = () => {
    if (disabled || uploading) return;
    Alert.alert('Add a photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const remove = () => onChange(null);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bottle photo</Text>

      {value ? (
        // Has a photo: thumbnail + Replace / Remove.
        <View style={styles.row}>
          <View style={styles.thumbWrap}>
            <Image source={{ uri: value }} style={styles.thumb} />
            {uploading && (
              <View style={styles.thumbOverlay}>
                <ActivityIndicator size="small" color={colors.neutral.cream} />
              </View>
            )}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={choose}
              disabled={disabled || uploading}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary.burgundy} />
              <Text style={styles.actionText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={remove}
              disabled={disabled || uploading}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color={colors.status.error} />
              <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // No photo yet: a single dashed tap target.
        <TouchableOpacity
          style={styles.addTile}
          onPress={choose}
          disabled={disabled || uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary.burgundy} />
          ) : (
            <Ionicons name="camera-outline" size={22} color={colors.primary.burgundy} />
          )}
          <Text style={styles.addText}>{uploading ? 'Uploading…' : 'Add a photo'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.body.caption, color: colors.neutral.pewter, marginBottom: spacing.xs },

  // Empty-state dashed tap target.
  addTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
  },
  addText: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600' },

  // Filled-state thumbnail + actions.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  thumb: { width: '100%', height: '100%' },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.dark,
  },
  actions: { flex: 1, gap: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
  },
  actionText: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600' },
  removeText: { color: colors.status.error },
});
