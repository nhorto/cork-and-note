import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WineEntryForm from './WineEntryForm';

export default function VisitLogForm({ winery, onSave, onCancel }) {
  // Form state
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [wineryNotes, setWineryNotes] = useState('');
  const [wines, setWines] = useState([]);
  const [showWineForm, setShowWineForm] = useState(false);
  const [currentWineIndex, setCurrentWineIndex] = useState(null);
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
  
  // Save the entire visit
  const handleSaveVisit = () => {
    // Validate
    if (!visitDate) {
      Alert.alert('Missing Information', 'Please enter a visit date.');
      return;
    }
    
    // Create visit object
    const visitData = {
      wineryId: winery.id,
      wineryName: winery.name,
      date: visitDate,
      notes: wineryNotes,
      wines,
      timestamp: new Date().toISOString()
    };
    
    // Call the save handler
    onSave(visitData);
  };
  
  // Render wine list item
  const renderWineItem = (wine, index) => {
    return (
      <View key={index} style={styles.wineItem}>
        <View style={styles.wineItemHeader}>
          <View style={styles.wineItemMain}>
            <Text style={styles.wineName}>{wine.name}</Text>
            <Text style={styles.wineType}>{wine.type} • {wine.year || 'N/A'}</Text>
          </View>
          
          <View style={styles.wineItemRating}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star}
                  name={
                    star <= Math.floor(wine.overallRating) 
                      ? "star" 
                      : star <= wine.overallRating + 0.5 
                        ? "star-half" 
                        : "star-outline"
                  } 
                  size={16} 
                  color="#FFD700" 
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{wine.overallRating.toFixed(1)}</Text>
          </View>
        </View>
        
        {wine.flavorNotes && wine.flavorNotes.length > 0 && (
          <View style={styles.tagsContainer}>
            {wine.flavorNotes.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        
        <View style={styles.wineItemActions}>
          <TouchableOpacity 
            style={styles.wineItemButton}
            onPress={() => handleEditWine(index)}
          >
            <Ionicons name="pencil" size={16} color="#8E2DE2" />
            <Text style={styles.wineItemButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.wineItemButton, styles.deleteButton]}
            onPress={() => handleDeleteWine(index)}
          >
            <Ionicons name="trash" size={16} color="#FF3B30" />
            <Text style={[styles.wineItemButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.formTitle}>Visit to {winery.name}</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Visit Date</Text>
          <TextInput
            style={styles.input}
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
          />
          <Text style={styles.dateDisplay}>{formatDate(visitDate)}</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Wines Tried</Text>
          
          {wines.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wine-outline" size={40} color="#ddd" />
              <Text style={styles.emptyStateText}>No wines added yet</Text>
            </View>
          ) : (
            <View style={styles.winesList}>
              {wines.map((wine, index) => renderWineItem(wine, index))}
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={handleAddWine}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Wine</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Winery Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={wineryNotes}
            onChangeText={setWineryNotes}
            placeholder="Enter notes about your overall experience at this winery"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveVisit}
          >
            <Text style={styles.buttonText}>Save Visit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Wine Form Modal */}
      <Modal
        visible={showWineForm}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowWineForm(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentWineIndex !== null ? 'Edit Wine' : 'Add Wine'}
            </Text>
          </View>
          
          <WineEntryForm
            onSave={handleSaveWine}
            onCancel={() => setShowWineForm(false)}
            initialData={currentWineIndex !== null ? wines[currentWineIndex] : null}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  formGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  dateDisplay: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  winesList: {
    marginBottom: 15,
  },
  wineItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wineItemMain: {
    flex: 1,
  },
  wineName: {
    fontSize: 16,
    fontWeight: '600',
  },
  wineType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  wineItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 5,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#E9D5FF',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    color: '#8E2DE2',
    fontSize: 12,
  },
  wineItemActions: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  wineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    marginRight: 15,
  },
  wineItemButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#8E2DE2',
  },
  deleteButton: {
    marginLeft: 'auto',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E2DE2',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 5,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
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
    backgroundColor: '#8E2DE2',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 15,
  },
});