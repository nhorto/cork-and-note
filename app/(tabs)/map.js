// app/(tabs)/map.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import Supercluster from 'supercluster';

import WinerySearchModal from '../../components/WinerySearchModal';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import { wineryStatusService } from '../../lib/wineryStatus';
import { AuthContext } from '../_layout';

export default function OGMap() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [region, setRegion] = useState({
    latitude: 37.4316, // Approximate center of Virginia
    longitude: -78.6569,
    latitudeDelta: 5,  // Wider delta to show the whole state
    longitudeDelta: 5,
  });
  const [clusters, setClusters] = useState([]);

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

  // Convert wineries to GeoJSON format for Supercluster
  const points = useMemo(() => {
    const dataToUse = statusLoaded ? wineriesWithStatus : wineries;
    return dataToUse.map(winery => ({
      type: 'Feature',
      properties: { 
        cluster: false, 
        wineryId: winery.id, 
        name: winery.name,
        address: winery.address,
        status: winery.status,
      },
      geometry: {
        type: 'Point',
        coordinates: [winery.longitude, winery.latitude]
      }
    }));
  }, [wineriesWithStatus, statusLoaded]);

  // Create supercluster instance
  const supercluster = useMemo(() => {
    const instance = new Supercluster({
      radius: 40,
      maxZoom: 16
    });
    instance.load(points);
    return instance;
  }, [points]);

  // Update clusters when region changes
  useEffect(() => {
    if (!supercluster) return;
    
    // Calculate bounds from the current region
    const northEast = {
      latitude: region.latitude + region.latitudeDelta/2,
      longitude: region.longitude + region.longitudeDelta/2
    };
    const southWest = {
      latitude: region.latitude - region.latitudeDelta/2,
      longitude: region.longitude - region.longitudeDelta/2
    };
    const bounds = [
      southWest.longitude, southWest.latitude, 
      northEast.longitude, northEast.latitude
    ];

    // Calculate appropriate zoom level
    const zoom = Math.log2(360 / region.longitudeDelta) - 1;
    
    // Get clusters
    const newClusters = supercluster.getClusters(bounds, Math.floor(zoom));
    setClusters(newClusters);
  }, [region, supercluster]);

  const onRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
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

  // Render a cluster
  const renderCluster = (cluster) => {
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
        <View style={styles.clusterMarker}>
          <Text style={styles.clusterText}>{point_count}</Text>
        </View>
      </Marker>
    );
  };

  // Render an individual winery marker
  const renderWineryMarker = (feature) => {
    const winery = feature.properties;
    
    return (
      <Marker
        key={winery.wineryId}
        coordinate={{
          latitude: feature.geometry.coordinates[1],
          longitude: feature.geometry.coordinates[0]
        }}
        tracksViewChanges={false}
        onPress={() => router.push(`/winery/${winery.wineryId}`)}
      >
        <View style={styles.markerContainer}>
          {/* Winery name label above marker */}
          <View style={styles.markerLabelContainer}>
            <Text style={styles.markerLabel} numberOfLines={1}>
              {winery.name}
            </Text>
          </View>
          
          <View style={styles.markerWrapper}>
            <View style={styles.wineryMarker}>
              <Ionicons 
                name="wine" 
                size={Platform.OS === 'android' ? 22 : 16} 
                color="#FFFFFF" 
              />
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
        </View>

        {/* This callout will only show when marker is tapped */}
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
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Wineries</Text>
        <TouchableOpacity 
          style={styles.searchButtonHeader}
          onPress={() => setShowSearchModal(true)}
        >
          <Ionicons name="search" size={22} color="#8C1C13" />
        </TouchableOpacity>
      </View>
      
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        maxZoomLevel={19}
        minZoomLevel={5}
        rotateEnabled={false}
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {clusters.map(cluster => {
          // Render a cluster marker if it's a cluster
          if (cluster.properties.cluster) {
            return renderCluster(cluster);
          }
          
          // Render a single marker if not a cluster
          return renderWineryMarker(cluster);
        })}
      </MapView>

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
        wineries={statusLoaded ? wineriesWithStatus : wineries}
        onWinerySelect={handleWinerySelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E7E3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingTop: Platform.OS === 'ios' ? 45 : 15, // Adjusted down a bit
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  searchButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  map: { 
    flex: 1,
  },
  // Marker container includes both the label and the actual marker
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
  // Cluster marker styling to match winery markers
  clusterMarker: {
    backgroundColor: '#8C1C13',
    width: Platform.OS === 'android' ? 48 : 40,
    height: Platform.OS === 'android' ? 48 : 40,
    borderRadius: Platform.OS === 'android' ? 24 : 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  clusterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: Platform.OS === 'android' ? 18 : 16,
    textAlign: 'center',
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

  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    width: 200, // Slightly wider for Android
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