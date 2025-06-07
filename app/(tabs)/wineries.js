// Here's how your updated wineries.js file should look

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Make sure to import Ionicons
import wineries from '../../data/wineries_with_coordinates_and_id.json';

export default function Wineries() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filteredWineries = wineries.filter(winery => winery.name.toLowerCase().includes(search.toLowerCase()));

  const handleWineryPress = (id) => {
    router.push(`/winery/${id}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} style={styles.searchIcon} color="#8C1C13" />
        <TextInput
          placeholder="Search wineries..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={filteredWineries}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.wineryItem}
            onPress={() => handleWineryPress(item.id)}
          >
            <Text style={styles.wineryName}>{item.name}</Text>
            <Text style={styles.wineryAddress}>{item.address}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#E7E3E2',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#3E3E3E',
  },
  clearButton: {
    padding: 5,
  },
  listContent: {
    padding: 15,
  },
  wineryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#F0F0F0',
    marginBottom: 10,
    borderRadius: 8,
  },
  wineryName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#3E3E3E',
  },
  wineryAddress: {
    fontSize: 14,
    color: '#666',
  }
});