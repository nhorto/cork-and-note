import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { Picker } from '@react-native-picker/picker';
import FlavorTagSelector from './FlavorTagSelector';
import RatingSlider from './RatingSlider'

const WINE_TYPES = [
  'Red', 'White', 'Rosé', 'Sparkling', 'Dessert',
  'Red Blend', 'White Blend', 'Orange'
];

// Common wine varietals
const WINE_VARIETALS = [
  '', // Empty option
  'Cabernet Sauvignon',
  'Merlot',
  'Pinot Noir',
  'Syrah/Shiraz',
  'Malbec',
  'Chardonnay',
  'Sauvignon Blanc',
  'Pinot Grigio',
  'Riesling',
  'Moscato',
  'Other'
];

export default function WineEntryForm({ onSave, onCancel, initialData }) {
  // Form state
  const [wineName, setWineName] = useState('');
  const [wineType, setWineType] = useState('Red');
  const [wineVarietal, setWineVarietal] = useState('');
  const [customVarietal, setCustomVarietal] = useState('');
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
  
  // Load initial data if editing an existing wine
  useEffect(() => {
    if (initialData) {
      setWineName(initialData.name || '');
      setWineType(initialData.type || 'Red');
      setWineVarietal(initialData.varietal || '');
      setCustomVarietal(initialData.customVarietal || '');
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
        mediaTypes: ImagePicker.MediaType.Images, // Updated to use MediaType
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
        mediaTypes: ImagePicker.MediaType.Images, // Updated to use MediaType
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
  
  // Handle form submission
  const handleSave = () => {
    // Wine type is required
    if (!wineType) {
      Alert.alert('Missing Information', 'Please select a wine type.');
      return;
    }
    
    // Determine final varietal
    const finalVarietal = wineVarietal === 'Other' ? customVarietal : wineVarietal;
    
    // Create wine object
    const wineData = {
      name: wineName, // Can be empty
      type: wineType,
      varietal: finalVarietal, // Can be empty
      customVarietal: wineVarietal === 'Other' ? customVarietal : '',
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
  
  return (
    <ScrollView style={styles.container}>
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
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={wineType}
              onValueChange={(itemValue) => setWineType(itemValue)}
              style={styles.picker}
            >
              {WINE_TYPES.map((type) => (
                <Picker.Item key={type} label={type} value={type} />
              ))}
            </Picker>
          </View>
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
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Wine Varietal</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={wineVarietal}
            onValueChange={(itemValue) => setWineVarietal(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select varietal (optional)" value="" />
            {WINE_VARIETALS.slice(1).map((varietal) => (
              <Picker.Item key={varietal} label={varietal} value={varietal} />
            ))}
          </Picker>
        </View>
        
        {wineVarietal === 'Other' && (
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={customVarietal}
            onChangeText={setCustomVarietal}
            placeholder="Enter custom varietal"
          />
        )}
      </View>
      
      {/* Overall Rating */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Overall Rating</Text>
        <RatingSlider
          label="Your Rating"
          value={overallRating}
          onValueChange={setOverallRating}
          showStars={true}
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
        <FlavorTagSelector
          selectedTags={flavorNotes}
          onTagsChange={setFlavorNotes}
        />
      </View>
      
      {/* Additional Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Tasting Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          placeholder="Enter any additional notes about this wine"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      
      {/* Photo Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Wine Photo</Text>
        <View style={styles.photoActions}>
          <TouchableOpacity 
            style={styles.photoButton} 
            onPress={takePhoto}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.photoButton} 
            onPress={pickImage}
          >
            <Ionicons name="image" size={20} color="#fff" />
            <Text style={styles.photoButtonText}>Choose Photo</Text>
          </TouchableOpacity>
        </View>
        
        {photo && (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photo }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => setPhoto(null)}
            >
              <Ionicons name="close-circle" size={26} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>Save Wine</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#E7E3E2', // Match login background
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
    color: '#3E3E3E', // Consistent text color
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#8C1C13', // Primary color from login
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: 'row',
    backgroundColor: '#8C1C13',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  photoPreviewContainer: {
    position: 'relative',
    marginTop: 10,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 15,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 30,
  },
  button: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#8C1C13', // Match primary button
  },
  cancelButton: {
    backgroundColor: '#FF3B30', // Keep red for cancel
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});