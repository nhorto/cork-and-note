// app/(tabs)/wishlist.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import { wishlistService } from '../../lib/wishlist';
import { AuthContext } from '../_layout';

export default function WishlistScreen() {
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    loadWishlist();
  }, [user]);

  const loadWishlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { success, wishlist: data } = await wishlistService.getUserWishlist();
      if (success) setWishlist(data);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      Alert.alert('Error', 'Failed to load your wishlist. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleWineryPress = (wineryId) => {
    router.push(`/winery/${wineryId}`);
  };

  const handleRemoveItem = (item) => {
    Alert.alert(
      'Remove from Want to Visit',
      `Remove ${item.wineries.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { success } = await wishlistService.removeFromWishlist(item.id);
              if (success) {
                setWishlist(curr => curr.filter(i => i.id !== item.id));
              }
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Could not remove item. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const renderWishlistItem = ({ item }) => (
    <TouchableOpacity
      style={styles.wineryItem}
      onPress={() => handleWineryPress(item.winery_id)}
    >
      <View style={styles.wineryInfo}>
        <Text style={styles.wineryName}>{item.wineries.name}</Text>
        <Text style={styles.wineryAddress} numberOfLines={1}>
          {item.wineries.address}
        </Text>
        <WineryStatusBadges
          status={{
            isWantToVisit: true,
            visited: item.status?.visited ?? false,
            isFavorite: item.status?.isFavorite ?? false
          }}
        />
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item)}
      >
        <Ionicons name="close-circle" size={22} color="#8C1C13" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="bookmark-outline" size={64} color="#ccc" />
        <Text style={styles.messageTitle}>Sign In Required</Text>
        <Text style={styles.messageText}>
          Please sign in to view and manage your Want to Visit list.
        </Text>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8C1C13" />
        <Text style={styles.loadingText}>Loading your wishlist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={wishlist}
        keyExtractor={item => item.id.toString()}
        renderItem={renderWishlistItem}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerStyle={
          wishlist.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons name="bookmark-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Your Want to Visit List is Empty</Text>
            <Text style={styles.emptyText}>
              Add wineries you'd like to visit in the future to your list.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E7E3E2',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  wineryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wineryInfo: {
    flex: 1,
    marginRight: 12,
  },
  wineryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  wineryAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyInner: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginTop: 16,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});