import React, { useState, useRef, useEffect, useMemo } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import Supercluster from 'supercluster';
import { Text, View, Dimensions } from 'react-native';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

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
   // Convert wineries to GeoJSON format for Supercluster - memoized to prevent recalculation
  const points = useMemo(() => {
    return wineries.map(winery => ({
      type: 'Feature',
      properties: { cluster: false, wineryId: winery.id, name: winery.name },
      geometry: {
        type: 'Point',
        coordinates: [winery.longitude, winery.latitude]
      }
    }));
  }, [wineries]);

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

  // Use useLayoutEffect to measure and update before painting to prevent flickering
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
            width: 40,
            height: 40,
            borderRadius: 20, // Make sure this is half the width/height for a perfect circle
            backgroundColor: '#8E2DE2',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#fff', // Add a border to make it more visible
            // Add a shadow for better visibility
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 5 // For Android
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
      return (
        <Marker
          key={cluster.properties.wineryId}
          coordinate={{
            latitude: cluster.geometry.coordinates[1],
            longitude: cluster.geometry.coordinates[0]
          }}
          title={cluster.properties.name}
          onPress={() => router.push(`/winery/${cluster.properties.wineryId}`)}
        />
      );
    };
  }, [router]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
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
  );
}