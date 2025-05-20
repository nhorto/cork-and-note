// components/WineCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WineCard = ({ wine, expanded = false, onPress }) => {
  if (!wine) return null;

  // Helper function to get color based on wine type
  const getWineTypeColor = (type) => {
    switch (type.toLowerCase()) {
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

  // Helper to generate star rating display
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      let iconName = 'star-outline';
      if (i < fullStars) {
        iconName = 'star';
      } else if (i === fullStars && hasHalfStar) {
        iconName = 'star-half';
      }
      
      stars.push(
        <Ionicons 
          key={i} 
          name={iconName} 
          size={16} 
          color="#FFD700" 
          style={{ marginRight: 2 }}
        />
      );
    }
    
    return (
      <View style={styles.starContainer}>
        {stars}
      </View>
    );
  };

  // Render flavor notes in a nice layout
  const renderFlavorNotes = () => {
    if (!wine.flavorNotes || wine.flavorNotes.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.flavorContainer}>
        <Text style={styles.sectionTitle}>Flavor Notes:</Text>
        <View style={styles.tagsContainer}>
          {wine.flavorNotes.map((note, index) => (
            <View key={index} style={styles.flavorTag}>
              <Text style={styles.flavorTagText}>{note}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Helper to display wine attributes as a radar/spider chart visual representation
  const renderWineAttributes = () => {
    if (!wine.wineRatings) return null;
    
    const attributes = [
      { name: 'Sweetness', value: parseFloat(wine.wineRatings.sweetness) || 0 },
      { name: 'Tannin', value: parseFloat(wine.wineRatings.tannin) || 0 },
      { name: 'Acidity', value: parseFloat(wine.wineRatings.acidity) || 0 },
      { name: 'Body', value: parseFloat(wine.wineRatings.body) || 0 },
      { name: 'Alcohol', value: parseFloat(wine.wineRatings.alcohol) || 0 }
    ];
    
    return (
      <View style={styles.attributesContainer}>
        <Text style={styles.sectionTitle}>Wine Profile:</Text>
        <View style={styles.attributesList}>
          {attributes.map((attr, index) => (
            <View key={index} style={styles.attributeItem}>
              <Text style={styles.attributeName}>{attr.name}</Text>
              <View style={styles.attributeBarContainer}>
                <View style={[styles.attributeBar, { width: `${(attr.value / 5) * 100}%` }]} />
              </View>
              <Text style={styles.attributeValue}>{attr.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderLeftColor: getWineTypeColor(wine.wineType) }
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {wine.wineName || 'Unnamed Wine'}
          </Text>
          {wine.wineYear && (
            <Text style={styles.year}>{wine.wineYear}</Text>
          )}
        </View>
        
        <View style={styles.typeContainer}>
          <View 
            style={[
              styles.typeIndicator,
              { backgroundColor: getWineTypeColor(wine.wineType) }
            ]}
          />
          <Text style={styles.type}>{wine.wineType}</Text>
        </View>
      </View>

      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>Rating:</Text>
        {renderStars(wine.overallRating)}
        <Text style={styles.ratingValue}>{wine.overallRating.toFixed(1)}/5</Text>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          {renderFlavorNotes()}
          {renderWineAttributes()}
          
          {wine.additionalNotes && (
            <View style={styles.notesContainer}>
              <Text style={styles.sectionTitle}>Notes:</Text>
              <Text style={styles.notes}>{wine.additionalNotes}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#8E2DE2',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  year: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  type: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 5,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  expandedContent: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  flavorContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flavorTag: {
    backgroundColor: 'rgba(142, 45, 226, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 6,
    marginBottom: 6,
  },
  flavorTagText: {
    color: '#8E2DE2',
    fontSize: 12,
    fontWeight: '500',
  },
  attributesContainer: {
    marginBottom: 15,
  },
  attributesList: {
    marginTop: 5,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attributeName: {
    width: 70,
    fontSize: 14,
    color: '#666',
  },
  attributeBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  attributeBar: {
    height: '100%',
    backgroundColor: '#8E2DE2',
    borderRadius: 3,
  },
  attributeValue: {
    width: 25,
    fontSize: 13,
    color: '#666',
    textAlign: 'right',
  },
  notesContainer: {
    marginBottom: 5,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default WineCard;