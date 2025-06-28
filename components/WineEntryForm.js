// Updated WineEntryForm.js with multiple photos support
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import AutocompleteVarietal from './AutocompleteVarietal';
import FlavorTagSelector from './FlavorTagSelector';
import RatingSlider from './RatingSlider';

const WINE_TYPES = [
  'Red', 'White', 'Rosé', 'Sparkling', 'Dessert',
  'Red Blend', 'White Blend', 'Orange'
];

export default function WineEntryForm({ onSave, onCancel, initialData }) {
  // Form state
  const [wineName, setWineName] = useState('');
  const [wineType, setWineType] = useState('Red');
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
  
  // Load initial data if editing an existing wine
  useEffect(() => {
    if (initialData) {
      setWineName(initialData.name || '');
      setWineType(initialData.type || 'Red');
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
  
  // Handle form submission
  const handleSave = () => {
    // Wine type is required
    if (!wineType) {
      Alert.alert('Missing Information', 'Please select a wine type.');
      return;
    }
    
    // Create wine data object
    const wineData = {
      name: wineName,
      type: wineType,
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Wine Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wine Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wine Name</Text>
          <TextInput
            style={styles.input}
            value={wineName}
            onChangeText={setWineName}
            placeholder="Enter wine name"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type *</Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.selectorText}>{wineType}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Varietal</Text>
          <AutocompleteVarietal
            value={wineVarietal}
            onChangeText={setWineVarietal}
            wineType={wineType}
          />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#3E3E3E',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f4f1ef',
    color: '#3E3E3E',
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
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f4f1ef',
  },
  selectorText: {
    fontSize: 15,
    color: '#3E3E3E',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8C1C13',
  },
  photoButtonText: {
    color: '#E7E3E2',
    fontWeight: '500',
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f4f1ef',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  noPhotosText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
  },
  photoGallery: {
    backgroundColor: '#f4f1ef',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8C1C13',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8C1C13',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#8C1C13',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#E7E3E2',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#E7E3E2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedTypeOption: {
    backgroundColor: '#f0f0f0',
  },
  typeOptionText: {
    fontSize: 16,
    color: '#3E3E3E',
  },
  selectedTypeOptionText: {
    fontWeight: '600',
    color: '#8C1C13',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoModalText: {
    color: '#fff',
    fontSize: 14,
  },
});