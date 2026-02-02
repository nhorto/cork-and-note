// components/PinActionModal.js
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PinActionModal = ({
  visible,
  winery,
  onClose,
  onLogVisit,
  onAddToWishlist,
  onRemovePin,
  onViewDetails
}) => {
  if (!winery) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.container}>
            <View style={styles.handle} />

            <Text style={styles.title}>{winery.name}</Text>
            {winery.address && (
              <Text style={styles.address}>{winery.address}</Text>
            )}

            <View style={styles.options}>
              <TouchableOpacity style={styles.option} onPress={onLogVisit}>
                <View style={[styles.iconContainer, { backgroundColor: '#8C1C13' }]}>
                  <Ionicons name="wine" size={22} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Log Visit</Text>
                  <Text style={styles.optionSubtext}>Record wines and notes</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={onAddToWishlist}>
                <View style={[styles.iconContainer, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="bookmark" size={22} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>Add to Wishlist</Text>
                  <Text style={styles.optionSubtext}>Save for later</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              {onViewDetails && (
                <TouchableOpacity style={styles.option} onPress={onViewDetails}>
                  <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
                    <Ionicons name="information-circle" size={22} color="#fff" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionText}>View Details</Text>
                    <Text style={styles.optionSubtext}>See past visits</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.option, styles.destructiveOption]}
                onPress={onRemovePin}
              >
                <View style={[styles.iconContainer, { backgroundColor: '#FF4444' }]}>
                  <Ionicons name="trash" size={22} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, styles.destructiveText]}>
                    Remove Pin
                  </Text>
                  <Text style={styles.optionSubtext}>Delete from map</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3E3E3E',
    textAlign: 'center',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  options: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
  },
  optionSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  destructiveOption: {
    marginTop: 6,
  },
  destructiveText: {
    color: '#FF4444',
  },
  cancelButton: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default PinActionModal;
