// components/ManualWineryEntryModal.js
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
      Alert.alert('Error', 'Please enter a winery name');
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
        // Continue without location
      }
    }

    try {
      await onSave({
        name: name.trim(),
        latitude: location?.latitude || 44.8378, // Default to Bordeaux center
        longitude: location?.longitude || -0.5792,
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

  const getIcon = () => {
    return actionType === 'visit' ? 'wine' : 'bookmark';
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
              <View style={styles.header}>
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: actionType === 'visit' ? '#8C1C13' : '#2196F3' }
                ]}>
                  <Ionicons name={getIcon()} size={24} color="#fff" />
                </View>
                <Text style={styles.title}>{getTitle()}</Text>
              </View>

              <Text style={styles.label}>Winery Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter winery name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoFocus={true}
                returnKeyType="done"
              />

              <View style={styles.locationRow}>
                <View style={styles.locationLabelContainer}>
                  <Ionicons name="location" size={20} color="#666" />
                  <Text style={styles.locationLabel}>Use current location</Text>
                </View>
                <Switch
                  value={useCurrentLocation}
                  onValueChange={setUseCurrentLocation}
                  trackColor={{ false: '#ddd', true: '#8C1C13' }}
                  thumbColor="#fff"
                />
              </View>

              {!useCurrentLocation && (
                <Text style={styles.locationNote}>
                  Location will default to Bordeaux center
                </Text>
              )}

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, loading && styles.disabled]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  )}
                  <Text style={styles.saveText}>{getButtonText()}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 340,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  locationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 16,
    color: '#3E3E3E',
    marginLeft: 10,
  },
  locationNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 20,
    paddingLeft: 4,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cancelButton: {
    padding: 14,
    flex: 0.4,
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  cancelText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 16,
  },
  saveButton: {
    padding: 14,
    flex: 0.6,
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#8C1C13',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ManualWineryEntryModal;
