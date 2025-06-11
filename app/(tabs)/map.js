// import { useRouter } from 'expo-router';
// import { useEffect, useMemo, useRef, useState } from 'react';
// import { Text, View } from 'react-native';
// import MapView, { Marker } from 'react-native-maps';
// import Supercluster from 'supercluster';
// import wineries from '../../data/wineries_with_coordinates_and_id.json';

// export default function MapScreen() {
//   const router = useRouter();
//   const mapRef = useRef(null);
//   const [clusters, setClusters] = useState([]);
//   const [region, setRegion] = useState({
//     latitude: 37.4316, // Approximate center of Virginia
//     longitude: -78.6569,
//     latitudeDelta: 5,  // Wider delta to show the whole state
//     longitudeDelta: 5,
//   });
//    // Convert wineries to GeoJSON format for Supercluster - memoized to prevent recalculation
//   const points = useMemo(() => {
//     return wineries.map(winery => ({
//       type: 'Feature',
//       properties: { cluster: false, wineryId: winery.id, name: winery.name },
//       geometry: {
//         type: 'Point',
//         coordinates: [winery.longitude, winery.latitude]
//       }
//     }));
//   }, [wineries]);

//   // Create supercluster instance - memoized to prevent recreation
//   const supercluster = useMemo(() => {
//     const instance = new Supercluster({
//       radius: 40,
//       maxZoom: 16
//     });
//     instance.load(points);
//     return instance;
//   }, [points]);

//   // Update clusters when region changes, using a memoized function
//   const updateClusters = useMemo(() => {
//     return (newRegion) => {
//       // Get map bounds
//       const northEast = {
//         latitude: newRegion.latitude + newRegion.latitudeDelta/2,
//         longitude: newRegion.longitude + newRegion.longitudeDelta/2
//       };
//       const southWest = {
//         latitude: newRegion.latitude - newRegion.latitudeDelta/2,
//         longitude: newRegion.longitude - newRegion.longitudeDelta/2
//       };
//       const bounds = [
//         southWest.longitude, southWest.latitude, 
//         northEast.longitude, northEast.latitude
//       ];

//       const zoom = Math.log2(360 / newRegion.longitudeDelta) - 1;
//       const newClusters = supercluster.getClusters(bounds, Math.floor(zoom));
//       setClusters(newClusters);
//     };
//   }, [supercluster]);

//   // Update clusters when region changes
//   useEffect(() => {
//     updateClusters(region);
//   }, [region, updateClusters]);

//   // Use useLayoutEffect to measure and update before painting to prevent flickering
//   useEffect(() => {
//     // Only run once on mount to set initial clusters
//     updateClusters(region);
//   }, []);

//   const onRegionChangeComplete = (newRegion) => {
//     setRegion(newRegion);
//   };

//   // Memoize cluster rendering to prevent flickering
//   const renderCluster = useMemo(() => {
//     return (cluster) => {
//       const { cluster_id, point_count } = cluster.properties;
      
//       return (
//         <Marker
//           key={`cluster-${cluster_id}`}
//           coordinate={{
//             latitude: cluster.geometry.coordinates[1],
//             longitude: cluster.geometry.coordinates[0]
//           }}
//           onPress={() => {
//             // Zoom in on cluster when pressed
//             const children = supercluster.getLeaves(cluster_id, 100);
//             const childrenCoordinates = children.map(child => ({
//               latitude: child.geometry.coordinates[1],
//               longitude: child.geometry.coordinates[0]
//             }));
            
//             mapRef.current.fitToCoordinates(childrenCoordinates, {
//               edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//               animated: true
//             });
//           }}
//         >
//           <View style={{
//             width: 35,
//             height: 35,
//             borderRadius: 20, // Make sure this is half the width/height for a perfect circle
//             backgroundColor: '#8C1C13',
//             justifyContent: 'center',
//             alignItems: 'center',
//             borderWidth: 2,
//             borderColor: '#3E3E3E', // Add a border to make it more visible
//             // Add a shadow for better visibility
//             shadowColor: '#000',
//             shadowOffset: { width: 0, height: 1 },
//             shadowOpacity: 0.3,
//             shadowRadius: 1,
//             elevation: 5 // For Android
//           }}>
//             <Text style={{ 
//               color: '#fff', 
//               fontWeight: 'bold',
//               fontSize: 14,
//               textAlign: 'center'
//             }}>
//               {point_count}
//             </Text>
//           </View>
//         </Marker>
//       );
//     };
//   }, [supercluster]);

//   // Memoize marker rendering to prevent flickering
//   const renderMarker = useMemo(() => {
//     return (cluster) => {
//       return (
//         <Marker
//           key={cluster.properties.wineryId}
//           coordinate={{
//             latitude: cluster.geometry.coordinates[1],
//             longitude: cluster.geometry.coordinates[0]
//           }}
//           title={cluster.properties.name}
//           onPress={() => router.push(`/winery/${cluster.properties.wineryId}`)}
//         />
//       );
//     };
//   }, [router]);

//   return (
//     <MapView
//       ref={mapRef}
//       style={{ flex: 1 }}
//       region={region}
//       onRegionChangeComplete={onRegionChangeComplete}
//     >
//       {clusters.map(cluster => {
//         // Render a cluster marker if a cluster
//         if (cluster.properties.cluster) {
//           return renderCluster(cluster);
//         }
        
//         // Render a single marker if not
//         return renderMarker(cluster);
//       })}
//     </MapView>
//   );
// }

// uncomment this to get it just have a placeholder screen
// import { StyleSheet, Text, View } from 'react-native';

// export default function map() {
//   return (
//     <View style={{ flex: 1 }}>
//       <Text>This is a placeholder until i can get the map to work</Text>
//     </View>
//   );
// }

// TESET TO SEE IF I CAN GET THE MAP TO WORK AS A WEBAPP!!
// app/(tabs)/map.js
// import { useRouter } from 'expo-router';
// import { useEffect, useRef } from 'react';
// import { View, Text, Platform, StyleSheet } from 'react-native';
// import wineries from '../../data/wineries_with_coordinates_and_id.json';

// export default function MapScreen() {
//   const router = useRouter();
//   const webViewRef = useRef(null);

//   if (Platform.OS === 'web') {
//     return <WebMap wineries={wineries} router={router} />;
//   }

//   // For native platforms, you could implement a native map or show a message
//   return (
//     <View style={styles.container}>
//       <Text>Map not available on this platform</Text>
//     </View>
//   );
// }

// // Web-specific map component
// function WebMap({ wineries, router }) {
//   const mapContainer = useRef(null);
//   const map = useRef(null);

//   useEffect(() => {
//     // Only run on web
//     if (typeof window === 'undefined') return;

//     // Get Mapbox token from environment variable
//     const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
//     if (!mapboxToken) {
//       console.error('Mapbox access token not found. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables.');
//       return;
//     }

//     // Dynamically load Mapbox GL JS
//     const loadMapbox = async () => {
//       // Load CSS
//       if (!document.querySelector('link[href*="mapbox-gl.css"]')) {
//         const link = document.createElement('link');
//         link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.css';
//         link.rel = 'stylesheet';
//         document.head.appendChild(link);
//       }

//       // Load JS
//       if (!window.mapboxgl) {
//         const script = document.createElement('script');
//         script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.js';
//         document.head.appendChild(script);
        
//         await new Promise((resolve) => {
//           script.onload = resolve;
//         });
//       }

//       // Initialize map
//       window.mapboxgl.accessToken = mapboxToken;
      
//       map.current = new window.mapboxgl.Map({
//         container: mapContainer.current,
//         style: 'mapbox://styles/mapbox/streets-v11',
//         center: [-78.6569, 37.4316], // Virginia center
//         zoom: 7
//       });

//       // Wait for map to load
//       map.current.on('load', () => {
//         addWineryMarkers();
//         addClustering();
//       });
//     };

//     const addWineryMarkers = () => {
//       // Add wineries as a source
//       map.current.addSource('wineries', {
//         type: 'geojson',
//         data: {
//           type: 'FeatureCollection',
//           features: wineries.map(winery => ({
//             type: 'Feature',
//             properties: {
//               id: winery.id,
//               name: winery.name,
//               address: winery.address,
//               website: winery.website
//             },
//             geometry: {
//               type: 'Point',
//               coordinates: [winery.longitude, winery.latitude]
//             }
//           }))
//         },
//         cluster: true,
//         clusterMaxZoom: 14,
//         clusterRadius: 50
//       });
//     };

//     const addClustering = () => {
//       // Add cluster layer
//       map.current.addLayer({
//         id: 'clusters',
//         type: 'circle',
//         source: 'wineries',
//         filter: ['has', 'point_count'],
//         paint: {
//           'circle-color': [
//             'step',
//             ['get', 'point_count'],
//             '#8C1C13',
//             100,
//             '#f1f075',
//             750,
//             '#f28cb1'
//           ],
//           'circle-radius': [
//             'step',
//             ['get', 'point_count'],
//             20,
//             100,
//             30,
//             750,
//             40
//           ]
//         }
//       });

//       // Add cluster count labels
//       map.current.addLayer({
//         id: 'cluster-count',
//         type: 'symbol',
//         source: 'wineries',
//         filter: ['has', 'point_count'],
//         layout: {
//           'text-field': '{point_count_abbreviated}',
//           'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
//           'text-size': 12
//         },
//         paint: {
//           'text-color': '#ffffff'
//         }
//       });

//       // Add unclustered points
//       map.current.addLayer({
//         id: 'unclustered-point',
//         type: 'circle',
//         source: 'wineries',
//         filter: ['!', ['has', 'point_count']],
//         paint: {
//           'circle-color': '#8C1C13',
//           'circle-radius': 8,
//           'circle-stroke-width': 2,
//           'circle-stroke-color': '#3E3E3E'
//         }
//       });

//       // Add click events
//       map.current.on('click', 'clusters', (e) => {
//         const features = map.current.queryRenderedFeatures(e.point, {
//           layers: ['clusters']
//         });
//         const clusterId = features[0].properties.cluster_id;
//         map.current.getSource('wineries').getClusterExpansionZoom(
//           clusterId,
//           (err, zoom) => {
//             if (err) return;

//             map.current.easeTo({
//               center: features[0].geometry.coordinates,
//               zoom: zoom
//             });
//           }
//         );
//       });

//       map.current.on('click', 'unclustered-point', (e) => {
//         const coordinates = e.features[0].geometry.coordinates.slice();
//         const properties = e.features[0].properties;

//         // Ensure popup appears on top of marker
//         while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
//           coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
//         }

//         // Create popup content
//         const popupContent = `
//           <div style="padding: 10px; max-width: 200px;">
//             <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #3E3E3E;">${properties.name}</h3>
//             <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${properties.address}</p>
//             <button 
//               onclick="window.navigateToWinery(${properties.id})" 
//               style="
//                 background: #8C1C13; 
//                 color: white; 
//                 border: none; 
//                 padding: 8px 12px; 
//                 border-radius: 4px; 
//                 cursor: pointer;
//                 font-size: 12px;
//                 width: 100%;
//               "
//             >
//               View Details
//             </button>
//           </div>
//         `;

//         new window.mapboxgl.Popup()
//           .setLngLat(coordinates)
//           .setHTML(popupContent)
//           .addTo(map.current);
//       });

//       // Change cursor on hover
//       map.current.on('mouseenter', 'clusters', () => {
//         map.current.getCanvas().style.cursor = 'pointer';
//       });
//       map.current.on('mouseleave', 'clusters', () => {
//         map.current.getCanvas().style.cursor = '';
//       });
//       map.current.on('mouseenter', 'unclustered-point', () => {
//         map.current.getCanvas().style.cursor = 'pointer';
//       });
//       map.current.on('mouseleave', 'unclustered-point', () => {
//         map.current.getCanvas().style.cursor = '';
//       });
//     };

//     // Set up global navigation function for popup buttons
//     window.navigateToWinery = (wineryId) => {
//       router.push(`/winery/${wineryId}`);
//     };

//     loadMapbox().catch(console.error);

//     // Cleanup
//     return () => {
//       if (map.current) {
//         map.current.remove();
//       }
//       // Clean up global function
//       delete window.navigateToWinery;
//     };
//   }, [router]);

//   return (
//     <div 
//       ref={mapContainer} 
//       style={{ 
//         width: '100%', 
//         height: '100%',
//         position: 'absolute',
//         top: 0,
//         left: 0,
//         right: 0,
//         bottom: 0
//       }} 
//     />
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#E7E3E2',
//   },
// });

// THIS WAS THE OG MAP THAT I MOVED HERE TO GET THE TABS TO LOOK RIGHT IN THE APP

// app/(tabs)/OGmap.js
// app/(tabs)/OGmap.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import WinerySearchModal from '../../components/WinerySearchModal';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import { wineryStatusService } from '../../lib/wineryStatus';
import { AuthContext } from '../_layout';

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