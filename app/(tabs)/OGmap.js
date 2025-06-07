// app/(tabs)/OGmap.js - Performance optimized version
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

export default function OGMap() {
  const router = useRouter();
  const [showLabels, setShowLabels] = useState(false);
  
  // Initial region centered on Virginia
  const initialRegion = {
    latitude: 37.4316,
    longitude: -78.6569,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };

  // Handle region change to determine when to show labels
  const handleRegionChange = (region) => {
    // Show labels when zoomed in (longitude delta less than 0.5 degrees)
    setShowLabels(region.longitudeDelta < 0.15);
  };

  // Render a single winery marker
  const renderWineryMarker = (winery, index) => {
    return (
      <Marker
        key={`winery-${winery.id}`}
        identifier={`winery-${winery.id}`}
        coordinate={{
          latitude: winery.latitude,
          longitude: winery.longitude
        }}
        tracksViewChanges={false} // Important for performance
        onPress={() => router.push(`/winery/${winery.id}`)}
      >
        <View style={styles.wineryMarker}>
          <Ionicons name="wine" size={16} color="#FFFFFF" />
        </View>
        
        {showLabels && (
          <Callout tooltip>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutTitle}>{winery.name}</Text>
              <Text style={styles.calloutAddress}>{winery.address}</Text>
              <Text style={styles.calloutAction}>Tap to view details</Text>
            </View>
          </Callout>
        )}
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation
        maxZoomLevel={19}
        minZoomLevel={5}
        rotateEnabled={false}
        loadingEnabled={true}
        moveOnMarkerPress={false}
      >
        {wineries.map(renderWineryMarker)}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  wineryMarker: {
    backgroundColor: '#8C1C13',
    padding: 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 3,
    color: '#3E3E3E',
  },
  calloutAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  calloutAction: {
    fontSize: 11,
    color: '#8C1C13',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 3,
  },
});