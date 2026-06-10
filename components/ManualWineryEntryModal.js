// components/ManualWineryEntryModal.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const ManualWineryEntryModal = ({
  visible,
  onClose,
  onSave,
  actionType // 'visit' or 'wishlist'
}) => {
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
    }

    try {
      await onSave({
        name: name.trim(),
        latitude: location?.latitude || 37.4316,
        longitude: location?.longitude || -78.6569,
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
    return actionType === 'visit' ? 'Log a Visit' : 'Add to Wishlist';
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
    return actionType === 'visit' ? colors.primary.burgundy : colors.status.wishlist;
  };

  const getButtonText = () => {
    if (loading) return 'Saving...';
    return actionType === 'visit' ? 'Continue to Visit' : 'Add to Wishlist';
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
                  <Ionicons name={getIcon()} size={24} color={colors.neutral.cream} />
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
                  placeholderTextColor={colors.neutral.silver}
                  value={name}
                  onChangeText={setName}
                  autoFocus={true}
                  returnKeyType="done"
                  selectionColor={colors.primary.burgundy}
                />
              </View>

              {/* Location Toggle */}
              <View style={styles.locationSection}>
                <View style={styles.locationRow}>
                  <View style={styles.locationInfo}>
                    <View style={styles.locationIconContainer}>
                      <Ionicons name="location" size={18} color={colors.primary.burgundy} />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Use Current Location</Text>
                      <Text style={styles.locationSubtext}>
                        {useCurrentLocation ? 'GPS coordinates will be saved' : 'Will use a default location'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={useCurrentLocation}
                    onValueChange={setUseCurrentLocation}
                    trackColor={{ false: colors.neutral.stone, true: colors.primary.rosé }}
                    thumbColor={useCurrentLocation ? colors.primary.burgundy : colors.neutral.parchment}
                    ios_backgroundColor={colors.neutral.stone}
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: getIconColor() },
                    loading && styles.disabled
                  ]}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.neutral.cream} />
                  ) : (
                    <>
                      <Text style={styles.saveText}>{getButtonText()}</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.neutral.cream} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Full-bleed dimming scrim (also the tap-to-close target).
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
  },
  // Centers the card and lifts it above the keyboard; box-none lets taps in the
  // empty area fall through to the scrim.
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.neutral.cream,
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
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: 2,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
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
    backgroundColor: colors.gold.muted,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold.rich,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },

  // Input Section
  inputSection: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },

  // Location Section
  locationSection: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
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
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  locationLabel: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
  },
  locationSubtext: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 0.4,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
  },
  cancelText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontWeight: '500',
  },
  saveButton: {
    flex: 0.6,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ManualWineryEntryModal;
