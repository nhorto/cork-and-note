/* 
This is going through the WineEntryForm to get reps at doing this and to comment everything.
i am going to start with the imports then skip to the UI elements and do the style sheet.
i think this will give me a good understanding of how to do this since i already know how 
things look on the app. lets give this a shot.
*/ 

// imports
import { Ionicons } from "@expo/vector-icons";
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

export default function WineEntryForm({ onSave, onCancel, initialData }) {
    // Form State
  const [wineName, setWineName] = useState('');
  const [wineType, setWineType] = useState('Red');
  const [wineVarietal, setSineVarietal] = useState('');
  const [wineYear, setWineYear] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  cosnt [RatingSlider, setRatings] = useState({
    sweetness: 0,
    tannins: 0,
     acidity: 0,
    alcohol:0
  });
  const [flavorNotes, setFlavorNotes] = useState([]);
  cosnt [additionalNotes, setAdditionalNotes] = useState('');
  const [photos, setPhotos] = useState([]);

  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  cosnt [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

// Load initial data if editing an existing wine
/*
THis use Effect is used to hold existing values of the wine if any.
when the the WineEntryForm first mounts the inital data is null because there has been nothing
logged about the wine. this useEffect is used when the user wants to go back in and edit the 
wine that they were logging. you can see at the end of the useEffect [initialData]. this is
the dependency array. what this does in a useEffect is rerun the useEffect everytime this 
dependencey array is changed. so if a user goes back in to edit the wine, this condition 
checks to see if there is initialData. lets say a user left one of these as null, then the
way this is coded is to "fall back" to whatever is after the ||. if the inital data changes, 
(like the user going to eidit differet wines) then the effect re-runs and updates thr form.
the logic for how inital data is passed into this function is used in the VistitLogForm
and it is too much to cover here 
*/
useEffect(() => {
  if (initialData) {
    setWineName(initialData.name || '')
    setWineType(initialData.type || 'Red')
    setWineVarietal(initialData.varietal || '')
    setWineYear(initialData.year || '')
    setOverallRating(initialData.overallRating || 0)
    setRatings(initialData.ratings || {
      sweetness: 0,
      tannis: 0,
      acidity: 0,
      body: 0,
      alcohol: 0
    });
    setFlavorNotes(initialData.flavorNotes || [])
    setAdditionalNotes(initialData.additionalNotes || '')
  }
}, [initialData]);

// Request permissions for camera and media library
const requestPermissions = async () => {
  //this is what asked the user to all access to camera and mediaLibrary
  const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
  const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();

  // if either of these are falsue, show alert and return false
  if (cameraStatus !== 'granted' || mediaStatus !== 'granded') {
    Alert.alert(
      'Permissions Required',
      'Camera and media library permissions are needed to take and save photos.',
      [{ text: 'OK' }]
    );
    return false;
  }

  // if both are true, this async function returns true. 
  return true;
};

// Take a photo with the camera
const takePhoto = async () => {
  try {
    // this tries to wait for the requestPermissions function to run. if it hasnt, then it
    // just returns.
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4,3],
      quality: .8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    // this checks to make sure the action was not canceled, and that there is a "asset"
    // and the asset has to be > 0 
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newPhoto = result.assets[0].uri;
      setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
      // this line adds a new photo to the end of a already existing list of photos then 
      // updates the state (newPhoto). remembre that the thing in the state that you use to 
      // update the state can take a function. like here were, prevPhotos are any photos that
      // had been previsously taken, the ... unpacks them an adds newPhoto to the end of it
    }
  } catch (error) {
    console.log('Camera error:', error);
    Alert.alert('Error', 'failed to take phot. please try again.')
  }
};

// pick an image from the meida library
const pickImage = async () => {
  try { 
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Photo library permission is needed to select photos.',
        [{ text: "OK "}]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4,3],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0 ) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to select image. Please try again.')
  }
};

// Remove a photo
const removePhoto = (index) => {
  Alert.alert(
    'Remove Photo',
    'are you sure you want to remove this photo?',
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

// update specific rating value
const updateRating = (key, value) => {
  setRatings((prevRating) => ({
    ...prevRatings,
    [key]: value,
  }));
};

//handel wine type selection
const handleWineTypeSelect = (type) => {
  setWineType(type);
  setShowTypeModal(false);
};

// Handle form submission
const handleSave = () => {
  // Wine type is required
  if (!wineType) {
    Alert.alert('Missing Informaiton', 'Please selct a wine type.');
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
    photos: photos,
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
        <Text style= {styles.noPotosText}>No photos added</Text>
      </View>
    );
  }
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
    <ScrollView style={styles.container} showsHorizontalScrollIndicator={false}>
      {/* Wine Basic Infor */}
      <View style={styles.section}>
        <Text style={styles.label}>Wine Name</Text>
        <TextInput
          style={styles.input}
          value={wineName}
          onChangeText={setWineName}
          placeholder="Enter wine name"
          placeholderTextColor='#999'
          />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Type *</Text>
        <TouchableOpacity
          style={styles.selectorButton}
          onPress={() => setShowTypeModal(true)}
        >
          <Text style={styles.selectorText}>{wineType}</Text>
          <Ionicons name="chevron-down" size={20} color='#666' />
        </TouchableOpacity>
      </View>

    <Modal
      visible={showTypeModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalHeader}>Select Wine Type</Text>
          <TouchableOpacity onPress={() => setShowTypeModal(false)}>
            <Ionicons name="close" size={24} color='#333' />
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
                <Ionicons name="chekcmark" size={20} color='#333' />
              )}}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>  
    </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
    padding: 16,
  },
  section: {
    marginBottom: 24,
  }
})