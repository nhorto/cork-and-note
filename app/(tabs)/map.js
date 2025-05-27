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
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

export default function MapScreen() {
  const router = useRouter();
  const webViewRef = useRef(null);

  if (Platform.OS === 'web') {
    return <WebMap wineries={wineries} router={router} />;
  }

  // For native platforms, you could implement a native map or show a message
  return (
    <View style={styles.container}>
      <Text>Map not available on this platform</Text>
    </View>
  );
}

// Web-specific map component
function WebMap({ wineries, router }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    // Only run on web
    if (typeof window === 'undefined') return;

    // Get Mapbox token from environment variable
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxToken) {
      console.error('Mapbox access token not found. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables.');
      return;
    }

    // Dynamically load Mapbox GL JS
    const loadMapbox = async () => {
      // Load CSS
      if (!document.querySelector('link[href*="mapbox-gl.css"]')) {
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }

      // Load JS
      if (!window.mapboxgl) {
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.js';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Initialize map
      window.mapboxgl.accessToken = mapboxToken;
      
      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-78.6569, 37.4316], // Virginia center
        zoom: 7
      });

      // Wait for map to load
      map.current.on('load', () => {
        addWineryMarkers();
        addClustering();
      });
    };

    const addWineryMarkers = () => {
      // Add wineries as a source
      map.current.addSource('wineries', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: wineries.map(winery => ({
            type: 'Feature',
            properties: {
              id: winery.id,
              name: winery.name,
              address: winery.address,
              website: winery.website
            },
            geometry: {
              type: 'Point',
              coordinates: [winery.longitude, winery.latitude]
            }
          }))
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });
    };

    const addClustering = () => {
      // Add cluster layer
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'wineries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#8C1C13',
            100,
            '#f1f075',
            750,
            '#f28cb1'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            100,
            30,
            750,
            40
          ]
        }
      });

      // Add cluster count labels
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'wineries',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Add unclustered points
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'wineries',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#8C1C13',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3E3E3E'
        }
      });

      // Add click events
      map.current.on('click', 'clusters', (e) => {
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        map.current.getSource('wineries').getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err) return;

            map.current.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom
            });
          }
        );
      });

      map.current.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;

        // Ensure popup appears on top of marker
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        // Create popup content
        const popupContent = `
          <div style="padding: 10px; max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #3E3E3E;">${properties.name}</h3>
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${properties.address}</p>
            <button 
              onclick="window.navigateToWinery(${properties.id})" 
              style="
                background: #8C1C13; 
                color: white; 
                border: none; 
                padding: 8px 12px; 
                border-radius: 4px; 
                cursor: pointer;
                font-size: 12px;
                width: 100%;
              "
            >
              View Details
            </button>
          </div>
        `;

        new window.mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map.current);
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'clusters', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'clusters', () => {
        map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'unclustered-point', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'unclustered-point', () => {
        map.current.getCanvas().style.cursor = '';
      });
    };

    // Set up global navigation function for popup buttons
    window.navigateToWinery = (wineryId) => {
      router.push(`/winery/${wineryId}`);
    };

    loadMapbox().catch(console.error);

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
      }
      // Clean up global function
      delete window.navigateToWinery;
    };
  }, [router]);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }} 
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E7E3E2',
  },
});