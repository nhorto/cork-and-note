// Updated WineEntryForm.js with autocomplete varietal
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

import AutocompleteVarietal from './AutocompleteVarietal'; // Import the new component
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
  const [wineVarietal, setWineVarietal] = useState(''); // Now handles free text input
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
  const [photo, setPhoto] = useState(null);
  
  // Modal state for wine type selector only (varietal now uses autocomplete)
  const [showTypeModal, setShowTypeModal] = useState(false);
  
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
      setPhoto(initialData.photo || null);
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
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaType.Images,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo: ' + error.message);
    }
  };
  
  // Pick an image from the media library
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permission to upload photos.');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image: ' + error.message);
    }
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
    
    // Create wine object - varietal is now just the text input value
    const wineData = {
      name: wineName,
      type: wineType,
      varietal: wineVarietal.trim(), // Use the autocomplete input value directly
      year: wineYear,
      overallRating,
      ratings,
      flavorNotes,
      additionalNotes,
      photo,
      dateAdded: new Date().toISOString(),
    };
    
    // Pass wine data to parent component
    onSave(wineData);
  };
  
  // Render the wine type modal (keeping this unchanged)
  const renderTypeModal = () => (
    <Modal
      visible={showTypeModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Wine Type</Text>
            <TouchableOpacity onPress={() => setShowTypeModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.optionsList}>
            {WINE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionItem,
                  wineType === type && styles.selectedOption
                ]}
                onPress={() => handleWineTypeSelect(type)}
              >
                <Text style={[
                  styles.optionText,
                  wineType === type && styles.selectedOptionText
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
  );
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Wine Name</Text>
        <TextInput
          style={styles.input}
          value={wineName}
          onChangeText={setWineName}
          placeholder="Optional"
        />
      </View>
      
      <View style={styles.formRow}>
        <View style={styles.formGroupHalf}>
          <Text style={styles.label}>Wine Type *</Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.selectorText}>{wineType}</Text>
            <Ionicons name="chevron-down" size={20} color="#8C1C13" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.formGroupHalf}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={wineYear}
            onChangeText={setWineYear}
            placeholder="e.g., 2021"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </View>
      
      {/* Updated Varietal Section with Autocomplete */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Wine Varietal</Text>
        <AutocompleteVarietal
          value={wineVarietal}
          onChangeText={setWineVarietal}
          placeholder="Enter varietal (optional)"
        />
      </View>
      
      {/* Wine Characteristics */}
      <View style={styles.formGroup}>
        <Text style={styles.sectionTitle}>Wine Characteristics</Text>
        
        <RatingSlider
          label="Sweetness"
          value={ratings.sweetness}
          onValueChange={(value) => updateRating('sweetness', value)}
        />
        
        <RatingSlider
          label="Tannins"
          value={ratings.tannins}
          onValueChange={(value) => updateRating('tannins', value)}
        />
        
        <RatingSlider
          label="Acidity"
          value={ratings.acidity}
          onValueChange={(value) => updateRating('acidity', value)}
        />
        
        <RatingSlider
          label="Body"
          value={ratings.body}
          onValueChange={(value) => updateRating('body', value)}
        />
        
        <RatingSlider
          label="Alcohol"
          value={ratings.alcohol}
          onValueChange={(value) => updateRating('alcohol', value)}
        />
      </View>

      {/* Flavor Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.sectionTitle}>Flavor Notes</Text>
        <FlavorTagSelector
          selectedTags={flavorNotes}
          onTagsChange={setFlavorNotes}
        />
      </View>
      
      {/* Additional Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Additional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          placeholder="Optional notes about this wine..."
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      
      {/* Overall Rating */}
      <View style={styles.formGroup}>
        <Text style={styles.sectionTitle}>Overall Rating</Text>
        <RatingSlider
          label=""
          value={overallRating}
          onValueChange={setOverallRating}
        />
      </View>
      
      {/* Photo Section */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Photo</Text>
        {photo ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => setPhoto(null)}
            >
              <Ionicons name="close-circle" size={24} color="#FF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#E7E3E2" />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="image" size={24} color="#E7E3E2" />
              <Text style={styles.photoButtonText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Wine</Text>
        </TouchableOpacity>
      </View>
      
      {/* Wine Type Modal */}
      {renderTypeModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 50,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  formGroupHalf: {
    width: '48%',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#8C1C13',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
    color: '#3E3E3E',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    minHeight: 50,
  },
  selectorText: {
    fontSize: 15,
    color: '#3E3E3E',
  },
  placeholderText: {
    color: '#999',
  },
  photoContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 15,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8C1C13', // solid red background
  },
  photoButtonText: {
    color: '#E7E3E2', // soft beige text color
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  cancelButton: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#8C1C13',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles (restored to original)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#E7E3E2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedOption: {
    backgroundColor: 'rgba(140, 28, 19, 0.1)',
  },
  optionText: {
    fontSize: 16,
    color: '#3E3E3E',
  },
  selectedOptionText: {
    color: '#8C1C13',
    fontWeight: '500',
  },
});