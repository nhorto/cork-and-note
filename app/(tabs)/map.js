// app/(tabs)/map.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const params = useLocalSearchParams();
  const mapRef = useRef(null);

  // Region state - falls back to a wide Virginia view until the user's
  // location resolves, then re-centers on the user (see effect below).
  const [region, setRegion] = useState({
    latitude: 37.4316, // Approximate center of Virginia
    longitude: -78.6569,
    latitudeDelta: 5, // Wider delta to show the whole state
    longitudeDelta: 5,
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

  // Searchable list of places you've visited (#101).
  const [showPlacesList, setShowPlacesList] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');

  // Places you've actually been (visited pins), newest names first-ish.
  const visitedPlaces = userPins.filter(p => p.hasVisit);
  const filteredPlaces = placeSearch.trim()
    ? visitedPlaces.filter(p =>
        `${p.name || ''} ${p.address || ''}`
          .toLowerCase()
          .includes(placeSearch.trim().toLowerCase())
      )
    : visitedPlaces;

  const openPlace = (place) => {
    setShowPlacesList(false);
    setPlaceSearch('');
    router.push(`/winery/${place.id}`);
  };

  useEffect(() => {
    loadUserPins();
  }, []);

  // Opened from the home hub's "Add to wishlist" (?quickAdd=wishlist): open the
  // winery-entry modal in wishlist mode, then clear the param so a later visit
  // to Explore doesn't reopen it.
  useEffect(() => {
    if (params.quickAdd === 'wishlist') {
      setPendingAction('wishlist');
      setShowManualModal(true);
      router.setParams({ quickAdd: undefined });
    }
  }, [params.quickAdd]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
        setUserLocation(coords);

        // Center the map on the user's location once we have it.
        const userRegion = {
          ...coords,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setRegion(userRegion);
        mapRef.current?.animateToRegion(userRegion, 1000);
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

      {/* Search your visited places (#101). Shown once there's at least one
          place to search; sits where the welcome hint would otherwise be. */}
      {visitedPlaces.length > 0 && (
        <TouchableOpacity
          style={styles.searchPill}
          activeOpacity={0.85}
          onPress={() => setShowPlacesList(true)}
        >
          <Ionicons name="search" size={18} color={colors.neutral.pewter} />
          <Text style={styles.searchPillText} numberOfLines={1}>
            Search your {visitedPlaces.length} place{visitedPlaces.length === 1 ? '' : 's'}
          </Text>
          <Ionicons name="list" size={18} color={colors.primary.burgundy} />
        </TouchableOpacity>
      )}

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
            <Text style={styles.hintTitle}>Welcome</Text>
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

      {/* Searchable list of visited places (#101) */}
      <Modal
        visible={showPlacesList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlacesList(false)}
      >
        <View style={styles.listOverlay}>
          <TouchableOpacity
            style={styles.listBackdrop}
            activeOpacity={1}
            onPress={() => setShowPlacesList(false)}
          />
          <View style={styles.listSheet}>
            <View style={styles.handle} />
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Your Places</Text>
              <TouchableOpacity onPress={() => setShowPlacesList(false)}>
                <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.neutral.pewter} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search wineries you've visited"
                placeholderTextColor={colors.neutral.silver}
                value={placeSearch}
                onChangeText={setPlaceSearch}
                autoCorrect={false}
                returnKeyType="search"
                selectionColor={colors.primary.burgundy}
              />
              {placeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPlaceSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.neutral.silver} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredPlaces}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              style={styles.listScroll}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.placeRow}
                  activeOpacity={0.7}
                  onPress={() => openPlace(item)}
                >
                  <View style={styles.placeIcon}>
                    <Ionicons name="location" size={18} color={colors.primary.burgundy} />
                  </View>
                  <View style={styles.placeMeta}>
                    <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                    {item.address ? (
                      <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  <Ionicons name="wine-outline" size={28} color={colors.gold.muted} />
                  <Text style={styles.listEmptyText}>
                    {placeSearch.trim() ? 'No places match your search' : 'No visited places yet'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
  // Inset separator so it doesn't run into the menu's rounded corners and the
  // "Drop Pin Here" action below sits evenly with the others (#107).
  fabMenuDivider: {
    height: 1,
    backgroundColor: colors.neutral.linen,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
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

  // Search-your-places pill (#101)
  searchPill: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    ...shadows.medium,
  },
  searchPillText: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.pewter,
  },

  // Places list sheet (#101)
  listOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  listBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  listSheet: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.stone,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  listTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    padding: 0,
  },
  listScroll: {
    marginTop: spacing.xs,
  },
  listSeparator: {
    height: 1,
    backgroundColor: colors.neutral.linen,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeMeta: { flex: 1 },
  placeName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  placeAddress: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },
  listEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  listEmptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
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
