// components/WineryActionButtons.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const { width } = Dimensions.get('window');
  const isNarrowScreen = width < 375;
  const isVeryNarrowScreen = width < 320;

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

  // Responsive button styles
  const getButtonStyle = () => {
    if (isVeryNarrowScreen) {
      return {
        ...styles.actionButton,
        paddingHorizontal: width * 0.02, // 2% of screen width
        paddingVertical: width * 0.025,  // 2.5% of screen width
        flex: 1,
        marginHorizontal: width * 0.01,  // 1% margin
      };
    } else if (isNarrowScreen) {
      return {
        ...styles.actionButton,
        paddingHorizontal: width * 0.03,
        paddingVertical: width * 0.03,
        flex: 1,
        marginHorizontal: width * 0.015,
      };
    } else {
      return styles.actionButton;
    }
  };

  const getTextStyle = () => ({
    ...styles.actionButtonText,
    fontSize: isVeryNarrowScreen ? 12 : isNarrowScreen ? 13 : 14,
  });

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
    <View style={[
      styles.container,
      isNarrowScreen && styles.narrowContainer
    ]}>
      <TouchableOpacity
        style={[
          getButtonStyle(),
          status.isFavorite && styles.activeFavoriteButton
        ]}
        onPress={toggleFavorite}
        disabled={loading}
      >
        <Ionicons
          name={status.isFavorite ? "heart" : "heart-outline"}
          size={isVeryNarrowScreen ? 20 : 24}
          color={status.isFavorite ? "#fff" : "#8C1C13"}
        />
        <Text
          style={[
            getTextStyle(),
            status.isFavorite && styles.activeButtonText
          ]}
        >
          {status.isFavorite ? "Favorited" : "Favorite"}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          getButtonStyle(),
          status.isWantToVisit && styles.activeWishlistButton
        ]}
        onPress={toggleWishlist}
        disabled={loading}
      >
        <Ionicons
          name={status.isWantToVisit ? "bookmark" : "bookmark-outline"}
          size={isVeryNarrowScreen ? 20 : 24}
          color={status.isWantToVisit ? "#fff" : "#8C1C13"}
        />
        <Text
          style={[
            getTextStyle(),
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
    justifyContent: 'space-between', // Changed from space-around
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 8, // Add horizontal padding
  },
  narrowContainer: {
    paddingHorizontal: 4, // Less padding on narrow screens
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#8C1C13',
    flex: 1, // Make buttons flexible
    marginHorizontal: 4, // Space between buttons
    maxWidth: 180, // Prevent buttons from getting too wide
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
    textAlign: 'center',
    flexShrink: 1, // Allow text to shrink if needed
  },
  activeButtonText: {
    color: '#fff',
  },
});

export default WineryActionButtons;