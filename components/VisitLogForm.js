// components/VisitLogForm.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WineEntryForm from './WineEntryForm';

export default function VisitLogForm({ winery, onSave, onCancel }) {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Form state
  const [visitDate, setVisitDate] = useState(() => {
    // Get current date in local timezone and format as YYYY-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [wineryNotes, setWineryNotes] = useState('');
  const [wineryPhoto, setWineryPhoto] = useState(null);
  const [wines, setWines] = useState([]);
  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);

  // Fix header
  const insets = useSafeAreaInsets();
  
  // Tab configuration
  const tabs = [
    { id: 0, label: 'Wines', icon: 'wine' },
    { id: 1, label: 'Winery Details', icon: 'business' },
    { id: 2, label: 'Review & Save', icon: 'checkmark-circle' }
  ];

  // Alert for exiting wine form
  const handleExitWineForm = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to exit? Any unsaved changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => setShowWineForm(false) }
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Create date object from string and adjust for local timezone
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Use UTC to prevent timezone shifting
    });
  };
  
  // Add a new wine
  const handleAddWine = () => {
    setCurrentWineIndex(null);
    setShowWineForm(true);
  };
  
  // Edit an existing wine
  const handleEditWine = (index) => {
    setCurrentWineIndex(index);
    setShowWineForm(true);
  };
  
  // Delete a wine entry
  const handleDeleteWine = (index) => {
    Alert.alert(
      'Delete Wine',
      'Are you sure you want to remove this wine from your visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const updatedWines = wines.filter((_, i) => i !== index);
            setWines(updatedWines);
          }
        }
      ]
    );
  };
  
  // Save a wine entry
  const handleSaveWine = (wineData) => {
    if (currentWineIndex !== null) {
      // Update existing wine
      const updatedWines = [...wines];
      updatedWines[currentWineIndex] = wineData;
      setWines(updatedWines);
    } else {
      // Add new wine
      setWines([...wines, wineData]);
    }
    
    setShowWineForm(false);
  };
  
  // Pick image for winery
  const pickWineryImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permission to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setWineryPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'There was an error picking the image.');
    }
  };
  
  // Take photo for winery
  const takeWineryPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera permission to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        mediaTypes: ImagePicker.MediaType.Images,
      });

      if (!result.canceled) {
        setWineryPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'There was an error taking the photo.');
    }
  };
  
  // Save the entire visit
  const handleSaveVisit = () => {
    // Validate
    if (!visitDate) {
      Alert.alert('Missing Information', 'Please enter a visit date.');
      return;
    }
    
    if (wines.length === 0) {
      Alert.alert('No Wines Added', 'Please add at least one wine to your visit.');
      return;
    }
    
    // Create visit object
    const visitData = {
      wineryId: winery.id,
      wineryName: winery.name,
      date: visitDate,
      notes: wineryNotes,
      wines,
      wineryPhoto,
      timestamp: new Date().toISOString()
    };
    
    // Call the save handler
    onSave(visitData);
  };
  
  // Render tab header
  const renderTabHeader = () => (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Ionicons 
            name={tab.icon} 
            size={20} 
            color={activeTab === tab.id ? '#8C1C13' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  // Render wine list item (improved card matching wines tab style)
  const renderWineCard = (wine, index) => {
    // Helper to get wine type color
    const getWineTypeColor = (type) => {
      switch (type?.toLowerCase()) {
        case 'red':
        case 'red blend':
          return '#8B0000';
        case 'white':
        case 'white blend':
          return '#F0E68C';
        case 'rosé':
          return '#FFB6C1';
        case 'sparkling':
          return '#FFD700';
        case 'dessert':
          return '#D2691E';
        case 'orange':
          return '#FFA500';
        default:
          return '#8E2DE2';
      }
    };
    
    return (
      <TouchableOpacity 
        key={index} 
        style={styles.wineCard}
        onPress={() => handleEditWine(index)}
      >
        <View style={styles.wineImageContainer}>
          <View style={[
            styles.wineImagePlaceholder,
            { backgroundColor: getWineTypeColor(wine.type) }
          ]}>
            <Ionicons 
              name="wine" 
              size={24} 
              color={wine.type?.toLowerCase() === 'white' || wine.type?.toLowerCase() === 'white blend' ? '#333' : '#fff'} 
            />
          </View>
        </View>
        
        <View style={styles.wineInfo}>
          {wine.varietal && (
            <Text style={styles.wineVarietal}>{wine.varietal}</Text>
          )}
          <Text style={styles.wineName}>
            {wine.name || wine.type || 'Unnamed Wine'} 
            {wine.year && ` (${wine.year})`}
          </Text>
          
          {/* Overall Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star}
                  name={star <= Math.floor(wine.overallRating) ? "star" : star <= wine.overallRating ? "star-half" : "star-outline"} 
                  size={14} 
                  color="#FFD700" 
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{wine.overallRating.toFixed(1)}</Text>
          </View>
          
          {/* All Rating Bars */}
          {wine.ratings && (
            <View style={styles.ratingsContainer}>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Sweet</Text>
                <View style={styles.ratingBar}>
                  <View style={[styles.ratingBarFill, { width: `${(wine.ratings.sweetness / 5) * 100}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{wine.ratings.sweetness.toFixed(1)}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Tannin</Text>
                <View style={styles.ratingBar}>
                  <View style={[styles.ratingBarFill, { width: `${(wine.ratings.tannins / 5) * 100}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{wine.ratings.tannins.toFixed(1)}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Acidity</Text>
                <View style={styles.ratingBar}>
                  <View style={[styles.ratingBarFill, { width: `${(wine.ratings.acidity / 5) * 100}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{wine.ratings.acidity.toFixed(1)}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Body</Text>
                <View style={styles.ratingBar}>
                  <View style={[styles.ratingBarFill, { width: `${(wine.ratings.body / 5) * 100}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{wine.ratings.body.toFixed(1)}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Alcohol</Text>
                <View style={styles.ratingBar}>
                  <View style={[styles.ratingBarFill, { width: `${(wine.ratings.alcohol / 5) * 100}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{wine.ratings.alcohol.toFixed(1)}</Text>
              </View>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteWine(index);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  // Render wines tab
  const renderWinesTab = () => (
    <ScrollView style={styles.tabContent}>
      {wines.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wine-outline" size={60} color="#B08442" />
          <Text style={styles.emptyStateTitle}>No wines added yet</Text>
          <Text style={styles.emptyStateText}>Start by adding the wines you tried</Text>
        </View>
      ) : (
        <View style={styles.winesList}>
          {wines.map((wine, index) => renderWineCard(wine, index))}
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.addWineButton}
        onPress={handleAddWine}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.addWineButtonText}>Add Wine</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  // Render winery details tab
  const renderWineryDetailsTab = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        style={styles.tabContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.detailsSection}>
          <Text style={styles.label}>Visit Date</Text>
          <TextInput
            style={styles.input}
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
          />
          <Text style={styles.dateDisplay}>{formatDate(visitDate)}</Text>
        </View>
        
        <View style={styles.detailsSection}>
          <Text style={styles.label}>Winery Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={wineryNotes}
            onChangeText={setWineryNotes}
            placeholder="How was the atmosphere, service, overall experience?"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
        
        <View style={styles.detailsSection}>
          <Text style={styles.label}>Winery Photo</Text>
          
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={takeWineryPhoto}>
              <Ionicons name="camera" size={20} color="#8C1C13" />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.photoButton} onPress={pickWineryImage}>
              <Ionicons name="image" size={20} color="#8C1C13" />
              <Text style={styles.photoButtonText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>
          
          {wineryPhoto && (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: wineryPhoto }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setWineryPhoto(null)}
              >
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Add extra padding at bottom to ensure content is accessible above keyboard */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
  
  // Render review tab
  const renderReviewTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.reviewSection}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Visit Summary</Text>
          <TouchableOpacity onPress={() => setActiveTab(1)}>
            <Text style={styles.editLink}>Edit Details</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Date:</Text>
          <Text style={styles.reviewValue}>{formatDate(visitDate)}</Text>
        </View>
        
        {wineryNotes ? (
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Notes:</Text>
            <Text style={styles.reviewValue}>{wineryNotes}</Text>
          </View>
        ) : null}
        
        {wineryPhoto && (
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Photo:</Text>
            <Image source={{ uri: wineryPhoto }} style={styles.reviewPhoto} />
          </View>
        )}
      </View>
      
      <View style={styles.reviewSection}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Wines ({wines.length})</Text>
          <TouchableOpacity onPress={() => setActiveTab(0)}>
            <Text style={styles.editLink}>Edit Wines</Text>
          </TouchableOpacity>
        </View>
        
        {wines.map((wine, index) => (
          <View key={index} style={styles.reviewWine}>
            <Text style={styles.reviewWineType}>{wine.type}</Text>
            {wine.varietal && <Text style={styles.reviewWineVarietal}>{wine.varietal}</Text>}
            {wine.name && <Text style={styles.reviewWineName}>{wine.name}</Text>}
            <View style={styles.reviewRating}>
              <Text style={styles.reviewRatingText}>Rating: </Text>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star}
                  name={star <= wine.overallRating ? "star" : "star-outline"} 
                  size={14} 
                  color="#FFD700" 
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSaveVisit}
      >
        <Text style={styles.saveButtonText}>Save Visit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E7E3E2' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Visit to {winery.name}</Text>
      </View>
      
      {renderTabHeader()}
      
      <View style={styles.tabContentContainer}>
        {activeTab === 0 && renderWinesTab()}
        {activeTab === 1 && renderWineryDetailsTab()}
        {activeTab === 2 && renderReviewTab()}
      </View>
      
      {/* Wine Form Modal */}
      <Modal
        visible={showWineForm}
        animationType="slide"
        transparent={false}
      >
        <SafeAreaView style={[styles.modalContainer, { paddingTop: insets.top || 10 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleExitWineForm}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentWineIndex !== null ? 'Edit Wine' : 'Add Wine'}
            </Text>
          </View>

          <WineEntryForm
            onSave={handleSaveWine}
            onCancel={handleExitWineForm}
            initialData={currentWineIndex !== null ? wines[currentWineIndex] : null}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingTop: 8, // Reduced top padding for better positioning
  },
  closeButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    color: '#3E3E3E',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f4f1ef',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8C1C13',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
  },
  activeTabText: {
    color: '#8C1C13',
    fontWeight: '500',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  scrollContentContainer: {
    paddingBottom: 50, // Extra space for keyboard
  },
  bottomPadding: {
    height: 150, // Extra space to ensure content is accessible above keyboard
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#3E3E3E',
  },
  emptyStateText: {
    color: '#666',
  },
  winesList: {
    marginBottom: 20,
  },
  wineCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f4f1ef',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  wineImageContainer: {
    marginRight: 15,
  },
  wineImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineInfo: {
    flex: 1,
  },
  wineVarietal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 2,
  },
  wineName: {
    fontSize: 14,
    color: '#3E3E3E',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 5,
  },
  ratingText: {
    fontSize: 12,
    color: '#888',
  },
  ratingsContainer: {
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  ratingLabel: {
    fontSize: 11,
    color: '#666',
    width: 45,
  },
  ratingBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#8C1C13',
  },
  ratingValue: {
    fontSize: 11,
    color: '#666',
    width: 25,
    textAlign: 'right',
  },
  deleteButton: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  addWineButton: {
    flexDirection: 'row',
    backgroundColor: '#8C1C13',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addWineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
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
  dateDisplay: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
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
    borderWidth: 1,
    borderColor: '#8C1C13',
    borderRadius: 8,
  },
  photoButtonText: {
    color: '#8C1C13',
    fontWeight: '500',
  },
  photoPreviewContainer: {
    marginTop: 12,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  reviewSection: {
    backgroundColor: '#f4f1ef',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  editLink: {
    color: '#8C1C13',
    fontWeight: '500',
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 15,
    color: '#3E3E3E',
  },
  reviewPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  reviewWine: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  reviewWineType: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3E3E3E',
  },
  reviewWineVarietal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  reviewWineName: {
    fontSize: 14,
    color: '#3E3E3E',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewRatingText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  saveButton: {
    backgroundColor: '#8C1C13',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#E7E3E2',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 15,
    color: '#3E3E3E',
  },
});