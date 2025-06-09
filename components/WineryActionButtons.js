// components/WineryActionButtons.js
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { favoritesService } from '../lib/favorites';
import { wishlistService } from '../lib/wishlist';

const WineryActionButtons = ({ 
  winery, 
  initialStatus = null,
  onStatusChange = () => {},
  compact = false
}) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    isFavorite: false,
    isWantToVisit: false
  });

  // Load initial status
  useEffect(() => {
    if (initialStatus) {
      setStatus({
        isFavorite: initialStatus.isFavorite || false,
        isWantToVisit: initialStatus.isWantToVisit || false
      });
      setLoading(false);
    } else {
      loadStatus();
    }
  }, [winery.id, initialStatus]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      
      // Check favorite status
      const { success: favSuccess, isFavorite } = await favoritesService.isFavorite(winery.id);
      
      // Check wishlist status
      const { success: wishlistSuccess, isInWishlist } = await wishlistService.isInWishlist(winery.id);

      setStatus({
        isFavorite: isFavorite,
        isWantToVisit: isInWishlist
      });
    } catch (error) {
      console.error('Error loading winery status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async () => {
    try {
      setLoading(true);
      
      if (status.isFavorite) {
        // Remove from favorites
        const { success } = await favoritesService.removeFavorite(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isFavorite: false }));
          onStatusChange({ ...status, isFavorite: false });
        }
      } else {
        // Add to favorites
        const { success } = await favoritesService.addFavorite(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isFavorite: true }));
          onStatusChange({ ...status, isFavorite: true });
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to update favorite status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle wishlist status
  const toggleWishlist = async () => {
    try {
      setLoading(true);
      
      if (status.isWantToVisit) {
        // Remove from wishlist
        const { success } = await wishlistService.removeFromWishlistByWineryId(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isWantToVisit: false }));
          onStatusChange({ ...status, isWantToVisit: false });
        }
      } else {
        // Add to wishlist
        const { success } = await wishlistService.addToWishlist(winery.id);
        if (success) {
          setStatus(prev => ({ ...prev, isWantToVisit: true }));
          onStatusChange({ ...status, isWantToVisit: true });
          
          Alert.alert('Added', `${winery.name} has been added to your "Want to Visit" list.`);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to update wishlist: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity
          style={[
            styles.compactButton,
            status.isFavorite && styles.activeFavoriteButton
          ]}
          onPress={toggleFavorite}
          disabled={loading}
        >
          <Ionicons
            name={status.isFavorite ? "heart" : "heart-outline"}
            size={24}
            color={status.isFavorite ? "#fff" : "#8C1C13"}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.compactButton,
            status.isWantToVisit && styles.activeWishlistButton
          ]}
          onPress={toggleWishlist}
          disabled={loading}
        >
          <Ionicons
            name={status.isWantToVisit ? "bookmark" : "bookmark-outline"}
            size={24}
            color={status.isWantToVisit ? "#fff" : "#8C1C13"}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.actionButton,
          status.isFavorite && styles.activeFavoriteButton
        ]}
        onPress={toggleFavorite}
        disabled={loading}
      >
        <Ionicons
          name={status.isFavorite ? "heart" : "heart-outline"}
          size={24}
          color={status.isFavorite ? "#fff" : "#8C1C13"}
        />
        <Text
          style={[
            styles.actionButtonText,
            status.isFavorite && styles.activeButtonText
          ]}
        >
          {status.isFavorite ? "Favorited" : "Favorite"}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.actionButton,
          status.isWantToVisit && styles.activeWishlistButton
        ]}
        onPress={toggleWishlist}
        disabled={loading}
      >
        <Ionicons
          name={status.isWantToVisit ? "bookmark" : "bookmark-outline"}
          size={24}
          color={status.isWantToVisit ? "#fff" : "#8C1C13"}
        />
        <Text
          style={[
            styles.actionButtonText,
            status.isWantToVisit && styles.activeButtonText
          ]}
        >
          {status.isWantToVisit ? "Want to Visit" : "Want to Visit"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 20,
  },
  compactContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#8C1C13',
    minWidth: 150,
  },
  compactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#8C1C13',
    marginLeft: 8,
    width: 40,
    height: 40,
  },
  activeFavoriteButton: {
    backgroundColor: '#8C1C13',
    borderColor: '#8C1C13',
  },
  activeWishlistButton: {
    backgroundColor: '#8C1C13',
    borderColor: '#8C1C13',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#8C1C13',
  },
  activeButtonText: {
    color: '#fff',
  },
});

export default WineryActionButtons;