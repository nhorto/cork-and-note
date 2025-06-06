// app/(tabs)/wineries.js (FlatList & Search with navigation)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

export default function Wineries() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filteredWineries = wineries.filter(winery => winery.name.toLowerCase().includes(search.toLowerCase()));

  const handleWineryPress = (id) => {
    router.push(`/winery/${id}`);
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#E7E3E2' }}>
      <TextInput 
        placeholder="Search Wineries..." 
        value={search} 
        onChangeText={setSearch} 
        style={{ padding: 10, borderWidth: 1, marginBottom: 10 }} 
      />
      <FlatList
        data={filteredWineries}
        keyExtractor={item => item.id.toString()}
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
  wineryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#F0F0F0',
  },
  wineryName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  wineryAddress: {
    fontSize: 14,
    color: '#666',
  }
});