// app/(tabs)/map.js - France/Bordeaux Trip Version
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import ManualWineryEntryModal from '../../components/ManualWineryEntryModal';
import PinActionModal from '../../components/PinActionModal';
import WineryNameModal from '../../components/WineryNameModal';
import { wineriesService } from '../../lib/wineries';
import { wishlistService } from '../../lib/wishlist';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  // Region state - centered on Bordeaux, France
  const [region, setRegion] = useState({
    latitude: 44.8378,   // Bordeaux latitude
    longitude: -0.5792,  // Bordeaux longitude
    latitudeDelta: 1.5,
    longitudeDelta: 1.5,
  });

  // User location
  const [userLocation, setUserLocation] = useState(null);

  // User's wineries (from visits + wishlist)
  const [userPins, setUserPins] = useState([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);

  // Temporary pin state (for dropping new pins)
  const [tempPin, setTempPin] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);

  // Pin action modal state
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPinActions, setShowPinActions] = useState(false);

  // FAB menu state
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Manual entry modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'visit' or 'wishlist'

  // Load user's wineries on mount
  useEffect(() => {
    loadUserPins();
  }, []);

  const loadUserPins = async () => {
    try {
      const { success, wineries } = await wineriesService.getUserWineries();
      if (success) {
        setUserPins(wineries);
      }
    } catch (error) {
      console.error('Error loading user pins:', error);
    } finally {
      setPinsLoaded(true);
    }
  };

  // Request and set user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  // Zoom to user's location
  const zoomToUserLocation = async () => {
    if (!userLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required.');
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

  // Handle long press on map to drop a pin
  const handleMapLongPress = useCallback((event) => {
    const { coordinate } = event.nativeEvent;
    setTempPin(coordinate);
    setShowNameModal(true);
  }, []);

  // Drop pin at current GPS location
  const dropPinAtMyLocation = async () => {
    setShowFabMenu(false);

    if (userLocation) {
      setTempPin(userLocation);
      setShowNameModal(true);
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to drop a pin.');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const coordinate = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
        setUserLocation(coordinate);
        setTempPin(coordinate);
        setShowNameModal(true);
      } catch (error) {
        Alert.alert('Location Error', 'Unable to get your current location.');
      }
    }
  };

  // Save a new pin (create winery in Supabase)
  const handleSavePin = async (name, coordinate) => {
    const { success, winery, error } = await wineriesService.createWinery({
      name,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    });

    if (success && winery) {
      setUserPins(prev => [...prev, winery]);
      setTempPin(null);

      // Zoom to the new pin
      mapRef.current?.animateToRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }, 500);
    } else {
      Alert.alert('Error', error || 'Failed to save pin. Please try again.');
    }
  };

  // Handle tap on existing pin
  const handlePinPress = useCallback((pin) => {
    setSelectedPin(pin);
    setShowPinActions(true);
  }, []);

  // Pin action handlers
  const handleLogVisit = () => {
    setShowPinActions(false);
    if (selectedPin) {
      router.push(`/winery/${selectedPin.id}`);
    }
  };

  const handleAddPinToWishlist = async () => {
    if (!selectedPin) return;

    const { success, error } = await wishlistService.addToWishlist(selectedPin.id);
    setShowPinActions(false);

    if (success) {
      Alert.alert('Added', `${selectedPin.name} has been added to your wishlist.`);
      // Update the pin to show it's in wishlist
      setUserPins(prev => prev.map(p =>
        p.id === selectedPin.id ? { ...p, inWishlist: true } : p
      ));
    } else if (error?.includes('already')) {
      Alert.alert('Already Added', `${selectedPin.name} is already in your wishlist.`);
    } else {
      Alert.alert('Error', 'Failed to add to wishlist.');
    }
  };

  const handleRemovePin = async () => {
    if (!selectedPin) return;

    const { success, error } = await wineriesService.deleteWinery(selectedPin.id);
    setShowPinActions(false);

    if (success) {
      setUserPins(prev => prev.filter(p => p.id !== selectedPin.id));
    } else {
      Alert.alert('Cannot Remove', error || 'Failed to remove pin.');
    }
  };

  // Manual entry handlers (from FAB menu)
  const handleManualEntry = async (wineryData, actionType) => {
    // First create the winery
    const { success, winery, error } = await wineriesService.createWinery(wineryData);

    if (!success || !winery) {
      Alert.alert('Error', error || 'Failed to create winery.');
      return;
    }

    // Add to user pins
    setUserPins(prev => [...prev, winery]);

    if (actionType === 'visit') {
      // Navigate to winery page to log visit
      router.push(`/winery/${winery.id}`);
    } else if (actionType === 'wishlist') {
      // Add to wishlist
      const { success: wishlistSuccess } = await wishlistService.addToWishlist(winery.id);
      if (wishlistSuccess) {
        Alert.alert('Added', `${winery.name} has been added to your wishlist.`);
        setUserPins(prev => prev.map(p =>
          p.id === winery.id ? { ...p, inWishlist: true } : p
        ));
      }
    }
  };

  const onRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
  };

  // Get marker color based on pin status
  const getMarkerColor = (pin) => {
    if (pin.hasVisit) return '#4CAF50'; // Green for visited
    if (pin.inWishlist) return '#2196F3'; // Blue for wishlist
    return '#8C1C13'; // Default wine color
  };

  // Render a winery pin marker
  const renderPinMarker = (pin) => {
    // Android: Use simple marker with callout (more reliable)
    if (Platform.OS === 'android') {
      return (
        <Marker
          key={pin.id}
          coordinate={{
            latitude: pin.latitude,
            longitude: pin.longitude
          }}
          pinColor={getMarkerColor(pin)}
          onPress={() => handlePinPress(pin)}
        >
          <Callout tooltip={false}>
            <View style={styles.androidCallout}>
              <Text style={styles.androidCalloutTitle}>{pin.name}</Text>
              <Text style={styles.androidCalloutSubtitle}>Tap marker for options</Text>
            </View>
          </Callout>
        </Marker>
      );
    }

    // iOS: Use custom marker view (works well on iOS)
    return (
      <Marker
        key={pin.id}
        coordinate={{
          latitude: pin.latitude,
          longitude: pin.longitude
        }}
        tracksViewChanges={false}
        onPress={() => handlePinPress(pin)}
      >
        <View style={styles.markerContainer}>
          {/* Winery name label */}
          <View style={styles.markerLabelContainer}>
            <Text style={styles.markerLabel} numberOfLines={1}>
              {pin.name}
            </Text>
          </View>

          {/* Pin icon */}
          <View style={[
            styles.wineryMarker,
            pin.hasVisit && styles.visitedMarker,
            pin.inWishlist && !pin.hasVisit && styles.wishlistMarker
          ]}>
            <Ionicons
              name="wine"
              size={16}
              color="#FFFFFF"
            />
          </View>
        </View>
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={handleMapLongPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Render user's pins */}
        {userPins.map(pin => renderPinMarker(pin))}

        {/* Render temporary pin while naming */}
        {tempPin && (
          <Marker
            coordinate={tempPin}
            pinColor="#8C1C13"
          />
        )}
      </MapView>

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setShowFabMenu(!showFabMenu)}
      >
        <Ionicons
          name={showFabMenu ? "close" : "add"}
          size={28}
          color="#fff"
        />
      </TouchableOpacity>

      {/* FAB Menu */}
      {showFabMenu && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setShowFabMenu(false);
              setPendingAction('visit');
              setShowManualModal(true);
            }}
          >
            <Ionicons name="wine" size={20} color="#8C1C13" />
            <Text style={styles.fabMenuText}>Log Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setShowFabMenu(false);
              setPendingAction('wishlist');
              setShowManualModal(true);
            }}
          >
            <Ionicons name="bookmark" size={20} color="#8C1C13" />
            <Text style={styles.fabMenuText}>Add to Wishlist</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={dropPinAtMyLocation}
          >
            <Ionicons name="location" size={20} color="#8C1C13" />
            <Text style={styles.fabMenuText}>Drop Pin Here</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location Button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={zoomToUserLocation}
      >
        <Ionicons name="locate" size={24} color="#8C1C13" />
      </TouchableOpacity>

      {/* Hint text for first-time users */}
      {pinsLoaded && userPins.length === 0 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Long-press on the map to drop a pin, or tap + to get started
          </Text>
        </View>
      )}

      {/* Pin Name Modal */}
      <WineryNameModal
        visible={showNameModal}
        coordinate={tempPin}
        onClose={() => {
          setShowNameModal(false);
          setTempPin(null);
        }}
        onSave={handleSavePin}
      />

      {/* Pin Action Modal */}
      <PinActionModal
        visible={showPinActions}
        winery={selectedPin}
        onClose={() => {
          setShowPinActions(false);
          setSelectedPin(null);
        }}
        onLogVisit={handleLogVisit}
        onAddToWishlist={handleAddPinToWishlist}
        onRemovePin={handleRemovePin}
        onViewDetails={handleLogVisit}
      />

      {/* Manual Entry Modal */}
      <ManualWineryEntryModal
        visible={showManualModal}
        actionType={pendingAction}
        onClose={() => {
          setShowManualModal(false);
          setPendingAction(null);
        }}
        onSave={handleManualEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerLabelContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  markerLabel: {
    fontSize: Platform.OS === 'android' ? 11 : 10,
    fontWeight: '600',
    color: '#3E3E3E',
    textAlign: 'center',
  },
  wineryMarker: {
    backgroundColor: '#8C1C13',
    padding: Platform.OS === 'android' ? 8 : 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    width: Platform.OS === 'android' ? 40 : 32,
    height: Platform.OS === 'android' ? 40 : 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  visitedMarker: {
    backgroundColor: '#4CAF50', // Green for visited
  },
  wishlistMarker: {
    backgroundColor: '#2196F3', // Blue for wishlist
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    backgroundColor: '#8C1C13',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 90,
    left: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    minWidth: 160,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  fabMenuText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#3E3E3E',
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
  hintContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(140, 28, 19, 0.9)',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Android callout styles
  androidCallout: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
    maxWidth: 200,
  },
  androidCalloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  androidCalloutSubtitle: {
    fontSize: 11,
    color: '#888',
  },
});
