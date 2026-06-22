// components/FlavorTagSelector.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

// Predefined flavor categories and notes (#136). Custom descriptors can still be
// typed in via the "add custom" field; this is just the quick-pick palette.
const FLAVOR_CATEGORIES = {
  'Fruit': [
    'Green Apple', 'Red Apple', 'Baked Apple', 'Pear', 'Quince', 'Peach',
    'White Peach', 'Apricot', 'Nectarine', 'Red Cherry', 'Black Cherry',
    'Sour Cherry', 'Plum', 'Black Plum', 'Strawberry', 'Raspberry', 'Blackberry',
    'Blueberry', 'Boysenberry', 'Cranberry', 'Red Currant', 'Blackcurrant (Cassis)',
    'Lemon', 'Lime', 'Orange', 'Orange Peel', 'Grapefruit', 'Tangerine',
    'Pineapple', 'Mango', 'Passion Fruit', 'Lychee', 'Guava', 'Banana', 'Melon',
    'Watermelon', 'Fig', 'Date', 'Raisin', 'Prune', 'Dried Cherry', 'Pomegranate',
    'Jam', 'Stewed Fruit',
  ],
  'Floral & Herbal': [
    'Rose', 'Violet', 'Lavender', 'Honeysuckle', 'Jasmine', 'Elderflower',
    'Orange Blossom', 'Acacia', 'Potpourri', 'Geranium', 'Thyme', 'Rosemary',
    'Mint', 'Eucalyptus', 'Sage', 'Basil', 'Oregano', 'Fennel', 'Dill',
    'Green Bell Pepper', 'Jalapeño', 'Tomato Leaf', 'Fresh Cut Grass', 'Hay',
    'Dried Herbs', 'Black Tea', 'Green Tea',
  ],
  'Spice & Wood': [
    'Cinnamon', 'Vanilla', 'Clove', 'Nutmeg', 'Allspice', 'Anise', 'Star Anise',
    'Black Pepper', 'White Pepper', 'Licorice', 'Ginger', 'Cardamom', 'Cedar',
    'Oak', 'Toasted Oak', 'Coconut', 'Sandalwood', 'Tobacco', 'Cigar Box',
    'Leather', 'Pencil Shavings',
  ],
  'Earth & Mineral': [
    'Forest Floor', 'Mushroom', 'Truffle', 'Wet Stone', 'Chalk', 'Slate',
    'Graphite', 'Flint', 'Clay', 'Petrol', 'Wet Leaves', 'Barnyard', 'Game',
    'Iron/Blood', 'Saline', 'Sea Spray', 'Crushed Rock', 'Tar', 'Dust',
  ],
  'Other': [
    'Honey', 'Caramel', 'Butterscotch', 'Toffee', 'Chocolate', 'Dark Chocolate',
    'Cocoa', 'Coffee', 'Espresso', 'Mocha', 'Smoke', 'Toast', 'Butter', 'Cream',
    'Bread', 'Yeast', 'Biscuit', 'Brioche', 'Sourdough', 'Almond', 'Hazelnut',
    'Walnut', 'Marzipan', 'Molasses', 'Brown Sugar', 'Cola', 'Beeswax', 'Rubber',
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
              <Ionicons name="close-circle" size={16} color={colors.primary.burgundy} style={styles.removeIcon} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      {/* Search and Custom Tag Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={colors.primary.burgundy} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search flavor notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.neutral.silver}
            selectionColor={colors.primary.burgundy}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.primary.burgundy} />
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
            placeholderTextColor={colors.neutral.silver}
            selectionColor={colors.primary.burgundy}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addCustomTag}
            disabled={customTag.trim() === ''}
          >
            <Ionicons
              name="add-circle"
              size={24}
              color={customTag.trim() === '' ? colors.neutral.stone : colors.primary.burgundy}
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
                  color={colors.primary.burgundy}
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
                      <Ionicons name="checkmark" size={14} color={colors.neutral.cream} style={styles.checkIcon} />
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
    marginVertical: spacing.md,
  },
  label: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  selectedTagsScroll: {
    maxHeight: 50,
  },
  selectedTagsContainer: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  noTagsText: {
    ...typography.body.small,
    fontStyle: 'italic',
    color: colors.neutral.silver,
    paddingHorizontal: spacing.xs,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.rosé,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  selectedTagText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
  },
  removeIcon: {
    marginLeft: spacing.xs,
  },
  searchContainer: {
    marginVertical: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.parchment,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  customTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  customTagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.parchment,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  addButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  categoryTabsScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  categoryTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    backgroundColor: colors.neutral.linen,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  activeCategoryTab: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  categoryTabText: {
    ...typography.body.small,
    color: colors.neutral.graphite,
    fontWeight: '500',
  },
  activeCategoryTabText: {
    color: colors.neutral.cream,
  },
  tagsScrollView: {
    maxHeight: 200,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  categoryTitle: {
    ...typography.body.regular,
    fontWeight: 'bold',
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.linen,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  selectedTagButton: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  tagText: {
    ...typography.body.small,
    color: colors.neutral.graphite,
  },
  selectedTagButtonText: {
    color: colors.neutral.cream,
  },
  checkIcon: {
    marginLeft: spacing.xs,
  },
});

export default FlavorTagSelector;