// components/FlavorTagSelector.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Predefined flavor categories and notes
const FLAVOR_CATEGORIES = {
  'Fruit': [
    'Apple', 'Pear', 'Peach', 'Apricot', 'Cherry', 'Plum', 'Strawberry', 
    'Raspberry', 'Blackberry', 'Blueberry', 'Lemon', 'Orange', 'Grapefruit',
    'Pineapple', 'Mango', 'Banana', 'Melon', 'Fig', 'Date', 'Raisin'
  ],
  'Floral & Herbal': [
    'Rose', 'Violet', 'Lavender', 'Honeysuckle', 'Jasmine', 'Thyme', 
    'Rosemary', 'Mint', 'Eucalyptus', 'Sage', 'Basil', 'Oregano'
  ],
  'Spice & Wood': [
    'Cinnamon', 'Vanilla', 'Clove', 'Nutmeg', 'Black Pepper', 'White Pepper', 
    'Licorice', 'Cedar', 'Oak', 'Sandalwood', 'Tobacco', 'Leather'
  ],
  'Earth & Mineral': [
    'Forest Floor', 'Mushroom', 'Truffle', 'Wet Stone', 'Chalk', 'Slate', 
    'Graphite', 'Flint', 'Clay', 'Petrol'
  ],
  'Other': [
    'Honey', 'Caramel', 'Butterscotch', 'Toffee', 'Chocolate', 'Coffee', 
    'Smoke', 'Toast', 'Butter', 'Cream', 'Bread', 'Yeast', 'Biscuit'
  ]
};

const FlavorTagSelector = ({ selectedTags = [], onTagsChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Fruit');
  const [customTag, setCustomTag] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  // Toggle a tag's selection status
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  // Add a custom tag
  const addCustomTag = () => {
    if (customTag.trim() !== '' && !selectedTags.includes(customTag.trim())) {
      onTagsChange([...selectedTags, customTag.trim()]);
      setCustomTag('');
    }
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Filter tags based on search query
  const filterTags = () => {
    if (!searchQuery.trim()) {
      return FLAVOR_CATEGORIES;
    }

    const filtered = {};
    const query = searchQuery.toLowerCase().trim();

    Object.entries(FLAVOR_CATEGORIES).forEach(([category, tags]) => {
      const matchingTags = tags.filter(tag => 
        tag.toLowerCase().includes(query)
      );
      
      if (matchingTags.length > 0) {
        filtered[category] = matchingTags;
      }
    });

    return filtered;
  };

  const filteredCategories = filterTags();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Flavor Notes:</Text>
      
      {/* Selected Tags */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.selectedTagsScroll}
        contentContainerStyle={styles.selectedTagsContainer}
      >
        {selectedTags.length === 0 ? (
          <Text style={styles.noTagsText}>No flavor notes selected</Text>
        ) : (
          selectedTags.map((tag, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.selectedTag}
              onPress={() => toggleTag(tag)}
            >
              <Text style={styles.selectedTagText}>{tag}</Text>
              <Ionicons name="close-circle" size={16} color="#8E2DE2" style={styles.removeIcon} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      {/* Search and Custom Tag Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color="#8E2DE2" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search flavor notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8E2DE2" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.customTagContainer}>
          <TextInput
            style={styles.customTagInput}
            placeholder="Add custom flavor note..."
            value={customTag}
            onChangeText={setCustomTag}
            onSubmitEditing={addCustomTag}
          />
          <TouchableOpacity 
            style={styles.addButton}
            onPress={addCustomTag}
            disabled={customTag.trim() === ''}
          >
            <Ionicons 
              name="add-circle" 
              size={24} 
              color={customTag.trim() === '' ? '#ccc' : '#8E2DE2'} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Category Tabs */}
      {!searchQuery && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabsScroll}
        >
          {Object.keys(FLAVOR_CATEGORIES).map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                activeCategory === category && styles.activeCategoryTab
              ]}
              onPress={() => setActiveCategory(category)}
            >
              <Text 
                style={[
                  styles.categoryTabText,
                  activeCategory === category && styles.activeCategoryTabText
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      {/* Flavor Tags */}
      <ScrollView 
        style={styles.tagsScrollView}
        nestedScrollEnabled={true}
      >
        {Object.entries(filteredCategories).map(([category, tags]) => (
          <View key={category} style={styles.categorySection}>
            {searchQuery ? (
              <TouchableOpacity 
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category)}
              >
                <Text style={styles.categoryTitle}>{category}</Text>
                <Ionicons 
                  name={expandedCategories[category] ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#8E2DE2" 
                />
              </TouchableOpacity>
            ) : (
              activeCategory === category && (
                <Text style={styles.categoryTitle}>{category}</Text>
              )
            )}
            
            {((searchQuery && expandedCategories[category]) || 
              (!searchQuery && activeCategory === category)) && (
              <View style={styles.tagsContainer}>
                {tags.map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.tagButton,
                      selectedTags.includes(tag) && styles.selectedTagButton
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text 
                      style={[
                        styles.tagText,
                        selectedTags.includes(tag) && styles.selectedTagButtonText
                      ]}
                    >
                      {tag}
                    </Text>
                    {selectedTags.includes(tag) && (
                      <Ionicons name="checkmark" size={14} color="#fff" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  selectedTagsScroll: {
    maxHeight: 50,
  },
  selectedTagsContainer: {
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  noTagsText: {
    fontStyle: 'italic',
    color: '#999',
    paddingHorizontal: 5,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 45, 226, 0.1)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  selectedTagText: {
    color: '#8E2DE2',
    fontWeight: '500',
    fontSize: 14,
  },
  removeIcon: {
    marginLeft: 5,
  },
  searchContainer: {
    marginVertical: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  customTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  customTagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
    fontSize: 14,
  },
  addButton: {
    marginLeft: 10,
    padding: 5,
  },
  categoryTabsScroll: {
    maxHeight: 44,
    marginBottom: 10,
  },
  categoryTab: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  activeCategoryTab: {
    backgroundColor: '#8E2DE2',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeCategoryTabText: {
    color: '#fff',
  },
  tagsScrollView: {
    maxHeight: 200,
  },
  categorySection: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 5,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTagButton: {
    backgroundColor: '#8E2DE2',
  },
  tagText: {
    color: '#555',
    fontSize: 13,
  },
  selectedTagButtonText: {
    color: '#fff',
  },
  checkIcon: {
    marginLeft: 4,
  },
});

export default FlavorTagSelector;