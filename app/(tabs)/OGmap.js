// app/(tabs)/OGmap.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import { AuthContext } from '../_layout';
import WinerySearchModal from '../../components/WinerySearchModal';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import { wineryStatusService } from '../../lib/wineryStatus';

export default function OGMap() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const mapRef = useRef(null);
  const [showLabels, setShowLabels] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // —— STATUS LOADING ——
  const [wineriesWithStatus, setWineriesWithStatus] = useState([]);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      loadWineriesWithStatus();
    } else {
      // no user: default all statuses false
      setWineriesWithStatus(
        wineries.map(w => ({ 
          ...w, 
          status: { visited: false, isFavorite: false, isWantToVisit: false } 
        }))
      );
      setStatusLoaded(true);
    }
  }, [user]);

  const loadWineriesWithStatus = async () => {
    try {
      const { success, wineries: data } = await wineryStatusService.getAllWineriesWithStatus(wineries);
      setWineriesWithStatus(
        success 
          ? data 
          : wineries.map(w => ({ ...w, status: { visited: false, isFavorite: false, isWantToVisit: false } }))
      );
    } catch (err) {
      console.error(err);
      setWineriesWithStatus(
        wineries.map(w => ({ ...w, status: { visited: false, isFavorite: false, isWantToVisit: false } }))
      );
    } finally {
      setStatusLoaded(true);
    }
  };
  // ————————————

  // Initial region centered on Virginia
  const initialRegion = {
    latitude: 37.4316,
    longitude: -78.6569,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };

  // Request and set user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const handleRegionChange = region => {
    setShowLabels(region.longitudeDelta < 0.15);
  };

  const zoomToUserLocation = async () => {
    if (!userLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
    mapRef.current?.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);
  };

  const handleWinerySelect = winery => {
    mapRef.current?.animateToRegion({
      latitude: winery.latitude,
      longitude: winery.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);
  };

  const renderWineryMarker = winery => (
    <Marker
      key={winery.id}
      coordinate={{ latitude: winery.latitude, longitude: winery.longitude }}
      tracksViewChanges={false}
      onPress={() => router.push(`/winery/${winery.id}`)}
    >
      <View style={styles.markerWrapper}>
        <View style={styles.wineryMarker}>
          <Ionicons name="wine" size={16} color="#FFFFFF" />
        </View>
        {/* status badges around the marker */}
        {winery.status && (
          <View style={styles.statusContainer}>
            {winery.status.visited && <View style={[styles.statusBadge, styles.visited]} />}
            {winery.status.isFavorite && <View style={[styles.statusBadge, styles.favorite]} />}
            {winery.status.isWantToVisit && <View style={[styles.statusBadge, styles.wantToVisit]} />}
          </View>
        )}
      </View>

      {showLabels && (
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            {/* also show badges in the callout, more legible */}
            {winery.status && (
              <View style={styles.calloutBadges}>
                <WineryStatusBadges status={winery.status} />
              </View>
            )}
            <Text style={styles.calloutTitle}>{winery.name}</Text>
            <Text style={styles.calloutAddress}>{winery.address}</Text>
            <Text style={styles.calloutAction}>Tap to view details</Text>
          </View>
        </Callout>
      )}
    </Marker>
  );

  // choose data based on statusLoaded
  const dataToRender = statusLoaded ? wineriesWithStatus : wineries;

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
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {dataToRender.map(renderWineryMarker)}
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
        wineries={dataToRender}
        onWinerySelect={handleWinerySelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineryMarker: {
    backgroundColor: '#8C1C13',
    padding: 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // small circles around the marker
  statusContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    flexDirection: 'row',
  },
  statusBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
    marginHorizontal: 1,
  },
  visited: { backgroundColor: '#4CAF50' },
  favorite: { backgroundColor: '#E91E63' },
  wantToVisit: { backgroundColor: '#2196F3' },

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
  calloutBadges: {
    marginBottom: 6,
    alignItems: 'flex-start',
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
});