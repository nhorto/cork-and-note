import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WinerySearchModal from '../../components/WinerySearchModal';
import wineries from '../../data/wineries_with_coordinates_and_id.json';

// Hardcoded demo data - these wineries will show status badges for portfolio demo
const DEMO_WINERY_STATUS = {
  18: { visited: true, isFavorite: true, isWantToVisit: false },   // Barboursville Vineyards
  146: { visited: true, isFavorite: false, isWantToVisit: false },  // King Family Vineyards
  25: { visited: false, isFavorite: true, isWantToVisit: false },   // Blenheim Vineyards
  88: { visited: false, isFavorite: false, isWantToVisit: true },   // Early Mountain Vineyards
  278: { visited: true, isFavorite: false, isWantToVisit: false },  // Veritas Vineyards
  198: { visited: false, isFavorite: true, isWantToVisit: false },  // Pippin Hill Farm & Vineyards
  144: { visited: false, isFavorite: false, isWantToVisit: true },  // Keswick Vineyards
  36: { visited: true, isFavorite: false, isWantToVisit: true },    // Breaux Vineyards
  268: { visited: true, isFavorite: false, isWantToVisit: false },  // Trump Winery
  68: { visited: false, isFavorite: true, isWantToVisit: true },    // Chrysalis Vineyards
};

export default function MapScreen() {
  const router = useRouter();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Add status to wineries for demo
  const wineriesWithStatus = useMemo(() => {
    return wineries.map(winery => ({
      ...winery,
      status: DEMO_WINERY_STATUS[winery.id] || { visited: false, isFavorite: false, isWantToVisit: false }
    }));
  }, []);

  useEffect(() => {
    // Only run on web
    if (typeof window === 'undefined') return;

    // Get Mapbox token from environment variable
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      console.error('Mapbox access token not found. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables.');
      return;
    }

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
        setMapLoaded(true);
      });
    };

    const addWineryMarkers = () => {
      wineriesWithStatus.forEach(winery => {
        // Create marker element
        const markerEl = createMarkerElement(winery);

        // Create marker
        const marker = new window.mapboxgl.Marker({ element: markerEl })
          .setLngLat([winery.longitude, winery.latitude])
          .addTo(map.current);

        markers.current[winery.id] = marker;

        // Add click handler to navigate to winery detail
        markerEl.addEventListener('click', () => {
          router.push(`/winery/${winery.id}`);
        });
      });
    };

    const createMarkerElement = (winery) => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cursor = 'pointer';

      const status = winery.status || { visited: false, isFavorite: false, isWantToVisit: false };

      // Create status badges HTML
      let statusBadges = '';
      if (status.visited) {
        statusBadges += '<div class="status-badge visited"></div>';
      }
      if (status.isFavorite) {
        statusBadges += '<div class="status-badge favorite"></div>';
      }
      if (status.isWantToVisit) {
        statusBadges += '<div class="status-badge want-to-visit"></div>';
      }

      el.innerHTML = `
        <div class="marker-container">
          <div class="marker-label-container">
            <div class="marker-label">${winery.name}</div>
          </div>
          <div class="marker-wrapper">
            <div class="winery-marker">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M10.657 19.333c-.872 0-1.599-.179-2.182-.537-.583-.358-1.013-.862-1.29-1.512l-.006.001c-.277-.65-.415-1.417-.415-2.301V9.667c0-.383-.033-.717-.1-1.001C6.582 8.366 6.448 8.15 6.247 8c.2-.15.335-.366.416-.65.083-.284.116-.618.116-1.001V5H5.333V3.667h10V5H14v1.333c0 .383.033.717.1 1.001.083.284.217.5.418.65-.2.15-.335.366-.418.65-.067.284-.1.618-.1 1.001v5.333c0 .883-.138 1.65-.415 2.3-.277.65-.707 1.154-1.29 1.513-.583.358-1.31.537-2.182.537h-.656zm1-6.583l.333 1.667c0 .483.067.883.2 1.2.133.317.333.55.6.7.267.15.583.225.95.225h.317c.367 0 .683-.075.95-.225.267-.15.467-.383.6-.7.133-.317.2-.717.2-1.2V9.917L14.74 8.25c-.183-.917-.35-1.75-.5-2.5-.15-.75-.25-1.333-.3-1.75h-2.88c-.05.417-.15 1-.3 1.75-.15.75-.317 1.583-.5 2.5l-1.077 4.5z"/>
              </svg>
            </div>
            ${statusBadges ? `<div class="status-container">${statusBadges}</div>` : ''}
          </div>
        </div>
      `;

      return el;
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
  }, [router, wineriesWithStatus]);

  // Handle winery select from search
  const handleWinerySelect = (winery) => {
    if (map.current) {
      map.current.flyTo({
        center: [winery.longitude, winery.latitude],
        zoom: 14,
        duration: 1000
      });
    }
  };

  return (
    <View style={styles.container}>
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

      {/* Add custom styles for markers */}
      <style jsx>{`
        .custom-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-label-container {
          background-color: rgba(255, 255, 255, 0.85);
          padding: 2px 6px;
          border-radius: 10px;
          margin-bottom: 4px;
          border: 1px solid #ccc;
          max-width: 120px;
        }

        .marker-label {
          font-size: 9px;
          font-weight: bold;
          color: #3E3E3E;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .marker-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .winery-marker {
          background-color: #8C1C13;
          padding: 6px;
          border-radius: 50%;
          border: 2px solid #FFFFFF;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .status-container {
          position: absolute;
          top: -4px;
          right: -4px;
          display: flex;
          flex-direction: row;
        }

        .status-badge {
          width: 10px;
          height: 10px;
          border-radius: 5px;
          border: 1px solid #fff;
          margin-left: 1px;
        }

        .status-badge.visited {
          background-color: #4CAF50;
        }

        .status-badge.favorite {
          background-color: #E91E63;
        }

        .status-badge.want-to-visit {
          background-color: #2196F3;
        }
      `}</style>

      {/* Search Button */}
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => setShowSearchModal(true)}
      >
        <Ionicons name="search" size={24} color="#8C1C13" />
      </TouchableOpacity>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Status</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.visited]} />
          <Text style={styles.legendText}>Visited</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.favorite]} />
          <Text style={styles.legendText}>Favorite</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.wantToVisit]} />
          <Text style={styles.legendText}>Want to Visit</Text>
        </View>
      </View>

      {/* Search Modal */}
      <WinerySearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        wineries={wineriesWithStatus}
        onWinerySelect={handleWinerySelect}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchButton: {
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
  // Legend styles
  legendContainer: {
    position: 'absolute',
    top: 50,
    left: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    minWidth: 120,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  legendText: {
    fontSize: 11,
    color: '#333',
  },
  visited: { backgroundColor: '#4CAF50' },
  favorite: { backgroundColor: '#E91E63' },
  wantToVisit: { backgroundColor: '#2196F3' },
});