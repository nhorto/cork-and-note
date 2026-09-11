// app/winery/[id].js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PastVisitsSection from '../../components/PastVisitsSection';
import ReportWineryModal from '../../components/ReportWineryModal';
import ScreenHeader from '../../components/ScreenHeader';
import WineryActionButtons from '../../components/WineryActionButtons';
import WineryGoogleCard from '../../components/WineryGoogleCard';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import { hasDirections, openDirections } from '../../lib/directions';
import { wineriesService } from '../../lib/wineries';
import { wineryDirectoryService } from '../../lib/wineryDirectory';
import { wineryStatusService } from '../../lib/wineryStatus';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


// A directory preview route: /winery/dir-<winery_directory.id>.
const PREVIEW_ROUTE = /^dir-(\d+)$/;

// Shape a winery_directory row like a wineries row so the page renders either.
const previewFromDirectory = (row) => ({
  id: null,
  directory_id: row.id,
  name: row.name,
  address: [row.city, row.state].filter(Boolean).join(', ') || row.address || null,
  latitude: row.latitude,
  longitude: row.longitude,
  website: row.website ?? null,
  google_place_id: row.google_place_id ?? null,
  operatingStatus: row.operating_status ?? null,
});

export default function WineryDetail() {
  const { colors, styles } = useScreenTheme();

  // Two kinds of page (#270):
  //   /winery/<id>       one of YOUR wineries: badges, wishlist, past visits;
  //   /winery/dir-<id>   a PREVIEW of a directory winery you haven't saved.
  // Browsing never creates a wineries row any more; Log visit and Add to
  // wishlist are the actions that do, and they carry the directory link.
  // The legacy ?directoryId= param is still honoured for saved pages opened
  // by older code paths.
  const { id: rawId, directoryId: directoryIdParam } = useLocalSearchParams();
  const previewMatch = PREVIEW_ROUTE.exec(String(rawId ?? ''));
  const previewDirectoryId = previewMatch ? Number(previewMatch[1]) : null;
  const isPreview = previewDirectoryId != null;
  const id = isPreview ? null : rawId;
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);

  const [winery, setWinery] = useState(null);
  const [wineryLoading, setWineryLoading] = useState(true);
  const [wineryStatus, setWineryStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [website, setWebsite] = useState(null);

  const directoryId =
    previewDirectoryId
    ?? winery?.directory_id
    ?? (/^\d+$/.test(String(directoryIdParam ?? '')) ? Number(directoryIdParam) : null);

  useEffect(() => {
    let active = true;
    setWebsite(null);
    if (winery && (isPreview || String(winery.id) === String(id))) {
      wineryDirectoryService.getWebsite({ ...winery, directoryId }).then((url) => {
        if (active) setWebsite(url);
      });
    }
    return () => { active = false; };
  }, [id, winery, directoryId, isPreview]);

  useEffect(() => {
    let active = true;
    const fetchWinery = async () => {
      try {
        setWineryLoading(true);
        if (isPreview) {
          // Already one of yours? Show your page (notes, visits) instead.
          const linked = await wineriesService.getWineryByDirectoryId(previewDirectoryId);
          if (!active) return;
          if (linked.winery) {
            router.replace(`/winery/${linked.winery.id}`);
            return;
          }
          const { success, winery: row } = await wineryDirectoryService.getById(previewDirectoryId);
          if (active && success && row) setWinery(previewFromDirectory(row));
          return;
        }
        const { success, winery: data } = await wineriesService.getWinery(id);
        if (active && success && data) {
          setWinery(data);
        }
      } catch (error) {
        console.error('Error fetching winery:', error);
      } finally {
        if (active) setWineryLoading(false);
      }
    };

    if (isPreview || id) {
      fetchWinery();
    }
    return () => { active = false; };
  }, [id, isPreview, previewDirectoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to a preview after logging a visit: the save created your
  // winery row (linked to this directory id), so swap to your page.
  useFocusEffect(
    useCallback(() => {
      if (!isPreview || !winery) return undefined;
      let active = true;
      wineriesService.getWineryByDirectoryId(previewDirectoryId).then((res) => {
        if (active && res.winery) router.replace(`/winery/${res.winery.id}`);
      });
      return () => { active = false; };
    }, [isPreview, previewDirectoryId, winery]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (user && winery?.id != null) {
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
  // (#21), pre-filled with this winery so its place/pin seeds the session. A
  // preview passes the directory id instead of a winery id: the row is
  // created (and linked) only when the visit is actually saved, so backing
  // out of the form leaves nothing behind.
  const handleLogVisit = () => {
    router.push({
      pathname: '/log-session',
      params: {
        mode: 'winery',
        ...(winery.id != null ? { wineryId: winery.id } : {}),
        ...(directoryId != null ? { directoryId: String(directoryId) } : {}),
        wineryName: winery.name,
        ...(winery.latitude != null && winery.longitude != null
          ? { lat: String(winery.latitude), lng: String(winery.longitude) }
          : {}),
      },
    });
  };

  // Wishlist on a preview: saving is the explicit action that creates your
  // winery row (linked to the directory), then the page becomes yours.
  const resolveWineryId = async () => {
    if (winery.id != null) return winery.id;
    const res = await wineriesService.findOrCreateWinery({
      name: winery.name,
      latitude: winery.latitude,
      longitude: winery.longitude,
      address: winery.address,
      directoryId,
    });
    if (!res.success || !res.winery) throw new Error(res.error || 'Could not save this winery');
    return res.winery.id;
  };
  const handleSavedToWishlist = (newId) => {
    if (winery.id == null && newId != null) router.replace(`/winery/${newId}`);
  };

  const closedLabel =
    winery?.operatingStatus === 'permanently_closed'
      ? 'Permanently closed'
      : winery?.operatingStatus === 'temporarily_closed'
        ? 'Temporarily closed'
        : null;

  const handleStatusChange = (newStatus) => {
    setWineryStatus(prev => ({ ...prev, ...newStatus }));
  };

  // Directions are only offered when the winery actually has coordinates; a
  // hand-added winery saved without a pin used to open Apple Maps at null,null.
  const canNavigate = hasDirections(winery);

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
              <Ionicons name="wine" size={28} color={colors.primary.ink} />
            </View>
            <View style={styles.decorativeLine} />
          </View>

          <Text style={styles.wineryName}>{winery.name}</Text>
          {winery.address && (
            <Text style={styles.wineryAddress}>{winery.address}</Text>
          )}

          {/* Closed (#273): known from the directory, so every plan sees it. */}
          {closedLabel && (
            <View
              style={[styles.closedBadge, winery.operatingStatus === 'temporarily_closed' && styles.closedBadgeTemporary]}
              accessibilityRole="text"
            >
              <Ionicons name="close-circle" size={14} color={colors.onStatus} />
              <Text style={styles.closedBadgeText}>{closedLabel}</Text>
            </View>
          )}

          {/* Status badges */}
          {user && wineryStatus && !statusLoading && (
            <View style={styles.badgesContainer}>
              <WineryStatusBadges status={wineryStatus} />
            </View>
          )}
          {isPreview && (
            <Text style={styles.previewCaption}>
              Not in your places yet. Log a visit or save it to keep it.
            </Text>
          )}
        </View>

        {/* Main Content Card */}
        <View style={styles.contentCard}>
          {/* Action buttons */}
          {user && (
            <WineryActionButtons
              winery={winery}
              initialStatus={isPreview ? { isWantToVisit: false } : wineryStatus}
              onStatusChange={handleStatusChange}
              resolveWineryId={resolveWineryId}
              onSaved={handleSavedToWishlist}
              closed={winery.operatingStatus === 'permanently_closed'}
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
                <Ionicons name="wine" size={22} color={colors.onPrimary} />
              </View>
              <Text style={styles.actionLabel}>Log visit</Text>
            </TouchableOpacity>

            {canNavigate && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => openDirections(winery)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.status.visited }]}>
                  <Ionicons name="navigate" size={22} color={colors.onStatus} />
                </View>
                <Text style={styles.actionLabel}>Directions</Text>
              </TouchableOpacity>
            )}
            {website && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => Linking.openURL(website).catch(() =>
                  Alert.alert('Could not open website', 'Please try again.')
                )}
                accessibilityRole="link"
                accessibilityLabel="Winery website"
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary.base }]}>
                  <Ionicons name="globe-outline" size={22} color={colors.onPrimary} />
                </View>
                <Text style={styles.actionLabel}>Website</Text>
              </TouchableOpacity>
            )}
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
            directoryId={directoryId}
            onPlaceIdSaved={(placeId) =>
              setWinery((prev) => (prev ? { ...prev, google_place_id: placeId } : prev))
            }
          />

          {/* Report a problem (#225) — a quiet, secondary escape hatch that
              feeds the directory-freshness queue (winery_reports). */}
          {user && (
            <TouchableOpacity
              style={styles.reportRow}
              onPress={() => setReportVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Report a problem with this winery"
            >
              <Ionicons name="flag-outline" size={14} color={colors.neutral.inkTertiary} />
              <Text style={styles.reportRowText}>Report a problem</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Past Visits Section (saved wineries only; a preview has none) */}
        {user && !isPreview && (
          <View style={styles.pastVisitsContainer}>
            <PastVisitsSection wineryId={id} wineryName={winery?.name} />
          </View>
        )}
      </ScrollView>

      <ReportWineryModal
        visible={reportVisible}
        winery={winery}
        directoryId={directoryId}
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

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
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  closedBadgeTemporary: {
    backgroundColor: colors.neutral.inkTertiary,
  },
  closedBadgeText: {
    ...typography.body.small,
    fontWeight: '600',
    color: colors.onStatus,
  },
  previewCaption: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
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

  // Report a problem (#225) — quiet by design, subordinate to everything else
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    marginTop: spacing.md,
  },
  reportRowText: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
  },

  // Past Visits Container
  pastVisitsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
return { colors, styles };
});
