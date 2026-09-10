// components/ManualWineryEntryModal.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';


const ManualWineryEntryModal = ({
  visible,
  onClose,
  onSave,
  actionType // 'visit' or 'wishlist'
}) => {
  const { colors, styles } = useScreenTheme();

  const [name, setName] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a winery name');
      return;
    }

    setLoading(true);

    let location = null;
    if (useCurrentLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch (error) {
        console.error('Location error:', error);
      }

      // The user asked for their real location but we couldn't get a fix
      // (permission denied or GPS failure) — never silently substitute the
      // default coordinates. Let them retry or explicitly opt into the default.
      if (!location) {
        setLoading(false);
        Alert.alert(
          "Couldn't get your location",
          'We could not get a GPS fix. You can try again, or save without a precise location.',
          [
            { text: 'Retry', onPress: handleSave },
            { text: 'Save without precise location', onPress: () => saveWinery(null) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    }

    await saveWinery(location);
  };

  const saveWinery = async (location) => {
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        latitude: location?.latitude ?? 37.4316,
        longitude: location?.longitude ?? -78.6569,
      }, actionType);

      setName('');
      setUseCurrentLocation(true);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setUseCurrentLocation(true);
    onClose();
  };

  const getTitle = () => {
    return actionType === 'visit' ? 'Log a visit' : 'Add to wishlist';
  };

  // Subtitle must match the action — previously hard-coded to the wishlist
  // copy for both modes (#106).
  const getSubtitle = () => {
    return actionType === 'visit'
      ? 'Record a winery you visited'
      : "Save a winery you'd like to visit";
  };

  const getIcon = () => {
    return actionType === 'visit' ? 'wine' : 'bookmark';
  };

  const getIconColor = () => {
    return actionType === 'visit' ? colors.primary.base : colors.status.wishlist;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* Full-screen dimming scrim, independent of the keyboard so it always
          covers the whole screen (previously a partial dark box — #106). The
          scrim itself closes the modal on tap. */}
      <View style={styles.root}>
        <TouchableOpacity
          style={styles.scrim}
          activeOpacity={1}
          onPress={handleClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centerWrap}
          pointerEvents="box-none"
        >
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
                  <Ionicons name={getIcon()} size={24} color={colors.onPrimary} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{getTitle()}</Text>
                  <Text style={styles.subtitle}>{getSubtitle()}</Text>
                </View>
              </View>

              {/* Decorative Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerDiamond} />
                <View style={styles.dividerLine} />
              </View>

              {/* Input Section */}
              <View style={styles.inputSection}>
                <Text style={styles.label}>WINERY NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Château Margaux"
                  placeholderTextColor={colors.neutral.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoFocus={true}
                  returnKeyType="done"
                  selectionColor={colors.primary.ink}
                />
              </View>

              {/* Location Toggle */}
              <View style={styles.locationSection}>
                <View style={styles.locationRow}>
                  <View style={styles.locationInfo}>
                    <View style={styles.locationIconContainer}>
                      <Ionicons name="location" size={18} color={colors.primary.ink} />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Use current location</Text>
                      <Text style={styles.locationSubtext}>
                        {useCurrentLocation ? 'GPS coordinates will be saved' : 'Will use a default location'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={useCurrentLocation}
                    onValueChange={setUseCurrentLocation}
                    trackColor={{ false: colors.neutral.border, true: colors.primary.soft }}
                    thumbColor={useCurrentLocation ? colors.primary.ink : colors.neutral.surface}
                    ios_backgroundColor={colors.neutral.border}
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttons}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={handleClose}
                  style={{ flex: 0.4 }}
                />
                <Button
                  variant="primary"
                  title={actionType === 'visit' ? 'Continue to visit' : 'Add to wishlist'}
                  icon="arrow-forward"
                  loading={loading}
                  onPress={handleSave}
                  style={{ flex: 0.6, backgroundColor: getIconColor() }}
                />
              </View>
            </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};


export default ManualWineryEntryModal;


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Full-bleed dimming scrim (also the tap-to-close target).
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim,
  },
  // Centers the card and lifts it above the keyboard; box-none lets taps in the
  // empty area fall through to the scrim.
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: 340,
    maxWidth: '90%',
    ...shadows.strong,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accent.border,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.accent.base,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },

  // Input Section
  inputSection: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },

  // Location Section
  locationSection: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Constrain the label/subtext so they wrap instead of overlapping the Switch.
  locationTextWrap: {
    flex: 1,
  },
  locationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  locationLabel: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '500',
  },
  locationSubtext: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
return { colors, styles };
});
