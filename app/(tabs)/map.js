import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Supercluster from 'supercluster';
import WinerySearchModal from '../../components/WinerySearchModal';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import { wineryStatusService } from '../../lib/wineryStatus';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [clusters, setClusters] = useState([]);
  const [region, setRegion] = useState({
    latitude: 37.4316, // Approximate center of Virginia
    longitude: -78.6569,
    latitudeDelta: 5,  // Wider delta to show the whole state
    longitudeDelta: 5,
  });

  //insert hooks for user location and search modal
  const [userLocation, setUserLocation] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // status loading
  const [wineriesWithStatus, setWineriesWithStatus] = useState([]);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    loadWineriesWithStatus();
  }, []);

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

  // Request and set user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
          return;
        }
        
        const loc = await Location.getCurrentPositionAsync({});
        const userLoc = { 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude 
        };
        setUserLocation(userLoc);
        
        // Optionally zoom to user location on initial load
        // mapRef.current?.animateToRegion({
        //   ...userLoc,
        //   latitudeDelta: 0.5,
        //   longitudeDelta: 0.5,
        // }, 1000);
      } catch (error) {
        console.error("Error getting location:", error);
        Alert.alert('Location Error', 'Unable to get your current location.');
      }
    })();
  }, []);

  // zoom to users location
  const zoomToUserLocation = async () => {
    if (!userLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
          return;
        }
        
        const loc = await Location.getCurrentPositionAsync({});
        const userLoc = { 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude 
        };
        setUserLocation(userLoc);
        
        mapRef.current?.animateToRegion({
          ...userLoc,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      } catch (error) {
        console.error("Error getting location:", error);
        Alert.alert('Location Error', 'Unable to get your current location.');
      }
    } else {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };
  
  // handle winery select
  const handleWinerySelect = winery => {
    mapRef.current?.animateToRegion({
      latitude: winery.latitude,
      longitude: winery.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 1000);
  };

  // Convert wineries to GeoJSON format for Supercluster - memoized to prevent recalculation
  const points = useMemo(() => {
    // Use wineriesWithStatus if available and loaded, otherwise use the original wineries
    const wineryData = statusLoaded && wineriesWithStatus.length > 0 ? wineriesWithStatus : wineries;
    
    return wineryData.map(winery => ({
      type: 'Feature',
      properties: { 
        cluster: false, 
        wineryId: winery.id, 
        name: winery.name, 
        status: winery.status || { visited: false, isFavorite: false, isWantToVisit: false },
      },
      geometry: {
        type: 'Point',
        coordinates: [winery.longitude, winery.latitude]
      }
    }));
  }, [wineriesWithStatus, wineries, statusLoaded]);

  // Create supercluster instance - memoized to prevent recreation
  const supercluster = useMemo(() => {
    const instance = new Supercluster({
      radius: 40,
      maxZoom: 16
    });
    instance.load(points);
    return instance;
  }, [points]);

  // Update clusters when region changes, using a memoized function
  const updateClusters = useMemo(() => {
    return (newRegion) => {
      // Get map bounds
      const northEast = {
        latitude: newRegion.latitude + newRegion.latitudeDelta/2,
        longitude: newRegion.longitude + newRegion.longitudeDelta/2
      };
      const southWest = {
        latitude: newRegion.latitude - newRegion.latitudeDelta/2,
        longitude: newRegion.longitude - newRegion.longitudeDelta/2
      };
      const bounds = [
        southWest.longitude, southWest.latitude, 
        northEast.longitude, northEast.latitude
      ];

      const zoom = Math.log2(360 / newRegion.longitudeDelta) - 1;
      const newClusters = supercluster.getClusters(bounds, Math.floor(zoom));
      setClusters(newClusters);
    };
  }, [supercluster]);

  // Update clusters when region changes
  useEffect(() => {
    updateClusters(region);
  }, [region, updateClusters]);

  // Use useEffect to measure and update before painting to prevent flickering
  useEffect(() => {
    // Only run once on mount to set initial clusters
    updateClusters(region);
  }, []);

  const onRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
  };

  // Memoize cluster rendering to prevent flickering
  const renderCluster = useMemo(() => {
    return (cluster) => {
      const { cluster_id, point_count } = cluster.properties;
      
      return (
        <Marker
          key={`cluster-${cluster_id}`}
          coordinate={{
            latitude: cluster.geometry.coordinates[1],
            longitude: cluster.geometry.coordinates[0]
          }}
          onPress={() => {
            // Zoom in on cluster when pressed
            const children = supercluster.getLeaves(cluster_id, 100);
            const childrenCoordinates = children.map(child => ({
              latitude: child.geometry.coordinates[1],
              longitude: child.geometry.coordinates[0]
            }));
            
            mapRef.current.fitToCoordinates(childrenCoordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true
            });
          }}
        >
          <View style={{
            width: 35,
            height: 35,
            borderRadius: 20,
            backgroundColor: '#8C1C13',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#3E3E3E',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 1,
            elevation: 5
          }}>
            <Text style={{ 
              color: '#fff', 
              fontWeight: 'bold',
              fontSize: 14,
              textAlign: 'center'
            }}>
              {point_count}
            </Text>
          </View>
        </Marker>
      );
    };
  }, [supercluster]);

  // Memoize marker rendering to prevent flickering
  const renderMarker = useMemo(() => {
    return (cluster) => {
      const winery = cluster.properties;
      // Ensure status exists with default values if not present
      const status = winery.status || { visited: false, isFavorite: false, isWantToVisit: false };

      return (
        <Marker
          key={winery.wineryId}
          coordinate={{
            latitude: cluster.geometry.coordinates[1],
            longitude: cluster.geometry.coordinates[0]
          }}
          tracksViewChanges={false}
          onPress={() => router.push(`/winery/${winery.wineryId}`)}
        >
          <View style={styles.markerContainer}>
            {/* Winery name label */}
            <View style={styles.markerLabelContainer}>
              <Text style={styles.markerLabel} numberOfLines={1}>
                {winery.name}
              </Text>
            </View>

            {/* Icon + status badges */}
            <View style={styles.markerWrapper}>
              <View style={styles.wineryMarker}>
                <Ionicons 
                  name="wine" 
                  size={Platform.OS === 'android' ? 22 : 16} 
                  color="#FFFFFF" 
                />
              </View>

              {/* status badges */}
              <View style={styles.statusContainer}>
                {status.visited && <View style={[styles.statusBadge, styles.visited]} />}
                {status.isFavorite && <View style={[styles.statusBadge, styles.favorite]} />}
                {status.isWantToVisit && <View style={[styles.statusBadge, styles.wantToVisit]} />}
              </View>
            </View>
          </View>
        </Marker>
      );
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {clusters.map(cluster => {
          // Render a cluster marker if a cluster
          if (cluster.properties.cluster) {
            return renderCluster(cluster);
          }
          
          // Render a single marker if not
          return renderMarker(cluster);
        })}
      </MapView>

      {/* Location Button */}
      <TouchableOpacity 
        style={styles.locationButton}
        onPress={zoomToUserLocation}
      >
        <Ionicons name="locate" size={24} color="#8C1C13" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.searchButton}
        onPress={() => setShowSearchModal(true)}
      >
        <Ionicons name="search" size={24} color="#8C1C13" />
      </TouchableOpacity>

      {/* Search Modal */}
      <WinerySearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        wineries={statusLoaded ? wineriesWithStatus : wineries}
        onWinerySelect={handleWinerySelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Marker container includes both the label and the actual marker
  container: { 
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  // Label styling
  markerLabelContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    maxWidth: 120, // Limit width to prevent very long labels
  },
  markerLabel: {
    fontSize: Platform.OS === 'android' ? 10 : 9,
    fontWeight: 'bold',
    color: '#3E3E3E',
    textAlign: 'center',
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineryMarker: {
    backgroundColor: '#8C1C13',
    padding: Platform.OS === 'android' ? 8 : 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    // Make marker bigger on Android
    width: Platform.OS === 'android' ? 40 : 32,
    height: Platform.OS === 'android' ? 40 : 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButton: {
    position: 'absolute',
    bottom: 20,
    right: 15,
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
    bottom: 80,
    right: 15,
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
  // small circles around the marker
  statusContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? -6 : -4,
    right: Platform.OS === 'android' ? -6 : -4,
    flexDirection: 'row',
  },
  statusBadge: {
    width: Platform.OS === 'android' ? 12 : 10,
    height: Platform.OS === 'android' ? 12 : 10,
    borderRadius: Platform.OS === 'android' ? 6 : 5,
    borderWidth: 1,
    borderColor: '#fff',
    marginHorizontal: 1,
  },
  visited: { backgroundColor: '#4CAF50' },
  favorite: { backgroundColor: '#E91E63' },
  wantToVisit: { backgroundColor: '#2196F3' },
})