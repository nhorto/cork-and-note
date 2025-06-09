// components/WineryStatusBadges.js
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WineryStatusBadges = ({ status, compact = false }) => {
  if (!status) return null;
  
  const { visited, visitCount, isFavorite, isWantToVisit } = status;

  // Use different layouts based on compact mode
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {visited && (
          <View style={[styles.badge, styles.visitedBadge]}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
          </View>
        )}
        
        {isFavorite && (
          <View style={[styles.badge, styles.favoriteBadge]}>
            <Ionicons name="heart" size={14} color="#fff" />
          </View>
        )}
        
        {isWantToVisit && (
          <View style={[styles.badge, styles.wishlistBadge]}>
            <Ionicons name="bookmark" size={14} color="#fff" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {visited && (
        <View style={[styles.statusBadge, styles.visitedBadge]}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.badgeText}>
            {visitCount > 1 ? `Visited ${visitCount} times` : 'Visited'}
          </Text>
        </View>
      )}
      
      {isFavorite && (
        <View style={[styles.statusBadge, styles.favoriteBadge]}>
          <Ionicons name="heart" size={16} color="#fff" />
          <Text style={styles.badgeText}>Favorite</Text>
        </View>
      )}
      
      {isWantToVisit && (
        <View style={[styles.statusBadge, styles.wishlistBadge]}>
          <Ionicons name="bookmark" size={16} color="#fff" />
          <Text style={styles.badgeText}>Want to Visit</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  visitedBadge: {
    backgroundColor: '#4CAF50', // Green
  },
  favoriteBadge: {
    backgroundColor: '#E91E63', // Pink
  },
  wishlistBadge: {
    backgroundColor: '#2196F3', // Blue
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default WineryStatusBadges;