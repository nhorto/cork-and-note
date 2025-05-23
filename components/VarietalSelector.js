// components/VarietalSelector.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Common wine varietals organized by type
const WINE_VARIETALS = {
  'Red': [
    'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah/Shiraz', 'Cabernet Franc',
    'Sangiovese', 'Tempranillo', 'Grenache', 'Malbec', 'Petit Verdot',
    'Zinfandel', 'Barbera', 'Nebbiolo', 'Petite Sirah', 'Mourvedre'
  ],
  'White': [
    'Chardonnay', 'Sauvignon Blanc', 'Pinot Grigio/Pinot Gris', 'Riesling', 'Gewürztraminer',
    'Viognier', 'Albariño', 'Chenin Blanc', 'Sémillon', 'Marsanne',
    'Roussanne', 'Vermentino', 'Grüner Veltliner', 'Muscadet', 'Vinho Verde'
  ],
  'Rosé': [
    'Provence Rosé', 'Pinot Noir Rosé', 'Sangiovese Rosé', 'Grenache Rosé',
    'Syrah Rosé', 'Cabernet Sauvignon Rosé', 'Merlot Rosé', 'Tempranillo Rosé'
  ],
  'Sparkling': [
    'Champagne', 'Prosecco', 'Cava', 'Crémant', 'Blanc de Blancs',
    'Blanc de Noirs', 'Brut', 'Extra Dry', 'Demi-Sec', 'Moscato d\'Asti'
  ],
  'Dessert': [
    'Port', 'Sherry', 'Madeira', 'Ice Wine', 'Late Harvest Riesling',
    'Sauternes', 'Moscato', 'Tokaji', 'Vin Santo', 'Banyuls'
  ],
  'Red Blend': [
    'Bordeaux Blend', 'Rhône Blend', 'GSM (Grenache/Syrah/Mourvedre)', 
    'Super Tuscan', 'Meritage', 'Red Table Wine', 'Proprietary Red Blend'
  ],
  'White Blend': [
    'White Bordeaux Blend', 'Rhône White Blend', 'Proprietary White Blend',
    'White Table Wine', 'Field Blend'
  ],
  'Orange': [
    'Orange Pinot Grigio', 'Orange Sauvignon Blanc', 'Orange Chardonnay',
    'Orange Riesling', 'Skin Contact White'
  ]
};

const VarietalSelector = ({ wineType, selectedVarietal, onVarietalChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customVarietal, setCustomVarietal] = useState('');

  // Get varietals for the current wine type
  const availableVarietals = WINE_VARIETALS[wineType] || [];

  // Filter varietals based on search
  const filteredVarietals = availableVarietals.filter(varietal =>
    varietal.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVarietalSelect = (varietal) => {
    onVarietalChange(varietal);
    setShowModal(false);
    setSearchQuery('');
  };

  const handleCustomVarietal = () => {
    if (customVarietal.trim()) {
      onVarietalChange(customVarietal.trim());
      setCustomVarietal('');
      setShowModal(false);
      setSearchQuery('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Wine Varietal/Style</Text>
      
      <TouchableOpacity 
        style={styles.selector}
        onPress={() => setShowModal(true)}
      >
        <Text style={[
          styles.selectorText, 
          !selectedVarietal && styles.placeholder
        ]}>
          {selectedVarietal || 'Select varietal...'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#8E2DE2" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Varietal</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowModal(false);
                  setSearchQuery('');
                  setCustomVarietal('');
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8E2DE2" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search varietals..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="#8E2DE2" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.varietalsList}>
              {filteredVarietals.map((varietal, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.varietalItem,
                    selectedVarietal === varietal && styles.selectedVarietalItem
                  ]}
                  onPress={() => handleVarietalSelect(varietal)}
                >
                  <Text style={[
                    styles.varietalText,
                    selectedVarietal === varietal && styles.selectedVarietalText
                  ]}>
                    {varietal}
                  </Text>
                  {selectedVarietal === varietal && (
                    <Ionicons name="checkmark" size={20} color="#8E2DE2" />
                  )}
                </TouchableOpacity>
              ))}
              
              {filteredVarietals.length === 0 && searchQuery && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No matching varietals found</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.customSection}>
              <Text style={styles.customLabel}>Don't see your varietal?</Text>
              <View style={styles.customInputContainer}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Enter custom varietal..."
                  value={customVarietal}
                  onChangeText={setCustomVarietal}
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    !customVarietal.trim() && styles.addButtonDisabled
                  ]}
                  onPress={handleCustomVarietal}
                  disabled={!customVarietal.trim()}
                >
                  <Text style={[
                    styles.addButtonText,
                    !customVarietal.trim() && styles.addButtonTextDisabled
                  ]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    minHeight: 50, // Ensure enough height for text
  },
  selectorText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 8,
    height: 40,
  },
  clearButton: {
    padding: 5,
  },
  varietalsList: {
    maxHeight: 300,
  },
  varietalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedVarietalItem: {
    backgroundColor: 'rgba(142, 45, 226, 0.1)',
  },
  varietalText: {
    fontSize: 16,
    color: '#333',
  },
  selectedVarietalText: {
    color: '#8E2DE2',
    fontWeight: '500',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  customSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  customLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    marginRight: 10,
    height: 45, // Ensure enough height
  },
  addButton: {
    backgroundColor: '#8E2DE2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    height: 45,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  addButtonTextDisabled: {
    opacity: 0.7,
  },
});

export default VarietalSelector;