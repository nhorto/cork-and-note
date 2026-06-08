// components/WineryNameModal.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const WineryNameModal = ({
  visible,
  onClose,
  onSave,
  coordinate
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a winery name');
      return;
    }

    setLoading(true);
    try {
      await onSave(name.trim(), coordinate);
      setName('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save pin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="location" size={22} color={colors.primary.burgundy} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Drop a Pin</Text>
                  <Text style={styles.subtitle}>Name this location</Text>
                </View>
              </View>

              {/* Decorative Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerDiamond} />
                <View style={styles.dividerLine} />
              </View>

              {/* Input */}
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
                  onSubmitEditing={handleSave}
                  selectionColor={colors.primary.burgundy}
                />
              </View>

              {/* Coordinates */}
              {coordinate && (
                <View style={styles.coordinatesContainer}>
                  <Ionicons name="navigate-outline" size={14} color={colors.neutral.pewter} />
                  <Text style={styles.coordinates}>
                    {coordinate.latitude.toFixed(4)}°, {coordinate.longitude.toFixed(4)}°
                  </Text>
                </View>
              )}

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
                  style={[styles.saveButton, loading && styles.disabled]}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveText}>
                    {loading ? 'Saving...' : 'Save Pin'}
                  </Text>
                  {!loading && (
                    <Ionicons name="checkmark" size={18} color={colors.neutral.cream} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: 320,
    maxWidth: '90%',
    ...shadows.strong,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
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
    marginBottom: spacing.md,
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

  // Coordinates
  coordinatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  coordinates: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
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
  cancelText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    flexDirection: 'row',
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

export default WineryNameModal;
