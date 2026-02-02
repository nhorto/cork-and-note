// components/WineryNameModal.js
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
      Alert.alert('Error', 'Please enter a winery name');
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
              <View style={styles.header}>
                <Ionicons name="location" size={24} color="#8C1C13" />
                <Text style={styles.title}>Name this winery</Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Enter winery name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {coordinate && (
                <Text style={styles.coordinates}>
                  Location: {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
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
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveText}>
                    {loading ? 'Saving...' : 'Save Pin'}
                  </Text>
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
    width: 320,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3E3E3E',
    marginLeft: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  coordinates: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    padding: 14,
    flex: 1,
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
    flex: 1,
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
    marginLeft: 6,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default WineryNameModal;
