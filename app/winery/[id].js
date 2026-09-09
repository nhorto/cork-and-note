// app/winery/[id].js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PastVisitsSection from '../../components/PastVisitsSection';
import ScreenHeader from '../../components/ScreenHeader';
import WineryActionButtons from '../../components/WineryActionButtons';
import WineryGoogleCard from '../../components/WineryGoogleCard';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import { wineriesService } from '../../lib/wineries';
import { wineryStatusService } from '../../lib/wineryStatus';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;
export default function WineryDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);

  const [winery, setWinery] = useState(null);
  const [wineryLoading, setWineryLoading] = useState(true);
  const [wineryStatus, setWineryStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const fetchWinery = async () => {
      try {
        setWineryLoading(true);
        const { success, winery: data } = await wineriesService.getWinery(id);
        if (success && data) {
          setWinery(data);
        }
      } catch (error) {
        console.error('Error fetching winery:', error);
      } finally {
        setWineryLoading(false);
      }
    };

    if (id) {
      fetchWinery();
    }
  }, [id]);

  useEffect(() => {
    if (user && winery) {
      loadWineryStatus();
    } else {
      setStatusLoading(false);
    }
  }, [user, winery?.id]);

  const loadWineryStatus = async () => {
    try {
      setStatusLoading(true);
      const { success, status } = await wineryStatusService.getWineryStatus(winery.id);
      if (success) {
        setWineryStatus(status);
      }
    } catch (error) {
      console.error('Error loading winery status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  // "Log Visit" now routes into the shared location-optional session flow
  // (#21), pre-filled with this winery so its place/pin seeds the session.
  const handleLogVisit = () => {
    router.push({
      pathname: '/log-session',
      params: {
        mode: 'winery',
        wineryId: winery.id,
        wineryName: winery.name,
        ...(winery.latitude != null && winery.longitude != null
          ? { lat: String(winery.latitude), lng: String(winery.longitude) }
          : {}),
      },
    });
  };

  const handleStatusChange = (newStatus) => {
    setWineryStatus(prev => ({ ...prev, ...newStatus }));
  };

  const openDirections = () => {
    const lat = winery.latitude;
    const lng = winery.longitude;
    const label = encodeURIComponent(winery.name || "Destination");

    if (Platform.OS === 'ios') {
      const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
      Linking.openURL(appleMapsUrl).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      });
    } else {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(googleMapsUrl).catch(() => {
        Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
      });
    }
  };

  // Loading state
  if (wineryLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="wine-outline" size={32} color={colors.accent.border} />
          </View>
          <Text style={styles.loadingText}>Loading winery...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!winery) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Winery" onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="wine-outline" size={48} color={colors.accent.border} />
          </View>
          <Text style={styles.emptyTitle}>Winery not found</Text>
          <Text style={styles.emptySubtitle}>This winery may have been removed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={winery.name} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroDecoration}>
            <View style={styles.decorativeLine} />
            <View style={styles.heroIcon}>
              <Ionicons name="wine" size={28} color={colors.primary.base} />
            </View>
            <View style={styles.decorativeLine} />
          </View>

          <Text style={styles.wineryName}>{winery.name}</Text>
          {winery.address && (
            <Text style={styles.wineryAddress}>{winery.address}</Text>
          )}

          {/* Status badges */}
          {user && wineryStatus && !statusLoading && (
            <View style={styles.badgesContainer}>
              <WineryStatusBadges status={wineryStatus} />
            </View>
          )}
        </View>

        {/* Main Content Card */}
        <View style={styles.contentCard}>
          {/* Action buttons */}
          {user && (
            <WineryActionButtons
              winery={winery}
              initialStatus={wineryStatus}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLogVisit}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary.base }]}>
                <Ionicons name="wine" size={22} color={colors.neutral.bg} />
              </View>
              <Text style={styles.actionLabel}>Log visit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={openDirections}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.status.visited }]}>
                <Ionicons name="navigate" size={22} color={colors.neutral.bg} />
              </View>
              <Text style={styles.actionLabel}>Directions</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDiamond} />
            <View style={styles.dividerLine} />
          </View>

          {/* Google enrichment (Pro, #203 Phase 2): live rating / hours /
              website, or a paywall teaser on free. Unlike the old canned
              ABOUT filler this is real data, and it degrades to nothing —
              your visits stay the content of this page (#170 item 7). */}
          <WineryGoogleCard
            winery={winery}
            onPlaceIdSaved={(placeId) =>
              setWinery((prev) => (prev ? { ...prev, google_place_id: placeId } : prev))
            }
          />
        </View>

        {/* Past Visits Section */}
        {user && (
          <View style={styles.pastVisitsContainer}>
            <PastVisitsSection wineryId={id} wineryName={winery?.name} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },

  // Scroll Content
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },

  // Center Container (loading/empty)
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  heroDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '70%',
    marginBottom: spacing.lg,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accent.border,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.accent.border,
  },
  wineryName: {
    ...typography.heading.hero,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  wineryAddress: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
  },
  badgesContainer: {
    marginTop: spacing.md,
  },

  // Content Card
  contentCard: {
    backgroundColor: colors.neutral.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.soft,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.body.small,
    color: colors.neutral.ink,
    fontWeight: '500',
  },

  // Section Divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accent.border,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.accent.base,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },

  // Past Visits Container
  pastVisitsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
