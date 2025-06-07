// app/(tabs)/OGmap.js - Performance optimized version
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import WinerySearchModal from '../../components/WinerySearchModal';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

export default function OGMap() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [showLabels, setShowLabels] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  
  // Initial region centered on Virginia
  const initialRegion = {
    latitude: 37.4316,
    longitude: -78.6569,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };

  // Request location permissions when component mounts
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
        return;
      }
      
      try {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  // Handle region change to determine when to show labels
  const handleRegionChange = (region) => {
    // Show labels when zoomed in (longitude delta less than 0.5 degrees)
    setShowLabels(region.longitudeDelta < 0.15);
  };

  // Function to zoom to user's location
  const zoomToUserLocation = async () => {
    if (!userLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const userCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(userCoords);
        
        // Animate to user location
        mapRef.current?.animateToRegion({
          ...userCoords,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      } catch (error) {
        Alert.alert('Error', 'Could not determine your location. Please ensure location services are enabled.');
      }
    } else {
      // Animate to user location
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // Function to handle winery selection from search
  const handleWinerySelect = (winery) => {
    // Animate to winery location
    mapRef.current?.animateToRegion({
      latitude: winery.latitude,
      longitude: winery.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);
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
        ref={mapRef}
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
      
      {/* Search Button */}
      <TouchableOpacity 
        style={styles.searchButton}
        onPress={() => setShowSearchModal(true)}
      >
        <Ionicons name="search" size={22} color="#8C1C13" />
      </TouchableOpacity>
      
      {/* Location Button */}
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={zoomToUserLocation}
      >
        <Ionicons name="locate" size={24} color="#8C1C13" />
      </TouchableOpacity>

      {/* Search Modal */}
      <WinerySearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        wineries={wineries}
        onWinerySelect={handleWinerySelect}
      />
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
  locationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  searchButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  }
});