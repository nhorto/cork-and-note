// components/VisitLogForm.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../styles/theme';
import WineEntryForm from './WineEntryForm';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function VisitLogForm({ winery, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState(0);

  const [visitDate, setVisitDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [wineryNotes, setWineryNotes] = useState('');
  const [wineryPhotos, setWineryPhotos] = useState([]);
  const [wines, setWines] = useState([]);
  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const insets = useSafeAreaInsets();

  const tabs = [
    { id: 0, label: 'Wines', icon: 'wine-outline' },
    { id: 1, label: 'Details', icon: 'document-text-outline' },
    { id: 2, label: 'Review', icon: 'checkmark-circle-outline' }
  ];

  const handleExitWineForm = () => {
    Alert.alert(
      'Discard Changes?',
      'Any unsaved changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setShowWineForm(false) }
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
      'Remove this wine from your visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setWines(wines.filter((_, i) => i !== index))
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

  const takeWineryPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setWineryPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const pickWineryImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is needed.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setWineryPhotos(prev => [...prev, ...newPhotos]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const removeWineryPhoto = (index) => {
    Alert.alert(
      'Remove Photo',
      'Remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setWineryPhotos(prev => prev.filter((_, i) => i !== index))
        }
      ]
    );
  };

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

    onSave({
      wineryId: winery.id,
      date: visitDate,
      notes: wineryNotes,
      wines: wines,
      wineryPhotos: wineryPhotos,
      wineryPhoto: wineryPhotos.length > 0 ? wineryPhotos[0] : null
    });
  };

  const renderTabHeader = () => (
    <View style={styles.tabHeader}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => setActiveTab(tab.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={tab.icon}
            size={20}
            color={activeTab === tab.id ? colors.primary.burgundy : colors.neutral.pewter}
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

  const renderWinesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerDecoration}>
          <View style={styles.decorativeLine} />
          <Text style={styles.sectionLabel}>WINES TASTED</Text>
          <View style={styles.decorativeLine} />
        </View>
        <Text style={styles.winesCount}>{wines.length} wine{wines.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Wine Cards */}
      {wines.map((wine, index) => (
        <View key={index} style={styles.wineCard}>
          <View style={styles.wineCardHeader}>
            <View style={[
              styles.wineTypeIndicator,
              { backgroundColor: wine.type?.toLowerCase() === 'red' ? colors.primary.burgundy :
                               wine.type?.toLowerCase() === 'white' ? colors.gold.light :
                               colors.primary.rosé }
            ]} />
            <View style={styles.wineInfo}>
              <Text style={styles.wineName}>
                {wine.name || `${wine.type} Wine`}
              </Text>
              <Text style={styles.wineDetails}>
                {wine.type} {wine.varietal && `· ${wine.varietal}`} {wine.year && `· ${wine.year}`}
              </Text>
            </View>
            <View style={styles.wineRating}>
              <Ionicons name="star" size={14} color={colors.gold.rich} />
              <Text style={styles.ratingText}>
                {wine.overallRating ? wine.overallRating.toFixed(1) : '—'}
              </Text>
            </View>
          </View>

          {wine.photos?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.winePhotosPreview}>
              {wine.photos.slice(0, 3).map((photo, photoIndex) => (
                <Image key={photoIndex} source={{ uri: photo }} style={styles.winePhotoThumbnail} />
              ))}
              {wine.photos.length > 3 && (
                <View style={styles.morePhotosIndicator}>
                  <Text style={styles.morePhotosText}>+{wine.photos.length - 3}</Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.wineCardActions}>
            <TouchableOpacity style={styles.actionLink} onPress={() => handleEditWine(index)}>
              <Ionicons name="pencil-outline" size={16} color={colors.primary.burgundy} />
              <Text style={styles.actionLinkText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionLink} onPress={() => handleDeleteWine(index)}>
              <Ionicons name="trash-outline" size={16} color={colors.status.error} />
              <Text style={[styles.actionLinkText, { color: colors.status.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Add Wine Button */}
      <TouchableOpacity style={styles.addWineButton} onPress={handleAddWine} activeOpacity={0.7}>
        <View style={styles.addWineIcon}>
          <Ionicons name="add" size={24} color={colors.neutral.cream} />
        </View>
        <Text style={styles.addWineButtonText}>Add Wine</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Visit Date */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>VISIT DATE</Text>
        <TextInput
          style={styles.input}
          value={visitDate}
          onChangeText={setVisitDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.neutral.silver}
          selectionColor={colors.primary.burgundy}
        />
        <Text style={styles.datePreview}>{formatDate(visitDate)}</Text>
      </View>

      {/* Winery Notes */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>NOTES</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={wineryNotes}
          onChangeText={setWineryNotes}
          placeholder="Share your thoughts about the winery, atmosphere, staff..."
          placeholderTextColor={colors.neutral.silver}
          multiline
          textAlignVertical="top"
          selectionColor={colors.primary.burgundy}
        />
      </View>

      {/* Photos */}
      <View style={styles.formSection}>
        <Text style={styles.formLabel}>PHOTOS ({wineryPhotos.length})</Text>

        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={takeWineryPhoto} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={20} color={colors.neutral.cream} />
            <Text style={styles.photoButtonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.photoButton} onPress={pickWineryImage} activeOpacity={0.7}>
            <Ionicons name="images-outline" size={20} color={colors.neutral.cream} />
            <Text style={styles.photoButtonText}>Library</Text>
          </TouchableOpacity>
        </View>

        {wineryPhotos.length === 0 ? (
          <View style={styles.noPhotosContainer}>
            <Ionicons name="camera-outline" size={28} color={colors.neutral.silver} />
            <Text style={styles.noPhotosText}>No photos added</Text>
          </View>
        ) : (
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
                    <Ionicons name="close-circle" size={22} color={colors.status.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderReviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Visit Summary */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewIcon}>
            <Ionicons name="wine" size={24} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.reviewTitle}>Visit Summary</Text>
        </View>

        <View style={styles.reviewDivider} />

        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Winery</Text>
          <Text style={styles.reviewValue}>{winery.name}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Date</Text>
          <Text style={styles.reviewValue}>{formatDate(visitDate)}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Wines</Text>
          <Text style={styles.reviewValue}>{wines.length} wine{wines.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Photos</Text>
          <Text style={styles.reviewValue}>{wineryPhotos.length} photo{wineryPhotos.length !== 1 ? 's' : ''}</Text>
        </View>

        {wineryNotes && (
          <>
            <View style={styles.reviewDivider} />
            <Text style={styles.reviewNotesLabel}>Notes</Text>
            <Text style={styles.reviewNotes}>{wineryNotes}</Text>
          </>
        )}
      </View>

      {/* Wines Summary */}
      {wines.length > 0 && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewSectionTitle}>Wines Tasted</Text>
          <View style={styles.reviewDivider} />

          {wines.map((wine, index) => (
            <View key={index} style={styles.wineReviewItem}>
              <View style={styles.wineReviewInfo}>
                <Text style={styles.wineReviewName}>
                  {wine.name || `${wine.type} Wine`}
                </Text>
                <Text style={styles.wineReviewDetails}>
                  {wine.type} {wine.varietal && `· ${wine.varietal}`}
                </Text>
              </View>
              <View style={styles.wineReviewRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= (wine.overallRating || 0) ? "star" : "star-outline"}
                    size={12}
                    color={colors.gold.rich}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveVisit} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={22} color={colors.neutral.cream} />
        <Text style={styles.saveButtonText}>Save Visit</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Log Visit</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{winery.name}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {renderTabHeader()}

      <View style={styles.tabContentContainer}>
        {activeTab === 0 && renderWinesTab()}
        {activeTab === 1 && renderDetailsTab()}
        {activeTab === 2 && renderReviewTab()}
      </View>

      {/* Wine Form Modal */}
      <Modal visible={showWineForm} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.modalContainer, { paddingTop: insets.top || 10 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={handleExitWineForm}>
              <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentWineIndex !== null ? 'Edit Wine' : 'Add Wine'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <WineEntryForm
            onSave={handleSaveWine}
            onCancel={handleExitWineForm}
            initialData={currentWineIndex !== null ? wines[currentWineIndex] : null}
            defaultWinemaker={winery?.name || ''}
          />
        </SafeAreaView>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoModal} animationType="fade" transparent={true}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setShowPhotoModal(false)}
          >
            <Ionicons name="close" size={32} color={colors.neutral.cream} />
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
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerSubtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  headerSpacer: {
    width: 40,
  },

  // Tab Header
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.parchment,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.burgundy,
  },
  tabLabel: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: colors.primary.burgundy,
    fontWeight: '600',
  },

  // Tab Content
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: spacing.lg,
  },

  // Section Header
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  headerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold.muted,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginHorizontal: spacing.md,
  },
  winesCount: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    textAlign: 'center',
  },

  // Wine Card
  wineCard: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },
  wineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wineTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  wineInfo: {
    flex: 1,
  },
  wineName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  wineDetails: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
  },
  wineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  ratingText: {
    ...typography.body.small,
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  winePhotosPreview: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg + 4,
  },
  winePhotoThumbnail: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  morePhotosIndicator: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    ...typography.body.small,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
  wineCardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginLeft: spacing.lg + 4,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLinkText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
  },

  // Add Wine Button
  addWineButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addWineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWineButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Form Section
  formSection: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  datePreview: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  // Photo Section
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.burgundy,
  },
  photoButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '500',
  },
  noPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderStyle: 'dashed',
  },
  noPhotosText: {
    ...typography.body.small,
    color: colors.neutral.silver,
    marginTop: spacing.sm,
  },
  photoGallery: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  photoContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.cream,
    borderRadius: 12,
  },

  // Review Card
  reviewCard: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    ...shadows.soft,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  reviewTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  reviewSectionTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginVertical: spacing.md,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  reviewLabel: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
  },
  reviewValue: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
  },
  reviewNotesLabel: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginBottom: spacing.xs,
  },
  reviewNotes: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontStyle: 'italic',
  },
  wineReviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  wineReviewInfo: {
    flex: 1,
  },
  wineReviewName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
  },
  wineReviewDetails: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  wineReviewRating: {
    flexDirection: 'row',
    gap: 2,
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  saveButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  modalTitle: {
    flex: 1,
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },

  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: spacing.sm,
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
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
  },
  photoModalText: {
    ...typography.body.small,
    color: colors.neutral.cream,
  },
});
