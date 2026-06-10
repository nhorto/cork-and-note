// components/WineCard.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const WineCard = ({ wine, expanded = false, onPress }) => {
  if (!wine) return null;

  // Helper function to get color based on wine type
  const getWineTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case 'red':
      case 'red blend':
        return colors.primary.burgundy;
      case 'white':
      case 'white blend':
        return colors.gold.rich;
      case 'rosé':
        return colors.primary.rosé;
      case 'sparkling':
        return colors.gold.shimmer;
      case 'dessert':
        return colors.gold.muted;
      case 'orange':
        return '#E8A259';
      default:
        return colors.primary.merlot;
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
          color={colors.gold.rich}
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
    const flavorNotes = wine.flavorNotes || wine.flavor_notes || [];
    if (!flavorNotes || flavorNotes.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.flavorContainer}>
        <Text style={styles.sectionTitle}>Flavor Notes:</Text>
        <View style={styles.tagsContainer}>
          {flavorNotes.map((note, index) => (
            <View key={index} style={styles.flavorTag}>
              <Text style={styles.flavorTagText}>
                {typeof note === 'string' ? note : note.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Helper to display wine attributes as a radar/spider chart visual representation
  const renderWineAttributes = () => {
    const ratings = wine.wineRatings || wine.ratings || {};
    if (!ratings || Object.keys(ratings).length === 0) return null;
    
    const attributes = [
      { name: 'Sweetness', value: parseFloat(ratings.sweetness || wine.sweetness) || 0 },
      { name: 'Tannin', value: parseFloat(ratings.tannin || ratings.tannins || wine.tannin) || 0 },
      { name: 'Acidity', value: parseFloat(ratings.acidity || wine.acidity) || 0 },
      { name: 'Body', value: parseFloat(ratings.body || wine.body) || 0 },
      { name: 'Alcohol', value: parseFloat(ratings.alcohol || wine.alcohol) || 0 }
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

  // Get wine name with fallback
  const wineName = wine.wineName || wine.wine_name || 'Unnamed Wine';
  
  // Get wine varietal with fallback
  const wineVarietal = wine.wineVarietal || wine.wine_varietal;
  
  // Get wine year with fallback
  const wineYear = wine.wineYear || wine.wine_year;
  
  // Get wine type with fallback
  const wineType = wine.wineType || wine.wine_type || 'Unknown';
  
  // Get overall rating with fallback
  const overallRating = wine.overallRating || wine.overall_rating || 0;
  
  // Get additional notes with fallback
  const additionalNotes = wine.additionalNotes || wine.additional_notes;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderLeftColor: getWineTypeColor(wineType) }
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.headerContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {wineName || wineVarietal || wineType || 'Unnamed Wine'}
          </Text>
          <View style={styles.wineDetails}>
            {!wineName && !wineVarietal && wineType && (
              <Text style={styles.type}>
                {wineType}
              </Text>
            )}
            {wineName && wineVarietal && (
              <Text style={styles.varietal}>
                {wineVarietal}
              </Text>
            )}
            {wineYear && (
              <Text style={styles.year}>
                {(wineName && wineVarietal) ? ' • ' : ''}
                {wineYear}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.typeContainer}>
          <View 
            style={[
              styles.typeIndicator,
              { backgroundColor: getWineTypeColor(wineType) }
            ]}
          />
          <Text style={styles.type}>{wineType}</Text>
        </View>
      </View>

      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>Rating:</Text>
        {renderStars(overallRating)}
        <Text style={styles.ratingValue}>{overallRating.toFixed(1)}/5</Text>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          {renderFlavorNotes()}
          {renderWineAttributes()}
          
          {additionalNotes && (
            <View style={styles.notesContainer}>
              <Text style={styles.sectionTitle}>Notes:</Text>
              <Text style={styles.notes}>{additionalNotes}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
    borderLeftWidth: 5,
    borderLeftColor: colors.primary.merlot,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.body.regular,
    fontWeight: 'bold',
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    fontSize: 17,
  },
  wineDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  varietal: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
  },
  year: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.parchment,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  type: {
    ...typography.body.small,
    fontWeight: '500',
    color: colors.neutral.graphite,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  ratingLabel: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginRight: spacing.xs,
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: spacing.xs,
  },
  ratingValue: {
    ...typography.body.small,
    fontWeight: 'bold',
    color: colors.neutral.graphite,
  },
  expandedContent: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
    paddingTop: spacing.md,
  },
  flavorContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body.regular,
    fontWeight: 'bold',
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flavorTag: {
    backgroundColor: colors.primary.rosé,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  flavorTagText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '500',
    fontSize: 12,
  },
  attributesContainer: {
    marginBottom: spacing.md,
  },
  attributesList: {
    marginTop: spacing.xs,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  attributeName: {
    width: 70,
    ...typography.body.small,
    color: colors.neutral.pewter,
  },
  attributeBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: colors.neutral.linen,
    borderRadius: 3,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  attributeBar: {
    height: '100%',
    backgroundColor: colors.primary.burgundy,
    borderRadius: 3,
  },
  attributeValue: {
    width: 25,
    ...typography.body.small,
    color: colors.neutral.graphite,
    textAlign: 'right',
    fontSize: 13,
  },
  notesContainer: {
    marginBottom: spacing.xs,
  },
  notes: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontStyle: 'italic',
  },
});

export default WineCard;