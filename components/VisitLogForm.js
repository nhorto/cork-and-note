// Updated VisitLogForm.js with multiple photos support
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [wineryNotes, setWineryNotes] = useState('');
  const [wineryPhotos, setWineryPhotos] = useState([]); // Changed to array
  const [wines, setWines] = useState([]);
  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);
  
  // Photo modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const insets = useSafeAreaInsets();
  
  const tabs = [
    { id: 0, label: 'Wines', icon: 'wine' },
    { id: 1, label: 'Winery Details', icon: 'business' },
    { id: 2, label: 'Review & Save', icon: 'checkmark-circle' }
  ];

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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };
  
  const handleAddWine = () => {
    setCurrentWineIndex(null);
    setShowWineForm(true);
  };
  
  const handleEditWine = (index) => {
    setCurrentWineIndex(index);
    setShowWineForm(true);
  };
  
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
  
  const handleSaveWine = (wineData) => {
    if (currentWineIndex !== null) {
      const updatedWines = [...wines];
      updatedWines[currentWineIndex] = wineData;
      setWines(updatedWines);
    } else {
      setWines([...wines, wineData]);
    }
    
    setShowWineForm(false);
  };
  
  // Take photo for winery
  const takeWineryPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Camera permission is needed to take photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhoto = result.assets[0].uri;
        setWineryPhotos(prev => [...prev, newPhoto]);
      }
    } catch (error) {
      console.log('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Pick image for winery
  const pickWineryImage = async () => {
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
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setWineryPhotos(prev => [...prev, ...newPhotos]);
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Remove a winery photo
  const removeWineryPhoto = (index) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setWineryPhotos(prev => prev.filter((_, i) => i !== index));
          }
        }
      ]
    );
  };

  // View photo in full screen
  const viewWineryPhoto = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };
  
  const handleSaveVisit = () => {
    if (!visitDate) {
      Alert.alert('Missing Information', 'Please enter a visit date.');
      return;
    }
    
    if (wines.length === 0) {
      Alert.alert('No Wines Added', 'Please add at least one wine to your visit.');
      return;
    }
    
    const visitData = {
      wineryId: winery.id,
      date: visitDate,
      notes: wineryNotes,
      wines: wines,
      wineryPhotos: wineryPhotos,
      // Legacy support
      wineryPhoto: wineryPhotos.length > 0 ? wineryPhotos[0] : null
    };
    
    onSave(visitData);
  };

  // Render photo gallery for winery
  const renderWineryPhotoGallery = () => {
    if (wineryPhotos.length === 0) {
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
          {wineryPhotos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <TouchableOpacity onPress={() => viewWineryPhoto(index)}>
                <Image source={{ uri: photo }} style={styles.photoThumbnail} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => removeWineryPhoto(index)}
              >
                <Ionicons name="close-circle" size={24} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render tab header
  const renderTabHeader = () => (
    <View style={styles.tabHeader}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Ionicons
            name={tab.icon}
            size={20}
            color={activeTab === tab.id ? '#8C1C13' : '#666'}
          />
          <Text style={[
            styles.tabLabel,
            activeTab === tab.id && styles.activeTabLabel
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render wines tab
  const renderWinesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.winesHeader}>
        <Text style={styles.winesTitle}>Wines Tasted</Text>
        <Text style={styles.winesCount}>({wines.length})</Text>
      </View>
      
      {wines.map((wine, index) => (
        <View key={index} style={styles.wineCard}>
          <View style={styles.wineCardHeader}>
            <View style={styles.wineInfo}>
              <Text style={styles.wineName}>
                {wine.name || `${wine.type} Wine`}
              </Text>
              <Text style={styles.wineDetails}>
                {wine.type} {wine.varietal && `• ${wine.varietal}`} {wine.year && `• ${wine.year}`}
              </Text>
            </View>
            <View style={styles.wineRating}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>
                {wine.overallRating ? wine.overallRating.toFixed(1) : '0.0'}
              </Text>
            </View>
          </View>
          
          {/* Show wine photos if any */}
          {wine.photos && wine.photos.length > 0 && (
            <View style={styles.winePhotosPreview}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {wine.photos.slice(0, 3).map((photo, photoIndex) => (
                  <Image 
                    key={photoIndex} 
                    source={{ uri: photo }} 
                    style={styles.winePhotoThumbnail} 
                  />
                ))}
                {wine.photos.length > 3 && (
                  <View style={styles.morePhotosIndicator}>
                    <Text style={styles.morePhotosText}>+{wine.photos.length - 3}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
          
          <View style={styles.wineCardActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditWine(index)}
            >
              <Ionicons name="pencil" size={16} color="#8C1C13" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteWine(index)}
            >
              <Ionicons name="trash" size={16} color="#FF4444" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      
      <TouchableOpacity style={styles.addWineButton} onPress={handleAddWine}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addWineButtonText}>Add Wine</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render winery details tab
  const renderWineryDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.detailsSection}>
        <Text style={styles.label}>Visit Date</Text>
        <TextInput
          style={styles.input}
          value={visitDate}
          onChangeText={setVisitDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#999"
        />
        <Text style={styles.dateDisplay}>
          {formatDate(visitDate)}
        </Text>
      </View>
      
      <View style={styles.detailsSection}>
        <Text style={styles.label}>Winery Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={wineryNotes}
          onChangeText={setWineryNotes}
          placeholder="Share your thoughts about the winery, atmosphere, staff, etc..."
          placeholderTextColor="#999"
          multiline
          textAlignVertical="top"
        />
      </View>
      
      <View style={styles.detailsSection}>
        <Text style={styles.label}>Winery Photos ({wineryPhotos.length})</Text>
        
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={takeWineryPhoto}>
            <Ionicons name="camera" size={20} color="#E7E3E2" />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.photoButton} onPress={pickWineryImage}>
            <Ionicons name="images" size={20} color="#E7E3E2" />
            <Text style={styles.photoButtonText}>Choose Photos</Text>
          </TouchableOpacity>
        </View>

        {renderWineryPhotoGallery()}
      </View>
    </ScrollView>
  );

  // Render review tab
  const renderReviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.reviewSection}>
        <Text style={styles.reviewHeader}>Visit Summary</Text>
        <Text style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Winery:</Text> {winery.name}
        </Text>
        <Text style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Date:</Text> {formatDate(visitDate)}
        </Text>
        <Text style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Wines:</Text> {wines.length} wine{wines.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Photos:</Text> {wineryPhotos.length} winery photo{wineryPhotos.length !== 1 ? 's' : ''}
        </Text>
        
        {wineryNotes && (
          <>
            <Text style={styles.reviewLabel}>Notes:</Text>
            <Text style={styles.reviewNotes}>{wineryNotes}</Text>
          </>
        )}
      </View>
      
      <View style={styles.reviewSection}>
        <Text style={styles.reviewHeader}>Wines Summary</Text>
        {wines.map((wine, index) => (
          <View key={index} style={styles.wineReviewCard}>
            <Text style={styles.wineReviewName}>
              {wine.name || `${wine.type} Wine`}
            </Text>
            <Text style={styles.wineReviewDetails}>
              {wine.type} {wine.varietal && `• ${wine.varietal}`} {wine.year && `• ${wine.year}`}
            </Text>
            <View style={styles.wineReviewRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= (wine.overallRating || 0) ? "star" : "star-outline"}
                  size={14}
                  color="#FFD700"
                />
              ))}
            </View>
            {wine.photos && wine.photos.length > 0 && (
              <Text style={styles.winePhotoCount}>
                📷 {wine.photos.length} photo{wine.photos.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        ))}
      </View>
      
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveVisit}>
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
          
          {wineryPhotos.length > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedPhotoIndex * 400, y: 0 }}
            >
              {wineryPhotos.map((photo, index) => (
                <View key={index} style={styles.photoModalContainer}>
                  <Image source={{ uri: photo }} style={styles.photoModalImage} />
                </View>
              ))}
            </ScrollView>
          )}
          
          <View style={styles.photoModalIndicator}>
            <Text style={styles.photoModalText}>
              {selectedPhotoIndex + 1} of {wineryPhotos.length}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  closeButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8C1C13',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#8C1C13',
    fontWeight: '600',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  winesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  winesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  winesCount: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  wineCard: {
    backgroundColor: '#f4f1ef',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  wineDetails: {
    fontSize: 14,
    color: '#666',
  },
  wineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3E3E3E',
  },
  winePhotosPreview: {
    marginVertical: 8,
  },
  winePhotoThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 6,
  },
  morePhotosIndicator: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  wineCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  editButtonText: {
    color: '#8C1C13',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  deleteButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  addWineButton: {
    flexDirection: 'row',
    backgroundColor: '#8C1C13',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
  },
  addWineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
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
  reviewSection: {
    backgroundColor: '#f4f1ef',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  reviewHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  reviewItem: {
    fontSize: 15,
    color: '#3E3E3E',
    marginBottom: 4,
  },
  reviewLabel: {
    fontWeight: '600',
  },
  reviewNotes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  wineReviewCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  wineReviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 2,
  },
  wineReviewDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  wineReviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  winePhotoCount: {
    fontSize: 12,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#8C1C13',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: '#E7E3E2',
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
    padding: 16,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalCloseButton: {
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    flex: 1,
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