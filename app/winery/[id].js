// app/winery/[id].js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import WineryActionButtons from '../../components/WineryActionButtons';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import { wineriesService } from '../../lib/wineries';
import { wineryStatusService } from '../../lib/wineryStatus';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

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
            <Ionicons name="wine-outline" size={32} color={colors.gold.muted} />
          </View>
          <Text style={styles.loadingText}>Loading winery...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!winery) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.neutral.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Winery</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="wine-outline" size={48} color={colors.gold.muted} />
          </View>
          <Text style={styles.emptyTitle}>Winery Not Found</Text>
          <Text style={styles.emptySubtitle}>This winery may have been removed</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{winery.name}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroDecoration}>
            <View style={styles.decorativeLine} />
            <View style={styles.heroIcon}>
              <Ionicons name="wine" size={28} color={colors.primary.burgundy} />
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
              <View style={[styles.actionIcon, { backgroundColor: colors.primary.burgundy }]}>
                <Ionicons name="wine" size={22} color={colors.neutral.cream} />
              </View>
              <Text style={styles.actionLabel}>Log Visit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={openDirections}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.status.visited }]}>
                <Ionicons name="navigate" size={22} color={colors.neutral.cream} />
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

          {/* About Section */}
          <View style={styles.aboutSection}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.aboutText}>
              Discover this winery and experience their selection of wines.
              {winery.region && ` Located in the ${winery.region} region.`}
            </Text>
          </View>
        </View>

        {/* Past Visits Section */}
        {user && (
          <View style={styles.pastVisitsContainer}>
            <PastVisitsSection wineryId={id} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
    backgroundColor: colors.neutral.cream,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  headerTitle: {
    flex: 1,
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  headerSpacer: {
    width: 40,
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
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  loadingText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
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
    backgroundColor: colors.gold.muted,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.gold.muted,
  },
  wineryName: {
    ...typography.heading.hero,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  wineryAddress: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
  },
  badgesContainer: {
    marginTop: spacing.md,
  },

  // Content Card
  contentCard: {
    backgroundColor: colors.neutral.parchment,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
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
    color: colors.neutral.charcoal,
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
    backgroundColor: colors.gold.muted,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold.rich,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },

  // About Section
  aboutSection: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
    marginBottom: spacing.sm,
  },
  aboutText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    lineHeight: 24,
  },

  // Past Visits Container
  pastVisitsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
