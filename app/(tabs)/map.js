// app/(tabs)/map.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import ManualWineryEntryModal from '../../components/ManualWineryEntryModal';
import PinActionModal from '../../components/PinActionModal';
import WineryNameModal from '../../components/WineryNameModal';
import { usePro } from '../../hooks/usePro';
import { haversineKm } from '../../lib/geo';
import { wineriesService } from '../../lib/wineries';
import { wineryDirectoryService } from '../../lib/wineryDirectory';
import { wishlistService } from '../../lib/wishlist';
import { buildClusterIndex, regionToBoundingBox, regionToZoom } from '../../utils/MapUtils';
import theme from '../../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;
const SERIF = typography.fonts.serif;

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
  const [pinsError, setPinsError] = useState(false);
  // The welcome hint self-destructs after the first pin; the "?" button
  // re-shows it on demand (#170 Layer C).
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [tempPin, setTempPin] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPinActions, setShowPinActions] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Winery discovery (Pro, #203 P2 + owner feedback 2026-09-09): nearby
  // wineries from OUR directory table shown by default, in their own color,
  // with filter chips to narrow the map. Zero Google cost — the directory is
  // our own table (Overture seed).
  const { isPro, presentPaywall } = usePro();
  const [discoverPins, setDiscoverPins] = useState([]);
  const [pinFilter, setPinFilter] = useState('all'); // 'all' | 'visited' | 'wishlist' | 'nearby'
  const [openingDiscoverId, setOpeningDiscoverId] = useState(null);

  // Searchable list of places you've visited (#101).
  const [showPlacesList, setShowPlacesList] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');
  // "Find" tab (Pro, owner feedback 2026-09-09): search the whole winery
  // directory by name, nearest first. Debounced; our own table, zero API cost.
  const [directoryResults, setDirectoryResults] = useState([]);
  const [listTab, setListTab] = useState('visited'); // 'visited' | 'wishlist' (#97)

  // Places you've actually been (visited) and wineries you've saved (wishlist).
  const visitedPlaces = userPins.filter(p => p.hasVisit);
  const wishlistPlaces = userPins.filter(p => p.inWishlist);
  const baseList = listTab === 'wishlist' ? wishlistPlaces : visitedPlaces;
  const filteredPlaces = placeSearch.trim()
    ? baseList.filter(p =>
        `${p.name || ''} ${p.address || ''}`
          .toLowerCase()
          .includes(placeSearch.trim().toLowerCase())
      )
    : baseList;

  const openPlace = (place) => {
    setShowPlacesList(false);
    setPlaceSearch('');
    router.push(`/winery/${place.id}`);
  };

  // Reload pins whenever the map regains focus, so a winery added elsewhere
  // (drop-pin, manual entry, or a logged session) shows up without a restart.
  useFocusEffect(
    useCallback(() => {
      loadUserPins();
    }, [])
  );

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
        setPinsError(false);
      } else {
        setPinsError(true);
      }
    } catch (error) {
      console.error('Error loading user pins:', error);
      setPinsError(true);
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

  // Load directory wineries for whatever the map is LOOKING AT (#224), not
  // the phone's physical location — panning to Napa from Virginia shows Napa.
  // Debounced so settling after a fling fires one query, and the box is
  // padded so pins just past the screen edge already exist mid-pan. Pins that
  // sit on top of a place the user already has (same-ish spot) are dropped so
  // a visited winery never shows twice in two colors.
  useEffect(() => {
    if (!isPro) return;
    let active = true;
    const t = setTimeout(async () => {
      const res = await wineryDirectoryService.getInBounds(
        regionToBoundingBox(region, 0.3)
      );
      if (!active || !res.success) return;
      const fresh = res.wineries.filter(
        (w) =>
          !userPins.some(
            (p) =>
              p.latitude != null &&
              haversineKm(p.latitude, p.longitude, w.latitude, w.longitude) < 0.15
          )
      );
      setDiscoverPins(fresh);
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // userPins in deps so a newly-saved winery immediately swallows its
    // duplicate discovery pin.
  }, [isPro, region, userPins]);

  // Clustering (#224): all visible pins go through one supercluster index so
  // a zoomed-out region shows count bubbles instead of a wall of overlapping
  // markers. Name labels only render when the map is close enough for them to
  // be readable; the threshold matches the initial centered-on-you view
  // (longitudeDelta 0.1 ≈ zoom 11.8).
  const zoom = regionToZoom(region);
  const showLabels = zoom >= 11.5;

  const visibleUserPins = useMemo(
    () =>
      userPins
        .filter((pin) => pin.latitude != null && pin.longitude != null)
        .filter((pin) =>
          pinFilter === 'all'
            ? true
            : pinFilter === 'visited'
              ? pin.hasVisit
              : pinFilter === 'wishlist'
                ? pin.inWishlist
                : false
        ),
    [userPins, pinFilter]
  );

  const visibleDiscoverPins = useMemo(
    () => (isPro && (pinFilter === 'all' || pinFilter === 'nearby') ? discoverPins : []),
    [isPro, pinFilter, discoverPins]
  );

  const clusterIndex = useMemo(
    () =>
      buildClusterIndex([
        ...visibleUserPins.map((pin) => ({ kind: 'user', pin })),
        ...visibleDiscoverPins.map((pin) => ({ kind: 'discover', pin })),
      ]),
    [visibleUserPins, visibleDiscoverPins]
  );

  const mapFeatures = useMemo(() => {
    const { west, south, east, north } = regionToBoundingBox(region, 0.2);
    return clusterIndex.getClusters([west, south, east, north], Math.round(zoom));
  }, [clusterIndex, region, zoom]);

  // Tapping a bubble zooms to just past the level where it breaks apart.
  const handleClusterPress = (cluster) => {
    let expansionZoom;
    try {
      expansionZoom = clusterIndex.getClusterExpansionZoom(cluster.properties.cluster_id);
    } catch {
      expansionZoom = zoom + 2;
    }
    const [longitude, latitude] = cluster.geometry.coordinates;
    const longitudeDelta = 360 / Math.pow(2, Math.min(expansionZoom + 0.5, 17));
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta:
          longitudeDelta * (region.latitudeDelta / Math.max(region.longitudeDelta, 0.00001)),
        longitudeDelta,
      },
      400
    );
  };

  // Debounced directory search for the Find tab.
  useEffect(() => {
    if (listTab !== 'find' || !isPro) return;
    const q = placeSearch.trim();
    if (q.length < 2) {
      setDirectoryResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await wineryDirectoryService.searchByName({
        query: q,
        latitude: userLocation?.latitude ?? null,
        longitude: userLocation?.longitude ?? null,
      });
      if (res.success) setDirectoryResults(res.wineries);
    }, 300);
    return () => clearTimeout(t);
  }, [listTab, placeSearch, isPro, userLocation]);

  // Tapping a discovery pin promotes it to a real winery record and opens its
  // page (same flow as Home's Near You row) — where the Google card enriches it.
  const handleDiscoverPinPress = async (w) => {
    if (openingDiscoverId) return;
    setOpeningDiscoverId(w.id);
    try {
      const res = await wineriesService.findOrCreateWinery({
        name: w.name,
        latitude: w.latitude,
        longitude: w.longitude,
        address: [w.city, w.state].filter(Boolean).join(', ') || null,
      });
      const id = res?.winery?.id;
      if (id != null) {
        setUserPins((prev) =>
          prev.some((p) => p.id === id) ? prev : [...prev, res.winery]
        );
        router.push(`/winery/${id}`);
      }
    } finally {
      setOpeningDiscoverId(null);
    }
  };

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

  // "View winery & your notes" → the winery page; "Log a visit here" → the log
  // form directly, pre-filled with this winery. The two used to open the same
  // page (#170 item 6).
  const handleViewWinery = () => {
    setShowPinActions(false);
    if (selectedPin) {
      router.push(`/winery/${selectedPin.id}`);
    }
  };

  const handleLogVisit = () => {
    setShowPinActions(false);
    if (selectedPin) {
      router.push({
        pathname: '/log-session',
        params: {
          mode: 'winery',
          wineryId: selectedPin.id,
          wineryName: selectedPin.name,
        },
      });
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
    return colors.primary.base;
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

    // showLabels in the key: with tracksViewChanges off the marker is a
    // one-time snapshot, so crossing the label zoom threshold has to remount
    // the marker for the label to actually appear/disappear.
    return (
      <Marker
        key={`${pin.id}-${showLabels ? 'lbl' : 'dot'}`}
        coordinate={{
          latitude: pin.latitude,
          longitude: pin.longitude
        }}
        tracksViewChanges={false}
        onPress={() => handlePinPress(pin)}
      >
        <View style={styles.markerContainer}>
          {showLabels && (
            <View style={styles.markerLabelContainer}>
              <Text style={styles.markerLabel} numberOfLines={1}>
                {pin.name}
              </Text>
            </View>
          )}
          <View style={[
            styles.wineryMarker,
            pin.hasVisit && styles.visitedMarker,
            pin.inWishlist && !pin.hasVisit && styles.wishlistMarker
          ]}>
            <Ionicons name="wine" size={16} color={colors.neutral.bg} />
          </View>
        </View>
      </Marker>
    );
  };

  // Discovery pins (Pro): nearby directory wineries in the accent color,
  // visually apart from visited (sage) and wishlist (slate).
  const renderDiscoverMarker = (w) =>
    Platform.OS === 'android' ? (
      <Marker
        key={`dir-${w.id}`}
        coordinate={{ latitude: w.latitude, longitude: w.longitude }}
        pinColor={colors.accent.base}
        title={w.name}
        description="Nearby winery — tap to view"
        onPress={() => handleDiscoverPinPress(w)}
      />
    ) : (
      <Marker
        key={`dir-${w.id}-${showLabels ? 'lbl' : 'dot'}`}
        coordinate={{ latitude: w.latitude, longitude: w.longitude }}
        tracksViewChanges={false}
        onPress={() => handleDiscoverPinPress(w)}
      >
        <View style={styles.markerContainer}>
          {showLabels && (
            <View style={styles.markerLabelContainer}>
              <Text style={styles.markerLabel} numberOfLines={1}>
                {w.name}
              </Text>
            </View>
          )}
          <View style={[styles.wineryMarker, styles.discoverMarker]}>
            <Ionicons name="wine-outline" size={16} color={colors.neutral.ink} />
          </View>
        </View>
      </Marker>
    );

  const renderClusterMarker = (cluster) => {
    const [longitude, latitude] = cluster.geometry.coordinates;
    const count = cluster.properties.point_count;
    // A bubble of nothing-but-discovery pins keeps the discovery accent so
    // the two layers stay tellable-apart even when collapsed.
    const allDiscover = cluster.properties.discoverCount === count;
    const size = count >= 100 ? 52 : count >= 25 ? 44 : 36;
    return (
      <Marker
        key={`cluster-${cluster.properties.cluster_id}`}
        coordinate={{ latitude, longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        // Android only renders custom marker views reliably while
        // tracksViewChanges stays on (the Feb 2026 marker bug); clusters are
        // few enough on screen that the extra redraws don't matter.
        tracksViewChanges={Platform.OS === 'android'}
        onPress={() => handleClusterPress(cluster)}
      >
        <View
          style={[
            styles.clusterMarker,
            allDiscover && styles.clusterMarkerDiscover,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.clusterCount, allDiscover && styles.clusterCountDiscover]}>
            {cluster.properties.point_count_abbreviated}
          </Text>
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
        {/* User + discovery pins, clustered (#224): overlapping pins collapse
            into count bubbles until you zoom in; tap a bubble to expand. */}
        {mapFeatures.map((f) =>
          f.properties.cluster
            ? renderClusterMarker(f)
            : f.properties.kind === 'discover'
              ? renderDiscoverMarker(f.properties.pin)
              : renderPinMarker(f.properties.pin)
        )}

        {tempPin && (
          <Marker
            coordinate={tempPin}
            pinColor={colors.primary.base}
          />
        )}
      </MapView>

      {/* Search your visited places (#101). Shown once there's at least one
          place to search; sits where the welcome hint would otherwise be. */}
      {(visitedPlaces.length > 0 || wishlistPlaces.length > 0) && (
        <TouchableOpacity
          style={styles.searchPill}
          activeOpacity={0.85}
          onPress={() => {
            // Open to whichever list has something to show.
            setListTab(visitedPlaces.length === 0 && wishlistPlaces.length > 0 ? 'wishlist' : 'visited');
            setShowPlacesList(true);
          }}
        >
          <Ionicons name="search" size={18} color={colors.neutral.inkTertiary} />
          <Text style={styles.searchPillText} numberOfLines={1}>
            Your places &amp; wishlist
          </Text>
          <Ionicons name="list" size={18} color={colors.primary.base} />
        </TouchableOpacity>
      )}

      {/* Pin filter chips: All · Visited · Wishlist · Nearby (owner feedback
          2026-09-09). "Nearby" is the Pro discovery layer; free users get the
          paywall from its chip rather than a silent no-op. */}
      <View
        style={[
          styles.filterChips,
          { top: visitedPlaces.length > 0 || wishlistPlaces.length > 0 ? 112 : 60 },
        ]}
      >
        {[
          ['all', 'All'],
          ['visited', 'Visited'],
          ['wishlist', 'Wishlist'],
          ['nearby', 'Nearby'],
        ].map(([key, label]) => {
          const active = pinFilter === key;
          const dotColor =
            key === 'visited'
              ? colors.status.visited
              : key === 'wishlist'
                ? colors.status.wishlist
                : key === 'nearby'
                  ? colors.accent.base
                  : null;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.85}
              onPress={() => {
                if (key === 'nearby' && !isPro) {
                  presentPaywall('places');
                  return;
                }
                setPinFilter(key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${label.toLowerCase()} pins`}
            >
              {dotColor && <View style={[styles.filterDot, { backgroundColor: dotColor }]} />}
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label}
              </Text>
              {key === 'nearby' && !isPro && <Text style={styles.filterChipPro}>PRO</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setShowFabMenu(!showFabMenu)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={showFabMenu ? 'Close menu' : 'Quick actions'}
      >
        <Ionicons
          name={showFabMenu ? "close" : "add"}
          size={28}
          color={colors.neutral.bg}
        />
      </TouchableOpacity>

      {/* FAB Menu */}
      {showFabMenu && (
        <View style={styles.fabMenu}>
          <View style={styles.fabMenuHeader}>
            <Text style={styles.fabMenuTitle}>Quick actions</Text>
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
            <View style={[styles.fabMenuIcon, { backgroundColor: colors.primary.base }]}>
              <Ionicons name="wine" size={18} color={colors.neutral.bg} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Log visit</Text>
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
              <Ionicons name="bookmark" size={18} color={colors.neutral.bg} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Add to wishlist</Text>
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
              <Ionicons name="location" size={18} color={colors.neutral.bg} />
            </View>
            <View style={styles.fabMenuContent}>
              <Text style={styles.fabMenuText}>Drop pin here</Text>
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
        accessibilityRole="button"
        accessibilityLabel="Center on my location"
      >
        <Ionicons name="locate" size={22} color={colors.primary.base} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setShowHelpHint((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="How to use the map"
      >
        <Ionicons name="help" size={20} color={colors.primary.base} />
      </TouchableOpacity>

      {/* Re-shown hint via the "?" button — dismissable by tapping it. */}
      {showHelpHint && !(pinsLoaded && userPins.length === 0 && !pinsError) && (
        <TouchableOpacity
          style={styles.hintContainer}
          activeOpacity={0.85}
          onPress={() => setShowHelpHint(false)}
        >
          <View style={styles.hintIcon}>
            <Ionicons name="wine-outline" size={20} color={colors.neutral.bg} />
          </View>
          <View style={styles.hintContent}>
            <Text style={styles.hintTitle}>Getting around</Text>
            <Text style={styles.hintText}>
              Long-press on the map to drop a pin, or tap + to get started
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Hint text for first-time users — or an error banner when the pins
          failed to load, so we don't show onboarding over a wrongly-empty map. */}
      {pinsLoaded && userPins.length === 0 && (
        pinsError ? (
          <TouchableOpacity
            style={styles.hintContainer}
            activeOpacity={0.85}
            onPress={loadUserPins}
          >
            <View style={styles.hintIcon}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.neutral.bg} />
            </View>
            <View style={styles.hintContent}>
              <Text style={styles.hintTitle}>Couldn&apos;t load your places</Text>
              <Text style={styles.hintText}>Tap to try again</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.hintContainer}>
            <View style={styles.hintIcon}>
              <Ionicons name="wine-outline" size={20} color={colors.neutral.bg} />
            </View>
            <View style={styles.hintContent}>
              <Text style={styles.hintTitle}>Welcome</Text>
              <Text style={styles.hintText}>
                Long-press on the map to drop a pin, or tap + to get started
              </Text>
            </View>
          </View>
        )
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
        onViewDetails={handleViewWinery}
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
              <Text style={styles.listTitle}>Your places</Text>
              <TouchableOpacity
                onPress={() => setShowPlacesList(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.neutral.ink} />
              </TouchableOpacity>
            </View>

            {/* Visited / Wishlist segments (#97) */}
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentBtn, listTab === 'visited' && styles.segmentBtnActive]}
                activeOpacity={0.8}
                onPress={() => setListTab('visited')}
              >
                <Text style={[styles.segmentText, listTab === 'visited' && styles.segmentTextActive]}>
                  Visited ({visitedPlaces.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, listTab === 'wishlist' && styles.segmentBtnActive]}
                activeOpacity={0.8}
                onPress={() => setListTab('wishlist')}
              >
                <Text style={[styles.segmentText, listTab === 'wishlist' && styles.segmentTextActive]}>
                  Wishlist ({wishlistPlaces.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, listTab === 'find' && styles.segmentBtnActive]}
                activeOpacity={0.8}
                onPress={() => {
                  if (!isPro) {
                    presentPaywall('places');
                    return;
                  }
                  setListTab('find');
                }}
              >
                <Text style={[styles.segmentText, listTab === 'find' && styles.segmentTextActive]}>
                  Find{!isPro ? ' ·PRO' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.neutral.inkTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  listTab === 'find'
                    ? 'Search 14,000+ US wineries'
                    : listTab === 'wishlist'
                      ? 'Search your wishlist'
                      : "Search wineries you've visited"
                }
                placeholderTextColor={colors.neutral.placeholder}
                value={placeSearch}
                onChangeText={setPlaceSearch}
                autoCorrect={false}
                returnKeyType="search"
                selectionColor={colors.primary.base}
              />
              {placeSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setPlaceSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.neutral.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={listTab === 'find' ? directoryResults : filteredPlaces}
              keyExtractor={(item) => (listTab === 'find' ? `dir-${item.id}` : String(item.id))}
              keyboardShouldPersistTaps="handled"
              style={styles.listScroll}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              renderItem={({ item }) =>
                listTab === 'find' ? (
                  <TouchableOpacity
                    style={styles.placeRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowPlacesList(false);
                      handleDiscoverPinPress(item);
                    }}
                  >
                    <View style={styles.placeIcon}>
                      <Ionicons name="wine-outline" size={18} color={colors.accent.strong} />
                    </View>
                    <View style={styles.placeMeta}>
                      <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.placeAddress} numberOfLines={1}>
                        {[
                          item.distanceKm != null
                            ? `${(item.distanceKm * 0.621371).toFixed(item.distanceKm * 0.621371 < 10 ? 1 : 0)} mi`
                            : null,
                          [item.city, item.state].filter(Boolean).join(', ') || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.placeRow}
                    activeOpacity={0.7}
                    onPress={() => openPlace(item)}
                  >
                    <View style={styles.placeIcon}>
                      <Ionicons
                        name={listTab === 'wishlist' ? 'bookmark' : 'location'}
                        size={18}
                        color={listTab === 'wishlist' ? colors.status.wishlist : colors.primary.base}
                      />
                    </View>
                    <View style={styles.placeMeta}>
                      <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                      {item.address ? (
                        <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
                  </TouchableOpacity>
                )
              }
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  <Ionicons name="wine-outline" size={28} color={colors.accent.border} />
                  <Text style={styles.listEmptyText}>
                    {listTab === 'find'
                      ? placeSearch.trim().length >= 2
                        ? 'No wineries match that name'
                        : 'Type a winery name — or browse the apricot pins on the map'
                      : placeSearch.trim()
                      ? 'No matches for your search'
                      : listTab === 'wishlist'
                      ? 'No saved wineries yet — add some from the map or the ＋ menu'
                      : 'No visited places yet'}
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

// How far the floating map controls sit above the bottom of the MapView, which
// is also the top of the tab bar. Only needs to clear Apple's attribution row
// (~16pt tall, bottom-left); the previous 64 left a band of dead map between the
// controls and the tab bar and pushed them out of comfortable thumb reach.
const MAP_CONTROL_BOTTOM = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Marker Styles
  markerContainer: {
    alignItems: 'center',
  },
  markerLabelContainer: {
    backgroundColor: colors.neutral.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.accent.border,
    maxWidth: 140,
    ...shadows.soft,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral.ink,
    textAlign: 'center',
    fontFamily: SERIF,
  },
  wineryMarker: {
    backgroundColor: colors.primary.base,
    padding: 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.neutral.bg,
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
  //
  // MAP_CONTROL_BOTTOM, not 0 — Apple renders the "Maps" logo and its "Legal"
  // link at the BOTTOM-LEFT of the MapView, directly under this button. MapKit's
  // terms require that attribution stay visible and unobstructed, so covering it
  // is a potential App Review rejection, not just a cosmetic overlap (#155).
  fabButton: {
    position: 'absolute',
    bottom: MAP_CONTROL_BOTTOM,
    left: 16,
    backgroundColor: colors.primary.base,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent.border,
    ...shadows.medium,
  },

  // FAB Menu
  //
  // width, not minWidth — with an auto width, Yoga measured each row's subtitle
  // at its natural single-line width, settled the card at minWidth, and only
  // then re-wrapped "Mark your current location" onto a second line. The card's
  // height was already fixed from the first pass, so the last action spilled out
  // of the cream background and onto the map. A definite width makes both passes
  // agree; 272 leaves ~172pt for the text column, enough for the longest
  // subtitle to stay on one line.
  fabMenu: {
    position: 'absolute',
    bottom: MAP_CONTROL_BOTTOM + 56 + spacing.md, // clears the 56pt FAB below it
    left: 16,
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    width: 272,
    ...shadows.strong,
  },
  fabMenuHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
    marginBottom: spacing.xs,
  },
  fabMenuTitle: {
    ...typography.body.caption,
    color: colors.accent.ink,
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
    color: colors.neutral.ink,
    fontWeight: '500',
  },
  fabMenuSubtext: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },
  // Inset separator so it doesn't run into the menu's rounded corners and the
  // "Drop Pin Here" action below sits evenly with the others (#107).
  fabMenuDivider: {
    height: 1,
    backgroundColor: colors.neutral.divider,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
  },

  // Location Button
  locationButton: {
    position: 'absolute',
    bottom: MAP_CONTROL_BOTTOM, // stays level with the FAB (see fabButton)
    right: 16,
    backgroundColor: colors.neutral.bg,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent.border,
    ...shadows.soft,
  },
  helpButton: {
    position: 'absolute',
    bottom: MAP_CONTROL_BOTTOM + 48 + spacing.sm, // stacked above the locate button
    right: 16,
    backgroundColor: colors.neutral.bg,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent.border,
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
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.accent.border,
    ...shadows.medium,
  },
  // Pin filter chips (under the search pill)
  filterChips: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 32,
    ...shadows.soft,
  },
  filterChipActive: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  filterChipText: { ...typography.body.small, color: colors.neutral.ink, fontWeight: '600' },
  filterChipTextActive: { color: colors.neutral.bg },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipPro: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.accent.ink,
  },
  discoverMarker: {
    backgroundColor: colors.accent.base,
    borderColor: colors.neutral.bg,
  },
  // Cluster count bubbles (#224); width/height/radius are set inline since
  // they scale with the count.
  clusterMarker: {
    backgroundColor: colors.primary.base,
    borderWidth: 2,
    borderColor: colors.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  clusterMarkerDiscover: {
    backgroundColor: colors.accent.base,
  },
  clusterCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral.bg,
  },
  clusterCountDiscover: {
    color: colors.neutral.ink,
  },
  searchPillText: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
  },

  // Places list sheet (#101)
  listOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  listBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  listSheet: {
    backgroundColor: colors.neutral.bg,
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
    backgroundColor: colors.neutral.border,
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
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  // Visited / Wishlist segmented control (#97)
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: 3,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primary.base,
  },
  segmentText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.neutral.bg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.ink,
    padding: 0,
  },
  listScroll: {
    marginTop: spacing.xs,
  },
  listSeparator: {
    height: 1,
    backgroundColor: colors.neutral.divider,
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
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeMeta: { flex: 1 },
  placeName: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '600',
  },
  placeAddress: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },
  listEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  listEmptyText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
  },

  // Hint Container
  hintContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent.border,
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
    color: colors.neutral.bg,
    fontWeight: '600',
    fontFamily: SERIF,
    marginBottom: 2,
  },
  hintText: {
    ...typography.body.small,
    color: colors.primary.soft,
  },
});
