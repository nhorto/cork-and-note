// app/winery/[id].js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Linking } from 'react-native';

// Import components
import RatingSlider from '../../components/RatingSlider';
import FlavorTagSelector from '../../components/FlavorTagSelector';
import WineCard from '../../components/WineCard';

const { width } = Dimensions.get('window');
const WINE_TYPES = [
  'Red', 'White', 'Rosé', 'Sparkling', 'Dessert',
  'Red Blend', 'White Blend', 'Orange'
];

export default function WineryDetail() {
  const { id, log } = useLocalSearchParams();
  const router = useRouter();
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const swipePosition = useRef(0);

  const wineriesArray = wineries;
  const winery = wineriesArray.find((w) => w.id.toString() === id.toString());

  const [formStep, setFormStep] = useState(1); // 1: Visit Info, 2: Wine Details, 3: Summary
  const [showLogForm, setShowLogForm] = useState(log === 'true');
  const [winesTried, setWinesTried] = useState([
    {
      wineName: '',
      wineType: 'Red',
      wineYear: '',
      flavorNotes: [],
      wineRatings: {
        sweetness: '0',
        tannin: '0',
        acidity: '0',
        body: '0',
        alcohol: '0',
      },
      overallRating: 0,
      additionalNotes: '',
    },
  ]);
  const [currentWineIndex, setCurrentWineIndex] = useState(0);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isEditingWine, setIsEditingWine] = useState(false);
  const [swipingEnabled, setSwipingEnabled] = useState(true);

  // Modified gesture handler for swiping between wines - only active when not editing
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: swipeAnim } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    // Only process swipe gestures if swiping is enabled
    if (swipingEnabled && event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;
      swipePosition.current += translationX;
      
      // Determine if we should switch to next/previous wine
      if (translationX < -100 && currentWineIndex < winesTried.length - 1) {
        // Swipe left - go to next wine
        setCurrentWineIndex(currentWineIndex + 1);
      } else if (translationX > 100 && currentWineIndex > 0) {
        // Swipe right - go to previous wine
        setCurrentWineIndex(currentWineIndex - 1);
      }
      
      // Reset animation
      Animated.spring(swipeAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  // Update swiping enabled state when editing state changes
  React.useEffect(() => {
    setSwipingEnabled(!isEditingWine);
  }, [isEditingWine]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permission to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'There was an error picking the image.');
    }
  };

  const addNewWine = () => {
    setWinesTried((prevWines) => [
      ...prevWines,
      {
        wineName: '',
        wineType: 'Red',
        wineYear: '',
        flavorNotes: [],
        wineRatings: {
          sweetness: '0',
          tannin: '0',
          acidity: '0',
          body: '0',
          alcohol: '0',
        },
        overallRating: 0,
        additionalNotes: '',
      },
    ]);
    setCurrentWineIndex(winesTried.length);
    setIsEditingWine(true);
  };

  const handleSave = () => {
    const visitData = {
      wineryId: winery.id,
      wineryName: winery.name,
      date: visitDate,
      winesTried,
      additionalNotes: visitNotes,
      photoUri: photo,
    };

    console.log('Saving visit:', visitData);

    Alert.alert('Visit Logged', `Your visit to ${winery.name} has been saved!`, [
      { text: 'OK', onPress: () => setShowLogForm(false) },
    ]);
  };

  if (!winery) {
    return (
      <View style={styles.centerContainer}>
        <Text>Winery not found</Text>
      </View>
    );
  }

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {formStep === 1 && <Text style={styles.progressText}>Step 1: Visit Details</Text>}
      {formStep === 2 && (
        <Text style={styles.progressText}>
          Step 2: Wine {currentWineIndex + 1} of {winesTried.length}
        </Text>
      )}
      {formStep === 3 && <Text style={styles.progressText}>Step 3: Review & Save</Text>}
      
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, formStep >= 1 ? styles.activeStep : {}]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, formStep >= 2 ? styles.activeStep : {}]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, formStep >= 3 ? styles.activeStep : {}]} />
      </View>
    </View>
  );

  const renderVisitInfoStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.header}>Your Visit to {winery.name}</Text>
      
      <Text style={styles.label}>Visit Date:</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={visitDate}
        onChangeText={setVisitDate}
      />
      
      <Text style={styles.label}>Visit Notes:</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder="Any general notes about your visit (service, ambiance, etc.)"
        multiline
        value={visitNotes}
        onChangeText={setVisitNotes}
      />
      
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        <Ionicons name="camera" size={24} color="#8E2DE2" style={{ marginRight: 8 }} />
        <Text>{photo ? 'Change Photo' : 'Add Photo from Visit'}</Text>
      </TouchableOpacity>
      
      {photo && <Image source={{ uri: photo }} style={styles.imagePreview} />}
      
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={() => setFormStep(2)}
      >
        <Text style={styles.nextButtonText}>Next: Add Wines</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderWineDetailStep = () => {
    const wine = winesTried[currentWineIndex];
    
    return (
      <View style={styles.formSection}>
        <View style={styles.wineNavHeader}>
          <TouchableOpacity 
            style={styles.wineNavButton}
            disabled={currentWineIndex === 0}
            onPress={() => setCurrentWineIndex(currentWineIndex - 1)}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={currentWineIndex === 0 ? "#ccc" : "#8E2DE2"} 
            />
          </TouchableOpacity>
          
          <View style={styles.wineCounter}>
            {winesTried.map((_, index) => (
              <TouchableOpacity 
                key={index}
                style={[
                  styles.wineIndexDot,
                  currentWineIndex === index ? styles.activeWineIndexDot : {}
                ]}
                onPress={() => setCurrentWineIndex(index)}
              />
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.wineNavButton}
            disabled={currentWineIndex === winesTried.length - 1}
            onPress={() => setCurrentWineIndex(currentWineIndex + 1)}
          >
            <Ionicons 
              name="arrow-forward" 
              size={24} 
              color={currentWineIndex === winesTried.length - 1 ? "#ccc" : "#8E2DE2"} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Conditional PanGestureHandler - only apply when not editing */}
        {isEditingWine ? (
          <View style={styles.wineCardContainer}>
            <View style={styles.wineFormContainer}>
              <Text style={styles.label}>Wine Name:</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter the wine name"
                value={wine.wineName}
                onChangeText={(text) => {
                  const updatedWines = [...winesTried];
                  updatedWines[currentWineIndex].wineName = text;
                  setWinesTried(updatedWines);
                }}
              />

              <Text style={styles.label}>Wine Type:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={wine.wineType}
                  onValueChange={(itemValue) => {
                    const updatedWines = [...winesTried];
                    updatedWines[currentWineIndex].wineType = itemValue;
                    setWinesTried(updatedWines);
                  }}
                >
                  {WINE_TYPES.map((type) => (
                    <Picker.Item label={type} value={type} key={type} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Wine Year:</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter wine year"
                keyboardType="numeric"
                value={wine.wineYear}
                onChangeText={(text) => {
                  const updatedWines = [...winesTried];
                  updatedWines[currentWineIndex].wineYear = text;
                  setWinesTried(updatedWines);
                }}
              />

              <FlavorTagSelector
                selectedTags={wine.flavorNotes}
                onTagsChange={(tags) => {
                  const updatedWines = [...winesTried];
                  updatedWines[currentWineIndex].flavorNotes = tags;
                  setWinesTried(updatedWines);
                }}
              />

              {['sweetness', 'tannin', 'acidity', 'body', 'alcohol'].map((attribute) => (
                <View key={attribute} style={{ marginBottom: 15 }}>
                  <RatingSlider
                    label={attribute.charAt(0).toUpperCase() + attribute.slice(1)}
                    value={parseFloat(wine.wineRatings[attribute]) || 0}
                    onValueChange={(value) => {
                      const updatedWines = [...winesTried];
                      updatedWines[currentWineIndex].wineRatings[attribute] = value.toString();
                      setWinesTried(updatedWines);
                    }}
                    showStars={false}
                  />
                </View>
              ))}

              <RatingSlider
                label="Overall Rating"
                value={wine.overallRating}
                onValueChange={(value) => {
                  const updatedWines = [...winesTried];
                  updatedWines[currentWineIndex].overallRating = value;
                  setWinesTried(updatedWines);
                }}
                showStars={true}
              />
              
              <TouchableOpacity 
                style={styles.doneButton}
                onPress={() => setIsEditingWine(false)}
              >
                <Text style={styles.doneButtonText}>Done Editing</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            enabled={!isEditingWine}
          >
            <Animated.View
              style={[
                styles.wineCardContainer,
                {
                  transform: [{ translateX: swipeAnim }],
                },
              ]}
            >
              <View style={styles.improvedWineCard}>
                <WineCard 
                  wine={wine} 
                  expanded={true}
                  onPress={() => setIsEditingWine(true)}
                />
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => setIsEditingWine(true)}
                >
                  <Ionicons name="pencil" size={20} color="#8E2DE2" />
                  <Text style={styles.editButtonText}>Edit Wine Details</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        )}
        
        <View style={styles.wineActionsContainer}>
          <TouchableOpacity style={styles.addWineButton} onPress={addNewWine}>
            <Ionicons name="add-circle" size={24} color="#8E2DE2" style={{ marginRight: 8 }} />
            <Text style={styles.addWineButtonText}>Add Another Wine</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => setFormStep(3)}
          >
            <Text style={styles.nextButtonText}>Review & Save</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Instruction for user */}
        {!isEditingWine && winesTried.length > 1 && (
          <View style={styles.swipeInstructionContainer}>
          <Ionicons name="arrow-back" size={16} color="#666" />
          <Text style={styles.swipeInstructionText}>Swipe to navigate between wines</Text>
          <Ionicons name="arrow-forward" size={16} color="#666" />
        </View>
      )}
      </View>
    );
  };

  const renderReviewStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.header}>Review Visit to {winery.name}</Text>
      
      <View style={styles.visitSummary}>
        <Text style={styles.summaryLabel}>Date:</Text>
        <Text style={styles.summaryValue}>{visitDate}</Text>
        
        {visitNotes.length > 0 && (
          <>
            <Text style={styles.summaryLabel}>Notes:</Text>
            <Text style={styles.summaryValue}>{visitNotes}</Text>
          </>
        )}
        
        <Text style={styles.summaryLabel}>Wines Tried:</Text>
        <Text style={styles.summaryValue}>{winesTried.length}</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wineCardScroll}>
        {winesTried.map((wine, index) => (
          <View key={index} style={styles.summaryWineCard}>
            <WineCard 
              wine={wine}
              onPress={() => {
                setFormStep(2);
                setCurrentWineIndex(index);
              }}
            />
          </View>
        ))}
      </ScrollView>
      
      {photo && (
        <View style={styles.photoPreviewContainer}>
          <Text style={styles.summaryLabel}>Visit Photo:</Text>
          <Image source={{ uri: photo }} style={styles.summaryImagePreview} />
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setFormStep(2)}
        >
          <Text style={styles.backButtonText}>Edit Wines</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Visit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container}>
        {!showLogForm && (
          <View style={styles.detailsContainer}>
            <Text style={styles.title}>{winery.name}</Text>
            <Text style={styles.address}>{winery.address}</Text>

            <View style={styles.divider} />

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setShowLogForm(true)}>
                <Ionicons name="wine" size={24} color="#8E2DE2" />
                <Text style={styles.actionButtonText}>Log Your Visit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const lat = winery.latitude;
                  const lng = winery.longitude;
                  const label = encodeURIComponent(winery.name || "Destination");
                  
                  if (Platform.OS === 'ios') {
                    // iOS: Try Apple Maps first
                    const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
                    Linking.openURL(appleMapsUrl).catch(() => {
                      // Fallback to Google Maps web URL if Apple Maps fails
                      const googleWebUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                      Linking.openURL(googleWebUrl);
                    });
                  } else {
                    // Android: Use Google Maps
                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                    Linking.openURL(googleMapsUrl).catch(() => {
                      // Fallback to web URL
                      const fallbackUrl = `https://maps.google.com/?q=${lat},${lng}`;
                      Linking.openURL(fallbackUrl);
                    });
                  }
                }}
              >
                <Ionicons name="navigate" size={24} color="#8E2DE2" />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('Website', `Opening ${winery.name} website... (this is a placeholder untill we have their website)`);
                }}
              >
                <Ionicons name="globe" size={24} color="#8E2DE2" />
                <Text style={styles.actionButtonText}>Website</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showLogForm && (
          <View style={styles.formContainer}>
            {renderProgressIndicator()}
            
            {formStep === 1 && renderVisitInfoStep()}
            {formStep === 2 && renderWineDetailStep()}
            {formStep === 3 && renderReviewStep()}
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                Alert.alert(
                  'Cancel Log',
                  'Are you sure you want to cancel? All entered information will be lost.',
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes', onPress: () => setShowLogForm(false) }
                  ]
                );
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  address: {
    fontSize: 16,
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8E2DE2',
  },
  formContainer: {
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  activeStep: {
    backgroundColor: '#8E2DE2',
  },
  stepLine: {
    height: 2,
    width: 40,
    backgroundColor: '#ddd',
  },
  formSection: {
    marginBottom: 30,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginTop: 15,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
    fontSize: 15,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagePicker: {
    marginTop: 20,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    marginTop: 15,
    borderRadius: 6,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#8E2DE2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  wineNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  wineNavButton: {
    padding: 5,
  },
  wineCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wineIndexDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
    marginHorizontal: 5,
  },
  activeWineIndexDot: {
    backgroundColor: '#8E2DE2',
    width: 14,
    height: 14,
  },
  wineCardContainer: {
    width: '100%',
    marginVertical: 10,
  },
  wineFormContainer: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  improvedWineCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(142, 45, 226, 0.1)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  editButtonText: {
    color: '#8E2DE2',
    marginLeft: 6,
    fontWeight: '500',
  },
  wineActionsContainer: {
    marginTop: 20,
  },
  addWineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 6,
    marginBottom: 15,
  },
  addWineButtonText: {
    fontSize: 16,
    color: '#8E2DE2',
    fontWeight: 'bold',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  visitSummary: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  wineCardScroll: {
    marginVertical: 15,
  },
  summaryWineCard: {
    width: width * 0.8,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPreviewContainer: {
    marginTop: 15,
  },
  summaryImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  backButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    minWidth: '45%',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    padding: 15,
    backgroundColor: '#8E2DE2',
    borderRadius: 8,
    minWidth: '45%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignSelf: 'center',
    padding: 12,
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: '#8E2DE2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  swipeInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  swipeInstructionText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginHorizontal: 5,
  },
})