// app/(tabs)/map.js - France/Bordeaux Trip Version
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import ManualWineryEntryModal from '../../components/ManualWineryEntryModal';
import PinActionModal from '../../components/PinActionModal';
import WineryNameModal from '../../components/WineryNameModal';
import { wineriesService } from '../../lib/wineries';
import { wishlistService } from '../../lib/wishlist';
import theme from '../../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  // Region state - centered on Bordeaux, France
  const [region, setRegion] = useState({
    latitude: 44.8378,
    longitude: -0.5792,
    latitudeDelta: 1.5,
    longitudeDelta: 1.5,
  });

  const [userLocation, setUserLocation] = useState(null);
  const [userPins, setUserPins] = useState([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [tempPin, setTempPin] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPinActions, setShowPinActions] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

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

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

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

  const handleMapLongPress = useCallback((event) => {
    const { coordinate } = event.nativeEvent;
    setTempPin(coordinate);
    setShowNameModal(true);
  }, []);

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

  const handleSavePin = async (name, coordinate) => {
    const { success, winery, error } = await wineriesService.createWinery({
      name,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    });

    if (success && winery) {
      setUserPins(prev => [...prev, winery]);
      setTempPin(null);

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

  const handlePinPress = useCallback((pin) => {
    setSelectedPin(pin);
    setShowPinActions(true);
  }, []);

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

  const handleManualEntry = async (wineryData, actionType) => {
    const { success, winery, error } = await wineriesService.createWinery(wineryData);

    if (!success || !winery) {
      Alert.alert('Error', error || 'Failed to create winery.');
      return;
    }

    setUserPins(prev => [...prev, winery]);

    if (actionType === 'visit') {
      router.push(`/winery/${winery.id}`);
    } else if (actionType === 'wishlist') {
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

  const getMarkerColor = (pin) => {
    if (pin.hasVisit) return colors.status.visited;
    if (pin.inWishlist) return colors.status.wishlist;
    return colors.primary.burgundy;
  };

  const renderPinMarker = (pin) => {
    if (Platform.OS === 'android') {
      return (
        <Marker
          key={pin.id}
          coordinate={{
            latitude: pin.latitude,
            longitude: pin.longitude
          }}
          pinColor={getMarkerColor(pin)}
          title={pin.name}
          description="Tap for options"
          onPress={() => handlePinPress(pin)}
        />
      );
    }

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
          <View style={styles.markerLabelContainer}>
            <Text style={styles.markerLabel} numberOfLines={1}>
              {pin.name}
            </Text>
          </View>
          <View style={[
            styles.wineryMarker,
            pin.hasVisit && styles.visitedMarker,
            pin.inWishlist && !pin.hasVisit && styles.wishlistMarker
          ]}>
            <Ionicons name="wine" size={16} color={colors.neutral.cream} />
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
        {userPins.map(pin => renderPinMarker(pin))}

        {tempPin && (
          <Marker
            coordinate={tempPin}
            pinColor={colors.primary.burgundy}
          />
        )}
      </MapView>

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setShowFabMenu(!showFabMenu)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={showFabMenu ? "close" : "add"}
          size={28}
          color={colors.neutral.cream}
        />
      </TouchableOpacity>

      {/* FAB Menu */}
      {showFabMenu && (
        <View style={styles.fabMenu}>
          <View style={styles.fabMenuHeader}>
            <Text style={styles.fabMenuTitle}>Quick Actions</Text>
          </View>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setShowFabMenu(false);
              setPendingAction('visit');
              setShowManualModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: colors.primary.burgundy }]}>
              <Ionicons name="wine" size={18} color={colors.neutral.cream} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Log Visit</Text>
              <Text style={styles.fabMenuSubtext}>Record a new winery visit</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setShowFabMenu(false);
              setPendingAction('wishlist');
              setShowManualModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: colors.status.wishlist }]}>
              <Ionicons name="bookmark" size={18} color={colors.neutral.cream} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Add to Wishlist</Text>
              <Text style={styles.fabMenuSubtext}>Save for later</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fabMenuDivider} />

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={dropPinAtMyLocation}
            activeOpacity={0.7}
          >
            <View style={[styles.fabMenuIcon, { backgroundColor: colors.status.visited }]}>
              <Ionicons name="location" size={18} color={colors.neutral.cream} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Drop Pin Here</Text>
              <Text style={styles.fabMenuSubtext}>Mark your current location</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Location Button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={zoomToUserLocation}
        activeOpacity={0.7}
      >
        <Ionicons name="locate" size={22} color={colors.primary.burgundy} />
      </TouchableOpacity>

      {/* Hint text for first-time users */}
      {pinsLoaded && userPins.length === 0 && (
        <View style={styles.hintContainer}>
          <View style={styles.hintIcon}>
            <Ionicons name="wine-outline" size={20} color={colors.neutral.cream} />
          </View>
          <View style={styles.hintContent}>
            <Text style={styles.hintTitle}>Welcome to Bordeaux</Text>
            <Text style={styles.hintText}>
              Long-press on the map to drop a pin, or tap + to get started
            </Text>
          </View>
        </View>
      )}

      {/* Modals */}
      <WineryNameModal
        visible={showNameModal}
        coordinate={tempPin}
        onClose={() => {
          setShowNameModal(false);
          setTempPin(null);
        }}
        onSave={handleSavePin}
      />

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

  // Marker Styles
  markerContainer: {
    alignItems: 'center',
  },
  markerLabelContainer: {
    backgroundColor: colors.neutral.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    maxWidth: 140,
    ...shadows.soft,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  wineryMarker: {
    backgroundColor: colors.primary.burgundy,
    padding: 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.neutral.cream,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  visitedMarker: {
    backgroundColor: colors.status.visited,
  },
  wishlistMarker: {
    backgroundColor: colors.status.wishlist,
  },

  // FAB Button
  fabButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    backgroundColor: colors.primary.burgundy,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold.muted,
    ...shadows.medium,
  },

  // FAB Menu
  fabMenu: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    minWidth: 220,
    ...shadows.strong,
  },
  fabMenuHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
    marginBottom: spacing.xs,
  },
  fabMenuTitle: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  fabMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  fabMenuContent: {
    flex: 1,
  },
  fabMenuText: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
  },
  fabMenuSubtext: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },
  fabMenuDivider: {
    height: 1,
    backgroundColor: colors.neutral.linen,
    marginVertical: spacing.xs,
  },

  // Location Button
  locationButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: colors.neutral.cream,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
    ...shadows.soft,
  },

  // Hint Container
  hintContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
    ...shadows.medium,
  },
  hintIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  hintContent: {
    flex: 1,
  },
  hintTitle: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
    fontFamily: 'Georgia',
    marginBottom: 2,
  },
  hintText: {
    ...typography.body.small,
    color: colors.primary.rosé,
  },
});
