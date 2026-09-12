// app/(tabs)/map.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polygon } from 'react-native-maps';
import CellarOptionSheet from '../../components/CellarOptionSheet';
import ManualWineryEntryModal from '../../components/ManualWineryEntryModal';
import MapLayersSheet from '../../components/MapLayersSheet';
import PinActionModal from '../../components/PinActionModal';
import WineRegionSheet from '../../components/WineRegionSheet';
import WineryNameModal from '../../components/WineryNameModal';
import { usePro } from '../../hooks/usePro';
import {
  regionCenter,
  regionRadiusKm,
  regionsAtPoint,
  regionsInBounds,
  regionsMeta,
  toNativePolygons,
} from '../../lib/avaRegions';
import { getMapLocation } from '../../lib/mapLocation';
import { haversineKm } from '../../lib/geo';
import { wineriesService } from '../../lib/wineries';
import { wineryDirectoryService } from '../../lib/wineryDirectory';
import { wishlistService } from '../../lib/wishlist';
import { createThemedStyles, useTheme } from '../../styles/ThemeProvider';
import { darkMapStyle, regionStyle, withAlpha } from '../../styles/mapTheme';
import {
  CLUSTER_RADIUS,
  CLUSTER_RADIUS_LABELLED,
  LABEL_ZOOM_USER,
  bboxContains,
  buildClusterIndex,
  featureKey,
  placeLabels,
  regionToBoundingBox,
  regionToZoom,
  spreadStackedFeatures,
} from '../../utils/MapUtils';


// "Wine regions" layer (US AVA boundaries, Pro). Persisted per device so a Pro
// subscriber who turned it on finds it on next time.
const WINE_REGIONS_KEY = 'map.layers.wineRegions';
// Below this zoom the whole country is on screen and 280 outlines are noise
// (and a lot of native geometry). The map shows a hint instead.
const WINE_REGIONS_MIN_ZOOM = 6;
// Region names sit at the polygon centroid from here in; further out the
// outlines alone are the story and 60 labels would be clutter.
const WINE_REGION_LABEL_ZOOM = 9;
// Pin legend: number of map sessions it stays visible before retreating
// behind the ? button.
const LEGEND_SEEN_KEY = 'map.legend.seen';
const LEGEND_SESSIONS = 3;
// How long a directory fetch may run before the search pill shows a spinner
// (#277). Most viewport queries settle faster than this, so a quick pan never
// flashes any loading state.
const DISCOVERY_BUSY_DELAY_MS = 400;

export default function MapScreen() {
  const { mode } = useTheme();
  const { colors, styles } = useScreenTheme();

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
  // null | 'permission' | 'services' | 'unavailable'. Location is optional,
  // so a failed GPS lookup should become recoverable UI, never a raw native
  // error or a blocker for manually dropping a pin.
  const [locationIssue, setLocationIssue] = useState(null);
  const [locating, setLocating] = useState(false);
  const [userPins, setUserPins] = useState([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [pinsError, setPinsError] = useState(false);
  // Welcome can be dismissed even before saving a place; help reopens it.
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [tempPin, setTempPin] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPinActions, setShowPinActions] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Winery discovery (all plans): nearby
  // wineries from OUR directory table shown by default, in their own color,
  // with filter chips to narrow the map. Zero Google cost — the directory is
  // our own table (Overture seed).
  const [directoryRows, setDirectoryRows] = useState([]);
  const [discoveryStatus, setDiscoveryStatus] = useState('loading');
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  // The box the current directoryRows cover, and whether the query hit its
  // cap. A pan or zoom that stays inside a fully-covered box needs no fetch
  // and no loading state (#277).
  const coveredBox = useRef(null);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [pinFilter, setPinFilter] = useState('all'); // 'all' | 'visited' | 'wishlist' | 'nearby'
  // Pin legend (#274): shown under the chips for the first few sessions, and
  // whenever the help hint is open after that.
  const [legendSeen, setLegendSeen] = useState(null);

  // Searchable list of places you've visited (#101).
  const [showPlacesList, setShowPlacesList] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');
  // "Find" tab (all plans): search the whole winery
  // directory by name, nearest first. Debounced; our own table, zero API cost.
  const [directoryResults, setDirectoryResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
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

  const getCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationIssue('permission');
        return null;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationIssue('services');
        return null;
      }

      // Bound the native lookup so simulators and indoor devices without a
      // GPS fix stay usable instead of leaving the UI spinning indefinitely.
      const loc = await getMapLocation();
      const coordinate = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coordinate);
      setLocationIssue(null);
      return coordinate;
    } catch {
      // A granted permission does not guarantee a fix (notably when a
      // simulator has no location selected). Keep the map usable and explain
      // what the user can do next instead of surfacing the native exception.
      setLocationIssue('unavailable');
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  const centerMapOn = useCallback((coordinate, delta = 0.05) => {
    const nextRegion = {
      ...coordinate,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 1000);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const coordinate = await getCurrentLocation();
      if (active && coordinate) centerMapOn(coordinate, 0.1);
    })();
    return () => {
      active = false;
    };
  }, [centerMapOn, getCurrentLocation]);

  // If the permission CTA took the user to Account settings, resolve the
  // stale banner automatically when they come back to the map.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (locationIssue !== 'permission') return () => { active = false; };

      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (active && status === 'granted') {
            const coordinate = await getCurrentLocation();
            if (active && coordinate) centerMapOn(coordinate, 0.1);
          }
        } catch {
          // Keep the existing permission guidance visible.
        }
      })();
      return () => {
        active = false;
      };
    }, [centerMapOn, getCurrentLocation, locationIssue])
  );

  // Opening device settings backgrounds the app without changing navigation
  // focus. Retry when it becomes active so the banner recovers by itself.
  useEffect(() => {
    if (locationIssue !== 'services') return undefined;
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const coordinate = await getCurrentLocation();
      if (coordinate) centerMapOn(coordinate, 0.1);
    });
    return () => subscription.remove();
  }, [centerMapOn, getCurrentLocation, locationIssue]);

  // Load directory wineries for whatever the map is LOOKING AT (#224), not
  // the phone's physical location — panning to Napa from Virginia shows Napa.
  // Debounced so settling after a fling fires one query, and the box is
  // padded so pins just past the screen edge already exist mid-pan. When the
  // new viewport sits inside a box we already hold in full, nothing is
  // fetched and nothing flickers (#277).
  useEffect(() => {
    const box = regionToBoundingBox(region, 0.3);
    const covered = coveredBox.current;
    if (covered && !covered.truncated && bboxContains(covered, box) && discoveryRetry === covered.retry) {
      return undefined;
    }
    let active = true;
    setDiscoveryStatus('loading');
    const t = setTimeout(async () => {
      const res = await wineryDirectoryService.getInBounds(box);
      if (!active) return;
      if (!res.success) {
        coveredBox.current = null;
        setDirectoryRows([]);
        setDiscoveryStatus('error');
        return;
      }
      coveredBox.current = { ...box, truncated: Boolean(res.truncated), retry: discoveryRetry };
      setDiscoveryStatus(res.wineries.length ? 'ready' : 'empty');
      setDirectoryRows(res.wineries);
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [region, discoveryRetry]);

  // Only a fetch that is still running after the grace period shows the
  // spinner in the search pill, so the common fast case stays silent.
  useEffect(() => {
    if (discoveryStatus !== 'loading') {
      setDiscoveryBusy(false);
      return undefined;
    }
    const t = setTimeout(() => setDiscoveryBusy(true), DISCOVERY_BUSY_DELAY_MS);
    return () => clearTimeout(t);
  }, [discoveryStatus]);

  // A directory winery the user already has (linked by directory_id, or an
  // unlinked pin on the same-ish spot) is dropped so a visited winery never
  // shows twice in two colors. Derived, so a newly-saved winery swallows its
  // duplicate without a refetch.
  const discoverPins = useMemo(() => {
    const linked = new Set(userPins.map((p) => p.directory_id).filter((id) => id != null));
    return directoryRows.filter(
      (w) =>
        !linked.has(w.id) &&
        !userPins.some(
          (p) =>
            p.latitude != null &&
            haversineKm(p.latitude, p.longitude, w.latitude, w.longitude) < 0.15
        )
    );
  }, [directoryRows, userPins]);

  // Clustering (#224): all visible pins go through one supercluster index so
  // a zoomed-out region shows count bubbles instead of a wall of overlapping
  // markers. Name labels only render when the map is close enough for them to
  // be readable: your own places from a town-level view, directory pins only
  // once a dense tasting-room block has room for them, and never on top of
  // each other (placeLabels, #276).
  const zoom = regionToZoom(region);
  const showLabels = zoom >= LABEL_ZOOM_USER;


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
    () => ((pinFilter === 'all' || pinFilter === 'nearby') ? discoverPins : []),
    [pinFilter, discoverPins]
  );

  // A wider radius while labels are on: two pins a marker-width apart are
  // fine as dots, but their 140 pt labels would sit on top of each other.
  const clusterRadius = showLabels ? CLUSTER_RADIUS_LABELLED : CLUSTER_RADIUS;
  const clusterIndex = useMemo(
    () =>
      buildClusterIndex(
        [
          ...visibleUserPins.map((pin) => ({ kind: 'user', pin })),
          ...visibleDiscoverPins.map((pin) => ({ kind: 'discover', pin })),
        ],
        { radius: clusterRadius }
      ),
    [visibleUserPins, visibleDiscoverPins, clusterRadius]
  );

  const mapFeatures = useMemo(() => {
    const { west, south, east, north } = regionToBoundingBox(region, 0.2);
    const features = spreadStackedFeatures(
      clusterIndex.getClusters([west, south, east, north], Math.round(zoom)),
      zoom
    );
    // Deterministic order: supercluster returns features in arbitrary order,
    // and letting React reorder dozens of Marker children stresses the
    // new-arch interop layer's child-index bookkeeping (the AIRMap
    // insertReactSubview crash). A stable sort turns reorders into plain
    // inserts/removes.
    return features.sort((a, b) => featureKey(a).localeCompare(featureKey(b)));
  }, [clusterIndex, region, zoom]);

  const labelledKeys = useMemo(() => placeLabels(mapFeatures, zoom), [mapFeatures, zoom]);

  // Marker keys must stay STABLE when labels come and go. Remounting every
  // marker at once (key churn) piles remove+insert pairs onto the cluster
  // expansion mutation and crashes AIRMap's insertReactSubview on the new
  // architecture (the "clustering crash" of old). Instead, whenever the set
  // of labelled pins changes, briefly turn tracksViewChanges on so iOS
  // re-snapshots the existing markers with/without their label, then freeze
  // them again.
  const [labelPulse, setLabelPulse] = useState(false);
  const labelSignature = [...labelledKeys].join('|');
  const prevLabelSignature = useRef(labelSignature);
  useEffect(() => {
    if (prevLabelSignature.current === labelSignature) return undefined;
    prevLabelSignature.current = labelSignature;
    setLabelPulse(true);
    const t = setTimeout(() => setLabelPulse(false), 700);
    return () => clearTimeout(t);
  }, [labelSignature]);

  // Two-phase marker commit: a cluster expansion swaps dozens of markers at
  // once, and a single mount transaction that mixes removes with inserts
  // desyncs the new-arch interop's child indices from AIRMap's own subview
  // array (NSRangeException in insertReactSubview — this exact tap crashed
  // the app in verification). So each change lands as two React commits:
  // first drop the markers that vanished (removes only, survivors keep their
  // order), then mount the new set on the next frame (inserts only).
  const [renderedFeatures, setRenderedFeatures] = useState([]);
  useEffect(() => {
    const nextKeys = new Set(mapFeatures.map(featureKey));
    setRenderedFeatures((prev) => {
      const kept = prev.filter((f) => nextKeys.has(featureKey(f)));
      return kept.length === prev.length ? prev : kept;
    });
    const id = requestAnimationFrame(() => setRenderedFeatures(mapFeatures));
    return () => cancelAnimationFrame(id);
  }, [mapFeatures]);

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
    if (listTab !== 'find') return;
    const q = placeSearch.trim();
    if (q.length < 2) {
      setDirectoryResults([]);
      setSearchStatus('idle');
      return;
    }
    let active = true;
    setDirectoryResults([]);
    setSearchStatus('loading');
    const t = setTimeout(async () => {
      const res = await wineryDirectoryService.searchByName({
        query: q,
        latitude: userLocation?.latitude ?? null,
        longitude: userLocation?.longitude ?? null,
      });
      if (!active) return;
      setSearchStatus(res.success ? 'ready' : 'error');
      if (res.success) setDirectoryResults(res.wineries);
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [listTab, placeSearch, userLocation]);

  // Tapping a discovery pin opens a PREVIEW of that directory winery (#270).
  // Nothing is saved: the page's Log visit / Add to wishlist are what create
  // your winery row, linked to the directory. If you already have that
  // winery, open yours (your notes) instead.
  const handleDiscoverPinPress = (w) => {
    const linked = userPins.find((p) => p.directory_id === w.id);
    router.push(linked ? `/winery/${linked.id}` : `/winery/dir-${w.id}`);
  };

  // Wine regions layer (Pro). The toggle is visible to everyone; flipping it on
  // a free account opens the paywall and the switch stays off.
  const { isPro, presentPaywall } = usePro();
  const [showLayersSheet, setShowLayersSheet] = useState(false);
  const [wineRegionsOn, setWineRegionsOn] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showRegionSheet, setShowRegionSheet] = useState(false);
  // Overlapping AVAs at a tapped point (Napa Valley sits inside North Coast):
  // a short chooser instead of guessing.
  const [regionChoices, setRegionChoices] = useState(null);
  const showWineRegions = Boolean(isPro && wineRegionsOn);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(WINE_REGIONS_KEY)
      .then((value) => { if (active && value === '1') setWineRegionsOn(true); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LEGEND_SEEN_KEY)
      .then((value) => {
        if (!active) return;
        const seen = Number(value) || 0;
        setLegendSeen(seen);
        if (seen < LEGEND_SESSIONS) AsyncStorage.setItem(LEGEND_SEEN_KEY, String(seen + 1)).catch(() => {});
      })
      .catch(() => { if (active) setLegendSeen(LEGEND_SESSIONS); });
    return () => { active = false; };
  }, []);
  const showLegend = showHelpHint || (legendSeen != null && legendSeen < LEGEND_SESSIONS);

  const handleToggleWineRegions = (next) => {
    if (!isPro) {
      // Close our own Modal before the paywall route presents, so the two
      // native modals never fight over presentation.
      setShowLayersSheet(false);
      presentPaywall('wine_regions');
      return;
    }
    setWineRegionsOn(next);
    if (!next) {
      setSelectedRegion(null);
      setShowRegionSheet(false);
    }
    AsyncStorage.setItem(WINE_REGIONS_KEY, next ? '1' : '0').catch(() => {});
  };

  // Only the regions whose bbox touches the (padded) viewport become native
  // polygons, and none at all when zoomed out past the threshold. Keyed on the
  // committed `region`, so a pan settles into one recompute, not a stream.
  const visibleRegions = useMemo(
    () =>
      showWineRegions && zoom >= WINE_REGIONS_MIN_ZOOM
        ? regionsInBounds(regionToBoundingBox(region, 0.25))
        : [],
    [showWineRegions, region, zoom]
  );
  const regionPolygons = useMemo(
    () => visibleRegions.flatMap((feature) => toNativePolygons(feature).map((p) => ({ ...p, feature }))),
    [visibleRegions]
  );

  const selectRegion = (feature) => {
    setRegionChoices(null);
    setSelectedRegion(feature);
    setShowRegionSheet(true);
  };

  const handleRegionPress = (event, feature) => {
    const coordinate = event?.nativeEvent?.coordinate;
    const hits = coordinate
      ? regionsAtPoint(coordinate.latitude, coordinate.longitude, visibleRegions)
      : [];
    const list = hits.length ? hits : [feature];
    if (list.length > 1) {
      setRegionChoices(list);
      return;
    }
    selectRegion(list[0]);
  };

  const handleChooseRegion = (id) => {
    const feature = regionChoices?.find((f) => f.id === id);
    setRegionChoices(null);
    if (!feature) return;
    // Let the chooser Modal finish dismissing before the region sheet presents.
    setTimeout(() => selectRegion(feature), 300);
  };

  const handlePlanDayInRegion = (feature) => {
    setShowRegionSheet(false);
    const center = regionCenter(feature);
    router.push({
      pathname: '/trips/new',
      params: {
        areaLabel: feature.name,
        areaLat: String(center.latitude),
        areaLng: String(center.longitude),
        areaRadiusKm: String(Math.max(1, Math.round(regionRadiusKm(feature)))),
      },
    });
  };

  const zoomToUserLocation = async () => {
    const coordinate = userLocation ?? await getCurrentLocation();
    if (coordinate) centerMapOn(coordinate);
  };

  const handleMapLongPress = useCallback((event) => {
    const { coordinate } = event.nativeEvent;
    setTempPin(coordinate);
    setShowNameModal(true);
  }, []);

  const dropPinAtMyLocation = async () => {
    setShowFabMenu(false);
    const coordinate = userLocation ?? await getCurrentLocation();
    if (!coordinate) return;
    setTempPin(coordinate);
    setShowNameModal(true);
  };

  const openLocationHelp = async () => {
    if (locationIssue === 'permission') {
      router.push('/profile/account-settings');
      return;
    }
    if (locationIssue === 'services') {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert(
          'Open device settings',
          'Turn on Location Services in your device settings, then return to Cork & Note.'
        );
      }
      return;
    }
    const coordinate = await getCurrentLocation();
    if (coordinate) centerMapOn(coordinate, 0.1);
  };

  const locationIssueContent = locationIssue === 'permission'
    ? {
        title: 'Location access is off',
        message: 'Enable it in Account settings, or long-press the map to place a pin manually.',
        action: 'Account settings',
      }
    : locationIssue === 'services'
      ? {
          title: 'Location Services are off',
          message: 'Turn them on in device settings, or long-press the map to place a pin manually.',
          action: 'Open settings',
        }
      : {
          title: 'Couldn\'t find your location',
          message: 'Check your signal and try again, or long-press the map to place a pin manually.',
          action: locating ? 'Finding location…' : 'Try again',
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

  // Pin vocabulary (#274): state is carried by glyph and shape, not fill
  // alone. Visited = sage with a check badge; wishlist = slate with a
  // bookmark; a dropped pin = purple wine glass; directory = hollow gold
  // ring with an outline glass; permanently closed = grey.
  const pinClosed = (pin) => pin.operatingStatus === 'permanently_closed';
  const getMarkerColor = (pin) => {
    if (pinClosed(pin)) return colors.neutral.inkTertiary;
    if (pin.hasVisit) return colors.status.visited;
    if (pin.inWishlist) return colors.status.wishlist;
    return colors.primary.base;
  };

  const renderPinMarker = (pin, labelled, displayCoordinate) => {
    if (Platform.OS === 'android') {
      return (
        <Marker
          key={`${pin.id}-${mode}`}
          coordinate={displayCoordinate}
          pinColor={getMarkerColor(pin)}
          title={pin.name}
          description="Tap for options"
          onPress={() => handlePinPress(pin)}
        />
      );
    }

    return (
      <Marker
        key={`${pin.id}-${mode}`}
        coordinate={displayCoordinate}
        tracksViewChanges={labelPulse}
        onPress={() => handlePinPress(pin)}
      >
        <View style={styles.markerContainer}>
          {labelled && (
            <View style={styles.markerLabelContainer}>
              <Text style={styles.markerLabel} numberOfLines={1}>
                {pin.name}
              </Text>
            </View>
          )}
          <View style={[
            styles.wineryMarker,
            pin.hasVisit && styles.visitedMarker,
            pin.inWishlist && !pin.hasVisit && styles.wishlistMarker,
            pinClosed(pin) && styles.closedMarker,
          ]}>
            <Ionicons
              name={pin.inWishlist && !pin.hasVisit ? 'bookmark' : 'wine'}
              size={16}
              color={pin.hasVisit || pin.inWishlist ? colors.onStatus : colors.onPrimary}
            />
            {pin.hasVisit && !pinClosed(pin) && (
              <View style={styles.visitedBadge}>
                <Ionicons name="checkmark" size={9} color={colors.status.visited} />
              </View>
            )}
          </View>
        </View>
      </Marker>
    );
  };

  // Discovery pins return to the original purple treatment. The outlined wine
  // glyph still distinguishes them from a user's solid-glass dropped pin.
  const renderDiscoverMarker = (w, labelled, displayCoordinate) =>
    Platform.OS === 'android' ? (
      <Marker
        key={`dir-${w.id}`}
        coordinate={displayCoordinate}
        pinColor={colors.primary.base}
        title={w.name}
        description="Nearby winery. Tap to view"
        onPress={() => handleDiscoverPinPress(w)}
      />
    ) : (
      <Marker
        key={`dir-${w.id}`}
        coordinate={displayCoordinate}
        tracksViewChanges={labelPulse}
        onPress={() => handleDiscoverPinPress(w)}
      >
        <View style={styles.markerContainer}>
          {labelled && (
            <View style={styles.markerLabelContainer}>
              <Text style={styles.markerLabel} numberOfLines={1}>
                {w.name}
              </Text>
            </View>
          )}
          <View style={[styles.wineryMarker, styles.discoverMarker]}>
            <Ionicons name="wine-outline" size={16} color={colors.onPrimary} />
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
        userInterfaceStyle={mode}
        customMapStyle={mode === 'dark' ? darkMapStyle(colors) : []}
        ref={mapRef}
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={handleMapLongPress}
        showsUserLocation={Boolean(userLocation)}
        showsMyLocationButton={false}
      >
        {/* Wine regions (Pro): AVA outlines under the pins. Rendered first and
            with a low zIndex so markers stay on top and tappable. Keys are the
            region id plus part index, stable across pans. */}
        {regionPolygons.map(({ key, coordinates, holes, feature }) => {
          const selected = selectedRegion?.id === feature.id;
          return (
            <Polygon
              key={key}
              coordinates={coordinates}
              holes={holes.length ? holes : undefined}
              {...regionStyle(colors, mode, { selected })}
              zIndex={selected ? 2 : 1}
              tappable
              onPress={(event) => handleRegionPress(event, feature)}
            />
          );
        })}

        {/* Region names at the centroid (#275): answers "which region is
            this?" without a tap. Static views, so no tracking on iOS; Android
            needs tracksViewChanges for custom marker views to paint at all. */}
        {zoom >= WINE_REGION_LABEL_ZOOM &&
          visibleRegions.map((feature) => (
            <Marker
              key={`region-label-${feature.id}`}
              coordinate={regionCenter(feature)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'android'}
              zIndex={3}
              onPress={() => selectRegion(feature)}
            >
              <View style={styles.regionLabel} pointerEvents="none">
                <Text style={styles.regionLabelText} numberOfLines={2}>
                  {feature.name}
                </Text>
              </View>
            </Marker>
          ))}

        {/* User + discovery pins, clustered (#224): overlapping pins collapse
            into count bubbles until you zoom in; tap a bubble to expand. */}
        {renderedFeatures.map((f) => {
          if (f.properties.cluster) return renderClusterMarker(f);
          const [longitude, latitude] = f.geometry.coordinates;
          const displayCoordinate = { latitude, longitude };
          return f.properties.kind === 'discover'
            ? renderDiscoverMarker(f.properties.pin, labelledKeys.has(featureKey(f)), displayCoordinate)
            : renderPinMarker(f.properties.pin, labelledKeys.has(featureKey(f)), displayCoordinate);
        })}

        {tempPin && (
          <Marker
            coordinate={tempPin}
            pinColor={colors.primary.base}
          />
        )}
      </MapView>

      {/* Search stays available before the first saved or visited winery. */}
      {(
        <TouchableOpacity
          style={styles.searchPill}
          activeOpacity={0.85}
          onPress={() => {
            // Directory search is available even before saving a first place.
            setListTab('find');
            setWelcomeDismissed(true);
            setShowHelpHint(false);
            setShowPlacesList(true);
          }}
        >
          <Ionicons name="search" size={18} color={colors.neutral.inkTertiary} />
          <Text style={styles.searchPillText} numberOfLines={1}>
            Search wineries &amp; your places
          </Text>
          {/* Quiet loading state (#277): the list icon becomes a spinner
              while a directory fetch outlasts the grace period. */}
          {discoveryBusy ? (
            <ActivityIndicator
              size="small"
              color={colors.primary.ink}
              accessibilityLabel="Loading wineries"
            />
          ) : (
            <Ionicons name="list" size={18} color={colors.primary.ink} />
          )}
        </TouchableOpacity>
      )}

      {/* Pin filter chips: All · Visited · Wishlist · Nearby, on every plan. */}
      <View
        style={[
          styles.filterChips,
          { top: 112 },
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
            </TouchableOpacity>
          );
        })}
        {/* Layers (wine regions). Icon-only so the row still fits a small phone;
            it lights up while the layer is on. */}
        <TouchableOpacity
          style={[styles.filterChip, styles.layersChip, showWineRegions && styles.filterChipActive]}
          activeOpacity={0.85}
          onPress={() => setShowLayersSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Map layers"
          accessibilityHint="Wine regions"
          accessibilityState={{ selected: showWineRegions }}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={showWineRegions ? colors.onPrimary : colors.neutral.ink}
          />
        </TouchableOpacity>
      </View>

      {/* Pin legend (#274) */}
      {showLegend && (
        <View style={styles.legend} accessibilityRole="text" accessibilityLabel="Pin legend">
          {[
            ['visited', 'Visited'],
            ['wishlist', 'Wishlist'],
            ['pin', 'Your pin'],
            ['nearby', 'Nearby'],
          ].map(([key, label]) => (
            <View key={key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  key === 'visited' && { backgroundColor: colors.status.visited },
                  key === 'wishlist' && { backgroundColor: colors.status.wishlist },
                  key === 'pin' && { backgroundColor: colors.primary.base },
                  key === 'nearby' && styles.legendDotHollow,
                ]}
              />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      )}

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
          color={colors.onPrimary}
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
              <Ionicons name="wine" size={18} color={colors.onPrimary} />
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
              <Ionicons name="bookmark" size={18} color={colors.onStatus} />
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
              <Ionicons name="location" size={18} color={colors.onStatus} />
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
        style={[styles.locationButton, locating && styles.controlButtonDisabled]}
        onPress={zoomToUserLocation}
        disabled={locating}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Center on my location"
        accessibilityState={{ disabled: locating, busy: locating }}
      >
        <Ionicons name="locate" size={22} color={colors.primary.ink} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setShowHelpHint((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="How to use the map"
      >
        <Ionicons name="help" size={20} color={colors.primary.ink} />
      </TouchableOpacity>

      <View style={styles.mapNotices} pointerEvents="box-none">
        {/* GPS is optional. Preserve the detailed recovery path from #238
            while keeping #239's stacked map-status layout. */}
        {locationIssue && (
          <View style={styles.hintContainer} accessibilityRole="alert">
            <View style={styles.hintIcon}>
              <Ionicons name="location-outline" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.hintContent}>
              <Text style={styles.hintTitle}>{locationIssueContent.title}</Text>
              <Text style={styles.hintText}>{locationIssueContent.message}</Text>
              <TouchableOpacity
                onPress={openLocationHelp}
                disabled={locating}
                style={styles.hintAction}
                accessibilityRole="button"
                accessibilityState={{ disabled: locating, busy: locating }}
              >
                <Text style={styles.hintActionText}>{locationIssueContent.action}</Text>
                {!locating && (
                  <Ionicons name="arrow-forward" size={14} color={colors.accent.base} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setLocationIssue(null)}
              style={styles.hintDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss location message"
            >
              <Ionicons name="close" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {(showHelpHint || (pinsLoaded && !pinsError && userPins.length === 0 && !welcomeDismissed)) && (
          <View style={styles.hintContainer}>
            <View style={styles.hintContent}>
              <Text style={styles.hintTitle}>{showHelpHint ? 'Getting around' : 'Welcome'}</Text>
              <Text style={styles.hintText}>
                Search above, long-press the map to drop a pin, or tap + to log a visit.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setWelcomeDismissed(true); setShowHelpHint(false); }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss map help"
              style={styles.dismissHint}
            >
              <Ionicons name="close" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}
        {pinsError && (
          <TouchableOpacity onPress={loadUserPins} accessibilityRole="button">
            <Text style={styles.mapStatus}>Couldn’t load your places. Tap to retry.</Text>
          </TouchableOpacity>
        )}
        {showWineRegions && zoom < WINE_REGIONS_MIN_ZOOM && (
          <Text style={[styles.mapStatus, styles.zoomHint]} accessibilityRole="text">
            Zoom in to see wine regions
          </Text>
        )}
        {(pinFilter === 'all' || pinFilter === 'nearby') &&
          (discoveryStatus === 'error' || discoveryStatus === 'empty') && (
          <TouchableOpacity
            disabled={discoveryStatus !== 'error'}
            onPress={() => setDiscoveryRetry((value) => value + 1)}
            accessibilityRole={discoveryStatus === 'error' ? 'button' : 'text'}
          >
            <Text style={styles.mapStatus}>
              {discoveryStatus === 'error'
                ? 'Couldn’t load wineries. Tap to retry.'
                : 'No directory wineries in this area. Move the map or search by name.'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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

      <MapLayersSheet
        visible={showLayersSheet}
        onClose={() => setShowLayersSheet(false)}
        wineRegions={wineRegionsOn}
        onToggleWineRegions={handleToggleWineRegions}
        isPro={Boolean(isPro)}
        regionCount={regionsMeta().count}
      />

      <CellarOptionSheet
        visible={Boolean(regionChoices)}
        title="Which wine region?"
        options={(regionChoices ?? []).map((f) => ({ key: f.id, label: f.name }))}
        selected={selectedRegion?.id}
        onSelect={handleChooseRegion}
        onClose={() => setRegionChoices(null)}
      />

      <WineRegionSheet
        visible={showRegionSheet && Boolean(selectedRegion)}
        region={selectedRegion}
        onClose={() => setShowRegionSheet(false)}
        onClear={() => {
          setShowRegionSheet(false);
          setSelectedRegion(null);
        }}
        onPlanDay={handlePlanDayInRegion}
        onOpenWinery={(w) => {
          setShowRegionSheet(false);
          handleDiscoverPinPress(w);
        }}
      />

      {/* Searchable list of visited places (#101). The sheet keeps a fixed
          height and shrinks above the keyboard (#269): sized-to-content, a
          short list or the empty state sat entirely behind the keyboard, so
          typing looked like it made "your places" disappear. Dragging the
          list, tapping empty sheet space, or the return key puts the keyboard
          away; the scrim still closes the whole sheet. */}
      <Modal
        visible={showPlacesList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlacesList(false)}
      >
        <KeyboardAvoidingView
          style={styles.listOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.listBackdrop}
            activeOpacity={1}
            onPress={() => setShowPlacesList(false)}
          />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.listSheet}>
            <View style={styles.handle} />
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {listTab === 'find' ? 'Find a winery' : 'Your places'}
              </Text>
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
                  setListTab('find');
                }}
              >
                <Text style={[styles.segmentText, listTab === 'find' && styles.segmentTextActive]}>
                  Find
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
                onSubmitEditing={Keyboard.dismiss}
                selectionColor={colors.primary.ink}
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
              keyboardDismissMode="on-drag"
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
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
                        color={listTab === 'wishlist' ? colors.status.wishlist : colors.primary.ink}
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
                      ? searchStatus === 'loading'
                        ? 'Searching wineries…'
                        : searchStatus === 'error'
                        ? 'Couldn’t search wineries. Edit your search to try again.'
                        : placeSearch.trim().length >= 2
                        ? 'No wineries match that name'
                        : 'Type a winery name, or browse the gold pins on the map'
                      : placeSearch.trim()
                      ? 'No matches for your search'
                      : listTab === 'wishlist'
                      ? 'No saved wineries yet. Add some from the map or the ＋ menu'
                      : 'No visited places yet'}
                  </Text>
                </View>
              }
            />
          </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// How far the floating map controls sit above the bottom of the MapView, which
// is also the top of the tab bar. Only needs to clear Apple's attribution row
// (~16pt tall, bottom-left); the previous 64 left a band of dead map between the
// controls and the tab bar and pushed them out of comfortable thumb reach.
const MAP_CONTROL_BOTTOM = 32;




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius, mode } = theme;

const SERIF = typography.fonts.serif;

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
  // Wine-region centroid labels (#275). Translucent so the basemap and the
  // outline read through; the hue matches the polygon stroke for its mode.
  regionLabel: {
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: withAlpha(colors.neutral.bg, mode === 'dark' ? 0.72 : 0.82),
  },
  regionLabelText: {
    fontFamily: SERIF,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    color: mode === 'dark' ? colors.accent.base : colors.primary.base,
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
  closedMarker: {
    backgroundColor: colors.neutral.inkTertiary,
  },
  // Small white check at the top-right of a visited pin (#274).
  visitedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.status.visited,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legend under the filter chips (#274).
  legend: {
    position: 'absolute',
    top: 156,
    left: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: withAlpha(colors.neutral.bg, 0.92),
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    ...shadows.soft,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotHollow: {
    borderWidth: 2,
    borderColor: colors.accent.base,
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral.inkSecondary,
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
  controlButtonDisabled: {
    opacity: 0.55,
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
  filterChipTextActive: { color: colors.onPrimary },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  layersChip: { marginLeft: 'auto', paddingHorizontal: spacing.sm, width: 34, justifyContent: 'center' },
  zoomHint: { alignSelf: 'center', overflow: 'hidden', ...shadows.soft },
  // The outlined glass differentiates a directory place from a user's saved
  // pin while keeping the purple singleton treatment requested in testing.
  discoverMarker: {
    backgroundColor: colors.primary.base,
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
  // flex + maxHeight: the sheet always takes 75% of the window, or whatever
  // is left above the keyboard, whichever is less (#269).
  listSheet: {
    flex: 1,
    maxHeight: '75%',
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
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
    color: colors.onPrimary,
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
  // Lets the empty state and short lists catch the tap-to-dismiss.
  listContent: {
    flexGrow: 1,
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
  mapNotices: {
    position: 'absolute',
    top: 152,
    left: 16,
    right: 16,
    gap: 8,
  },
  mapStatus: {
    ...typography.body.small,
    color: colors.neutral.ink,
    backgroundColor: colors.neutral.bg,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  dismissHint: { padding: 10 },
  hintContainer: {
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
    backgroundColor: colors.overlay.onImage,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  hintContent: {
    flex: 1,
  },
  hintTitle: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '600',
    fontFamily: SERIF,
    marginBottom: 2,
  },
  hintText: {
    ...typography.body.small,
    color: colors.journey.secondary,
  },
  hintAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 24,
  },
  hintActionText: {
    ...typography.body.small,
    color: colors.accent.base,
    fontWeight: '700',
  },
  hintDismiss: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 32,
    height: 32,
  },
});
return { colors, styles };
});
