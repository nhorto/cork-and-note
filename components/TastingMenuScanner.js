// components/TastingMenuScanner.js — scan a tasting card to add many wines (#139).
//
// Sits ATOP the logging-session overview, above the wine list. The user snaps
// or picks a photo of a winery tasting card / flight menu (a list of several
// wines); the AI reads it and we hand the extracted wines back via
// onScanned(wines) so the session can append one draft entry per wine. The user
// then opens each wine to rate it and add notes as they drink it.
//
// This is the MULTI-wine sibling of components/LabelScanner.js (which scans ONE
// bottle label inside WineEntryForm). Same Château theme tokens, same
// CTA → loading → result/fail-soft shape, same expo-image-picker usage. Adding
// wines manually is always available below, so this card is a pure accelerator:
// if a scan fails (or the user prefers), they just tap "Add wine".
//
// SECURITY: the chosen image and the AI response are UNTRUSTED data; this
// component only displays a thumbnail + the model's friendly note and forwards
// the whitelisted, normalized per-wine fields (see lib/cellarScan.js
// normalizeMenu). It never executes anything from them.
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
import { scanTastingCard } from '../lib/cellarScan';
import { aiService } from '../lib/ai';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function TastingMenuScanner({ onScanned }) {
  // The picked card image uri (for the thumbnail), the in-flight reading state,
  // and a soft error. No image == the initial CTA state.
  const [imageUri, setImageUri] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);

  // Reset back to the initial CTA state (retry from scratch / fall back to manual).
  const reset = useCallback(() => {
    setImageUri(null);
    setReading(false);
    setError(null);
  }, []);

  // Read the picked asset: thumbnail → base64 → scan → onScanned(wines).
  // Fails soft: any problem becomes an inline error with Retry; the "Add wine"
  // button below is always there as the manual fallback.
  const readCard = useCallback(
    async (uri) => {
      setImageUri(uri);
      setError(null);
      setReading(true);
      try {
        const image = await aiService.photoToBase64(uri);
        if (!image?.base64) {
          setError("Couldn't read that photo. Try another, or add wines manually.");
          return;
        }
        const res = await scanTastingCard(image);
        if (res.success) {
          // Hand the whitelisted wines up; the session appends a draft per wine.
          onScanned?.(res.wines);
          // Collapse the card back to its CTA so the wine list is the focus.
          reset();
        } else {
          setError(res.error || "Couldn't read this card. Try a sharper photo, or add wines manually.");
        }
      } catch (err) {
        setError(err?.message || 'Something went wrong reading the card. Please try again.');
      } finally {
        setReading(false);
      }
    },
    [onScanned, reset]
  );

  // Camera — mirrors components/LabelScanner.js (permission → launch → asset uri).
  const scanWithCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is needed to scan a tasting card.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        readCard(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera. You can choose from your library or add wines manually.');
    }
  }, [readCard]);

  // Library — mirrors components/LabelScanner.js.
  const scanFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is needed to choose a card.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        readCard(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Library unavailable', 'Could not open your photo library. You can use the camera or add wines manually.');
    }
  }, [readCard]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="scan" size={18} color={colors.gold.rich} />
        <Text style={styles.eyebrow}>SCAN A TASTING CARD</Text>
      </View>

      <Text style={styles.title}>Snap the card, we&apos;ll add every wine</Text>
      <Text style={styles.subtitle}>
        Point your camera at a winery&apos;s tasting card and we&apos;ll add each wine to this session — then open each one to rate it.
      </Text>

      {/* Reading: show the chosen image + a gentle loading line. */}
      {reading ? (
        <View style={styles.reading}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
          <View style={styles.readingMeta}>
            <ActivityIndicator color={colors.primary.burgundy} size="small" />
            <Text style={styles.readingText}>Reading the card…</Text>
          </View>
        </View>
      ) : error ? (
        // Fail soft: show the thumbnail, a gentle error, a Retry, and an explicit
        // "add manually" reset. The "Add wine" button below is always usable.
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
              <Text style={styles.secondaryBtnText}>Add manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Initial CTA: primary "Scan a card" (camera) + "Choose from library".
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={scanWithCamera}
            activeOpacity={0.9}
          >
            <Ionicons name="camera" size={16} color={colors.neutral.cream} />
            <Text style={styles.primaryBtnText}>Scan a card</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, styles.secondaryBtnFlex]}
            onPress={scanFromLibrary}
            activeOpacity={0.85}
          >
            <Ionicons name="image-outline" size={16} color={colors.primary.burgundy} />
            <Text style={styles.secondaryBtnText}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.disclaimer}>
        We&apos;ll add what we can read — you can edit or remove any wine before saving.
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
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  primaryBtnText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '700',
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
