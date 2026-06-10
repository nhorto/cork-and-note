// components/LabelScanner.js — label-scan-to-add card (Epic #6 · R9 · #59).
//
// Sits ATOP the cellar add screen, above the (always-present) add form. The
// user snaps or picks a wine-label photo; the AI reads it and we hand the
// extracted fields back via onScanned(fields) so the screen can prefill the
// form — the user then confirms / tap-corrects any miss on the editable fields
// and saves in ~2 taps. The form below is always available, so this card is a
// pure accelerator: if a scan fails (or the user prefers), they just type.
//
// Mirrors the conventions of components/BottlePairing.js (CTA → loading →
// result/fail-soft, Château theme tokens) and the expo-image-picker usage
// already shipped in components/ChatInput.js (camera + library, Alert on
// denied permission). No new native dependency; vision rides the existing
// chat path via lib/cellarScan.js.
//
// SECURITY: the chosen image and the AI response are UNTRUSTED data; this
// component only displays a thumbnail + the model's friendly note and forwards
// the whitelisted, normalized fields. It never executes anything from them.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { scanWineLabel } from '../lib/cellarScan';
import { aiService } from '../lib/ai';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function LabelScanner({ onScanned }) {
  // The picked label image uri (for the thumbnail preview), the in-flight
  // reading state, and a soft error. No image == the initial CTA state.
  const [imageUri, setImageUri] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);

  // Reset back to the initial CTA state ("enter manually" / retry from scratch).
  const reset = useCallback(() => {
    setImageUri(null);
    setReading(false);
    setError(null);
  }, []);

  // Read the picked asset: thumbnail → base64 → scan → onScanned(fields).
  // Fails soft: any problem becomes an inline error with Retry; the form below
  // is always there as the manual fallback.
  const readLabel = useCallback(
    async (uri) => {
      setImageUri(uri);
      setError(null);
      setReading(true);
      try {
        const image = await aiService.photoToBase64(uri);
        if (!image?.base64) {
          setError("Couldn't read that photo. Try another, or enter it manually.");
          return;
        }
        const res = await scanWineLabel(image);
        if (res.success) {
          // Hand the whitelisted fields up; the screen prefills + remounts the form.
          onScanned?.(res.fields);
          // Collapse the card back to its CTA so the prefilled form is the focus.
          reset();
        } else {
          setError(res.error || "Couldn't read this label. Try a sharper photo, or enter it manually.");
        }
      } catch (err) {
        setError(err?.message || 'Something went wrong reading the label. Please try again.');
      } finally {
        setReading(false);
      }
    },
    [onScanned, reset]
  );

  // Camera — mirrors components/ChatInput.js (permission → launch → asset uri).
  const scanWithCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is needed to scan a label.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        readLabel(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera. You can choose from your library or enter it manually.');
    }
  }, [readLabel]);

  // Library — mirrors components/ChatInput.js.
  const scanFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is needed to choose a label.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        readLabel(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Library unavailable', 'Could not open your photo library. You can use the camera or enter it manually.');
    }
  }, [readLabel]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="scan" size={18} color={colors.gold.rich} />
        <Text style={styles.eyebrow}>SCAN A LABEL</Text>
      </View>

      <Text style={styles.title}>Snap the label, we&apos;ll fill it in</Text>
      <Text style={styles.subtitle}>
        Point your camera at a wine label and we&apos;ll prefill the form below — just check it over and save.
      </Text>

      {/* Reading: show the chosen image + a gentle loading line. */}
      {reading ? (
        <View style={styles.reading}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
          <View style={styles.readingMeta}>
            <ActivityIndicator color={colors.primary.burgundy} size="small" />
            <Text style={styles.readingText}>Reading the label…</Text>
          </View>
        </View>
      ) : error ? (
        // Fail soft: show the thumbnail, a gentle error, a Retry, and an
        // explicit "enter manually" reset. The form below is always usable.
        <View style={styles.errorBlock}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.secondaryBtnFlex]}
              onPress={scanWithCamera}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary.burgundy} />
              <Text style={styles.secondaryBtnText}>Retry scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.secondaryBtnFlex]}
              onPress={reset}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Enter manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Initial CTA: primary "Scan a label" (camera) + "Choose from library".
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={scanWithCamera}
            activeOpacity={0.9}
          >
            <Ionicons name="camera" size={18} color={colors.neutral.cream} />
            <Text style={styles.primaryBtnText}>Scan a label</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={scanFromLibrary}
            activeOpacity={0.85}
          >
            <Ionicons name="image-outline" size={16} color={colors.primary.burgundy} />
            <Text style={styles.secondaryBtnText}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.disclaimer}>
        We&apos;ll fill in what we can read — you can fix anything before saving.
      </Text>
    </View>
  );
}

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
  },

  title: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: SERIF,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
  },

  // CTA row
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  primaryBtnText: {
    ...typography.heading.h3,
    color: colors.neutral.cream,
    fontFamily: SERIF,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.gold.light,
  },
  secondaryBtnFlex: { flex: 1 },
  secondaryBtnText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '600',
  },

  // Reading state
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  readingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  readingText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },

  // Error (fail soft)
  errorBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body.small,
    color: colors.status.error,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  disclaimer: {
    ...typography.body.small,
    color: colors.neutral.silver,
    fontStyle: 'italic',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
