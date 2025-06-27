// components/WinerySearchModal.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const WinerySearchModal = ({ visible, onClose, wineries, onWinerySelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredWineries, setFilteredWineries] = useState([]);

  // Filter wineries when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWineries(wineries);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = wineries.filter(winery => 
        winery.name.toLowerCase().includes(query) ||
        (winery.address && winery.address.toLowerCase().includes(query))
      );
      setFilteredWineries(filtered);
    }
  }, [searchQuery, wineries]);

  // Clear search when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setFilteredWineries(wineries);
    }
  }, [visible, wineries]);

  const handleWinerySelect = (winery) => {
    onWinerySelect(winery);
    onClose();
  };

  const renderWineryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.wineryItem}
      onPress={() => handleWinerySelect(item)}
    >
      <View style={styles.wineryItemContent}>
        <Text style={styles.wineryName}>{item.name}</Text>
        <Text style={styles.wineryAddress} numberOfLines={1}>{item.address}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8C1C13" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="arrow-back" size={24} color="#3E3E3E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Winery</Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8C1C13" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search wineries by name or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            clearButtonMode="while-editing"
            placeholderTextColor='#8a8484'
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#777" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredWineries}
          keyExtractor={item => item.id.toString()}
          renderItem={renderWineryItem}
          contentContainerStyle={styles.wineriesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No wineries found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  closeButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  wineriesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wineryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  wineryItemContent: {
    flex: 1,
    marginRight: 10,
  },
  wineryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
    marginBottom: 2,
  },
  wineryAddress: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  }
});

export default WinerySearchModal;