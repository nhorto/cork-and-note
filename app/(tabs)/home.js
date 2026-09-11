// app/(tabs)/home.js - Home / overview landing
// Château Label Design - Elegant & Refined
// "Passport" layout (epic #203, Home A): leads with Your Journey — where
// you've been — then Tonight's Pick and the cellar. The Near You row
// slots in under the Journey card when Google winery enrichment ships
// (Phase 2). Logging moved to the floating "＋ Log" pill; the sommelier is a
// first-class tab now, so neither needs a home card anymore.
// Shell screen: degrades gracefully when there is no data / no backend yet.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useContext, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AskSommelierBox from '../../components/AskSommelierBox';
import LogFab from '../../components/LogFab';
import NearYouRow from '../../components/NearYouRow';
import UpgradePill from '../../components/UpgradePill';
import { drinkWindowMeta, cellarService } from '../../lib/cellar';
import { getCellarInsights } from '../../lib/cellarInsights';
import { varietalText } from '../../lib/varietals';
import { visitsService } from '../../lib/visits';
import { wishlistService } from '../../lib/wishlist';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


export default function HomeScreen() {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [stats, setStats] = useState({ wines: 0, places: 0, wishlist: 0 });
  const [cellar, setCellar] = useState({ totalBottles: 0, readyToDrink: 0, byStatus: null });
  const [insights, setInsights] = useState(null);
  const [recent, setRecent] = useState([]);
  const [highlights, setHighlights] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // True when every critical fetch failed — the account isn't empty, the
  // backend is unreachable. Drives the inline error banner below.
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by the banner's Retry action to re-run the focus load below.
  const [reloadKey, setReloadKey] = useState(0);

  // Reload whenever the tab gains focus. All calls are defensive: if the
  // backend is unavailable, we simply show zeros and an empty state.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      // The tab navigator can focus Home while RootLayout is still restoring
      // the persisted Supabase session. Starting user-scoped reads in that
      // window produces a misleading "User not authenticated" development
      // error even though AuthContext becomes authenticated moments later.
      // user.id is a dependency, so restoration immediately starts the load.
      if (!user?.id) {
        return () => {
          active = false;
        };
      }

      (async () => {
        try {
          const [visitsRes, wishRes, cellarRes, insightsRes] = await Promise.all([
            visitsService.getUserVisits().catch(() => ({ success: false })),
            wishlistService.getUserWishlist().catch(() => ({ success: false })),
            cellarService.getCellarStats().catch(() => ({ success: false })),
            getCellarInsights().catch(() => ({ success: false })),
          ]);
          if (!active) return;

          // If every critical load failed, surface the error banner instead of
          // pretending the account is empty.
          setLoadFailed(
            [visitsRes, wishRes, cellarRes].every((r) => !r?.success)
          );

          const visits = visitsRes?.visits ?? [];
          const visitStats = visitsService.summarizeVisitStats(visits);
          setStats({
            wines: visitStats.totalWines,
            places: visitStats.totalWineries,
            wishlist: wishRes?.wishlist?.length ?? wishRes?.items?.length ?? 0,
          });

          setCellar({
            totalBottles: cellarRes?.stats?.totalBottles ?? 0,
            readyToDrink: cellarRes?.stats?.readyToDrink ?? 0,
            byStatus: cellarRes?.stats?.byStatus ?? null,
          });

          // Insights highlight for the "at a glance" entry card (#56). Defensive:
          // any failure simply hides the card.
          setInsights(insightsRes?.success ? insightsRes.insights : null);

          // Flatten the most recent wines across recent visits.
          const items = [];
          for (const visit of visits) {
            for (const wine of visit.wines ?? []) {
              items.push({
                id: wine.id,
                name: wine.wine_name || varietalText(wine.wine_varietal) || 'Wine',
                detail: [visit.wineries?.name, wine.wine_year]
                  .filter(Boolean)
                  .join(' · ') || 'No location',
                rating: wine.overall_rating,
              });
              if (items.length >= 4) break;
            }
            if (items.length >= 4) break;
          }
          setRecent(items);

          // Journey highlights: most-recent place, most-visited winery, total
          // places. Derived from the same visits (#95).
          setHighlights(visitsService.summarizeVisits(visits));
        } catch {
          // ignore — empty states will render
        } finally {
          if (active) setLoaded(true);
        }
      })();
      return () => {
        active = false;
      };
    }, [reloadKey, user?.id])
  );

  const firstName =
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const initials = (
    user?.user_metadata?.name?.[0] ||
    user?.email?.[0] ||
    'W'
  ).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcome}>WELCOME BACK</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Standing paywall route for free users (owner ask 2026-09-10);
                renders nothing for Pro. */}
            <UpgradePill />
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile & settings"
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerBorder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Load-failure banner — shown when every critical fetch failed. */}
        {loadFailed && (
          <TouchableOpacity
            style={styles.errorBanner}
            activeOpacity={0.85}
            onPress={() => setReloadKey((k) => k + 1)}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.primary.ink} />
            <Text style={styles.errorBannerText}>Couldn&apos;t load your data</Text>
            <Text style={styles.errorBannerAction}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* Your Journey — the passport card. Where you've been, at a glance,
            with the stat links folded in (Wines → journal list, Places → list
            screen rather than the map (#170 item 2), Wishlist → wishlist). */}
        <JourneyCard
          stats={stats}
          highlights={highlights}
          onOpenMap={() => router.push('/(tabs)/map')}
          onPressWines={() => router.push('/wines')}
          onPressPlaces={() => router.push('/places')}
          onPressWishlist={() => router.push('/wishlist')}
        />

        {/* Near You — free winery discovery from our own directory (#203 P2).
            Hides itself entirely when location is denied or nothing is near. */}
        <NearYouRow />

        {/* Ask the sommelier — a real input, not a card (owner feedback
            2026-09-09: Tonight's Pick moved to the Somm tab and the Cellar;
            Home's job is starting a conversation). Submitting hands the
            question to the Somm tab via ?ask=…, which opens a fresh chat and
            sends it. */}
        <AskSommelierBox
          onAsk={(question) =>
            router.push({ pathname: '/(tabs)/sommelier', params: { ask: question } })
          }
          onOpen={() => router.push('/(tabs)/sommelier')}
          onOpenWineList={() => router.push('/sommelier/wine-list')}
          showActions
        />

        {/* Ready-to-Drink strip — first-class drink-window surface (R4 / #54).
            Per-status counts tap through to the cellar pre-filtered to that status. */}
        <ReadyToDrinkStrip
          byStatus={cellar.byStatus}
          onPressStatus={(status) =>
            router.push({ pathname: '/(tabs)/cellar', params: { status } })
          }
        />

        {/* Cellar summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>YOUR CELLAR</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/cellar')}>
            <Text style={styles.sectionAction}>Open</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.cellar}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/cellar')}
        >
          <View style={styles.cellarIcon}>
            <Ionicons name="file-tray-stacked-outline" size={22} color={colors.primary.ink} />
          </View>
          <View style={styles.cellarMeta}>
            <Text style={styles.cellarTitle}>
              {cellar.totalBottles > 0
                ? `${cellar.totalBottles} bottle${cellar.totalBottles === 1 ? '' : 's'} in your cellar`
                : 'Start your cellar'}
            </Text>
            <Text style={styles.cellarSub}>
              {cellar.totalBottles > 0
                ? cellar.readyToDrink > 0
                  ? `${cellar.readyToDrink} ready to drink`
                  : 'Track bottles & drink windows'
                : 'Track the bottles you own'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary.ink} />
        </TouchableOpacity>

        {/* Collection at a glance — compact insights entry (R6 / #56). Shows 1–2
            highlights and taps through to the full dashboard. Hidden until there's
            a cellar to summarize. */}
        <InsightsEntryCard
          insights={insights}
          onPress={() => router.push('/cellar/insights')}
        />

        {/* Recent */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RECENT</Text>
          <TouchableOpacity onPress={() => router.push('/wines')}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        {recent.length > 0 ? (
          recent.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.wineCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/wine/${w.id}`)}
            >
              <View style={styles.wineGlass}>
                <Ionicons name="wine-outline" size={18} color={colors.primary.ink} />
              </View>
              <View style={styles.wineMeta}>
                <Text style={styles.wineName}>{w.name}</Text>
                <Text style={styles.wineDetail}>{w.detail}</Text>
              </View>
              {w.rating ? <Text style={styles.wineScore}>{w.rating}</Text> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.neutral.placeholder} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.empty}>
            <Ionicons name="wine-outline" size={26} color={colors.accent.strong} />
            <Text style={styles.emptyText}>
              {loaded ? 'No wines logged yet' : 'Loading…'}
            </Text>
            <Text style={styles.emptySub}>Tap “＋ Log” to start your journal.</Text>
          </View>
        )}
      </ScrollView>

      <LogFab />
    </View>
  );
}

// Compact relative date for the Journey card's last-visit line.
function timeAgo(dateString) {
  if (!dateString) return '';
  const then = new Date(dateString);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? '' : 's'} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m === 1 ? '' : 's'} ago`;
  }
  return then.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// The passport card: headline journey stats, the most recent visit, a map
// link, and the three stat links that used to be the stat strip. Empty state
// keeps the same silhouette with an invitation instead of numbers.
function JourneyCard({ stats, highlights, onOpenMap, onPressWines, onPressPlaces, onPressWishlist }) {
  const { colors, styles } = useScreenTheme();

  const hasJourney = stats.places > 0 || stats.wines > 0;
  const lastVisit = highlights?.mostRecentPlace;

  return (
    <View style={styles.journeyCard}>
      <Text style={styles.journeyLabel}>YOUR JOURNEY</Text>
      <Text style={styles.journeyTitle}>
        {hasJourney
          ? `${stats.places} ${stats.places === 1 ? 'winery' : 'wineries'} · ${stats.wines} ${stats.wines === 1 ? 'wine' : 'wines'}`
          : 'Your wine journey starts here'}
      </Text>
      <Text style={styles.journeySub} numberOfLines={1}>
        {lastVisit
          ? `Last visit: ${lastVisit.name} · ${timeAgo(lastVisit.date)}`
          : 'Every winery you visit goes on your map.'}
      </Text>
      <TouchableOpacity
        style={styles.journeyMapLink}
        activeOpacity={0.85}
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel="Open your map"
      >
        <Ionicons name="map-outline" size={16} color={colors.journey.accent} />
        <Text style={styles.journeyMapLinkText}>Open your map ›</Text>
      </TouchableOpacity>

      <View style={styles.journeyDivider} />
      <View style={styles.journeyStats}>
        <JourneyStat n={stats.wines} label="Wines ▸" onPress={onPressWines} />
        <JourneyStat n={stats.places} label="Places ▸" onPress={onPressPlaces} />
        <JourneyStat n={stats.wishlist} label="Wishlist ▸" onPress={onPressWishlist} />
      </View>
    </View>
  );
}

function JourneyStat({ n, label, onPress }) {
  const { styles } = useScreenTheme();

  return (
    <TouchableOpacity style={styles.journeyStat} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.journeyStatNum}>{n}</Text>
      <Text style={styles.journeyStatLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// First-class drink-window surface: one tappable tile per status (R4 / #54).
// Order = most-urgent-to-act first (Drink soon · Ready · Too young · Past peak).
const READY_STRIP_ORDER = ['drink_up', 'ready', 'too_young', 'past_peak'];

function ReadyToDrinkStrip({ byStatus, onPressStatus }) {
  const { colors, styles } = useScreenTheme();

  // Hide until we have counts and at least one bottle has a derived status.
  if (!byStatus) return null;
  const total = READY_STRIP_ORDER.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
  if (total === 0) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>READY TO DRINK</Text>
      </View>
      <View style={styles.rtdStrip}>
        {READY_STRIP_ORDER.map((status) => {
          const meta = drinkWindowMeta(status, colors);
          const count = byStatus[status] || 0;
          return (
            <TouchableOpacity
              key={status}
              style={styles.rtdTile}
              activeOpacity={count > 0 ? 0.85 : 1}
              disabled={count === 0}
              onPress={() => count > 0 && onPressStatus(status)}
            >
              <View style={[styles.rtdDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.rtdCount, count === 0 && styles.rtdCountMuted]}>{count}</Text>
              <Text style={styles.rtdLabel} numberOfLines={1}>{meta.short}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// Compact "collection at a glance" entry card (R6 / #56). Summarizes 1–2 highlights
// from the insights view-model and taps through to the full dashboard. Renders
// nothing until there's a non-empty cellar to describe.
function InsightsEntryCard({ insights, onPress }) {
  const { colors, styles } = useScreenTheme();

  if (!insights || insights.isEmpty) return null;

  // Highlight 1: the dominant type/region (whichever is more concentrated), so the
  // card says something specific rather than echoing the bottle count.
  const topType = insights.byType?.[0];
  const topRegion = insights.byRegion?.[0];
  const lead =
    topRegion && topType
      ? (topRegion.pct >= topType.pct ? topRegion : topType)
      : topRegion || topType;
  const leadIsUnknown = !lead || lead.label === 'Unknown';

  // Highlight 2: recent activity, when there is any.
  const opened = insights.trend?.total ?? 0;

  const highlight = !leadIsUnknown
    ? `Mostly ${lead.label} (${Math.round(lead.pct)}%)`
    : `${insights.summary.regions} region${insights.summary.regions === 1 ? '' : 's'} across your cellar`;
  const sub =
    opened > 0
      ? `${opened} opened in the last 6 months · See the breakdown`
      : 'See your collection broken down by type, region & vintage';

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>AT A GLANCE</Text>
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.sectionAction}>View</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.insights} activeOpacity={0.9} onPress={onPress}>
        <View style={styles.insightsIcon}>
          <Ionicons name="analytics-outline" size={22} color={colors.accent.strong} />
        </View>
        <View style={styles.insightsMeta}>
          <Text style={styles.insightsTitle}>{highlight}</Text>
          <Text style={styles.insightsSub} numberOfLines={1}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
      </TouchableOpacity>
    </>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.bg },

  header: { backgroundColor: colors.neutral.bg, paddingTop: 60 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  welcome: { ...typography.body.caption, color: colors.neutral.inkTertiary },
  name: {
    ...typography.heading.h1,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: SERIF,
    fontSize: 18,
    color: colors.primary.ink,
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.accent.border,
    marginHorizontal: spacing.lg,
  },

  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Load-failure banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  errorBannerText: { ...typography.body.small, color: colors.neutral.inkSecondary, flex: 1 },
  errorBannerAction: {
    ...typography.body.small,
    color: colors.primary.ink,
    fontWeight: '600',
  },

  // Your Journey — passport card
  journeyCard: {
    backgroundColor: colors.journey.bg,
    borderWidth: 1,
    borderColor: colors.journey.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  journeyLabel: { ...typography.body.caption, color: colors.journey.accent },
  journeyTitle: {
    fontFamily: SERIF,
    fontSize: 22,
    color: colors.journey.ink,
    marginTop: spacing.xs,
  },
  journeySub: { ...typography.body.small, color: colors.journey.secondary, marginTop: 2 },
  journeyMapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 32,
    marginTop: spacing.sm,
  },
  journeyMapLinkText: {
    ...typography.body.small,
    color: colors.journey.accent,
    fontWeight: '600',
  },
  journeyDivider: {
    height: 1,
    backgroundColor: colors.journey.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  journeyStats: { flexDirection: 'row', gap: spacing.sm },
  journeyStat: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  journeyStatNum: {
    fontFamily: SERIF,
    fontSize: 20,
    color: colors.journey.accent,
  },
  journeyStatLabel: { ...typography.body.caption, color: colors.journey.secondary, marginTop: 2 },

  // Tonight's pick hero
  tonightsPick: { marginTop: spacing.lg },

  // Ready-to-Drink strip (R4 / #54)
  rtdStrip: { flexDirection: 'row', gap: spacing.sm },
  rtdTile: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  rtdDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.xs },
  rtdCount: { fontFamily: SERIF, fontSize: 22, color: colors.neutral.ink },
  rtdCountMuted: { color: colors.neutral.placeholder },
  rtdLabel: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 2,
    fontSize: 11,
    textAlign: 'center',
  },

  // Cellar summary
  cellar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  cellarIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellarMeta: { flex: 1 },
  cellarTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  cellarSub: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 1 },

  // At-a-glance insights entry (R6 / #56)
  insights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  insightsIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsMeta: { flex: 1 },
  insightsTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  insightsSub: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 1 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.body.caption, color: colors.accent.ink },
  sectionAction: { ...typography.body.small, color: colors.primary.ink },

  // Wine card
  wineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  wineGlass: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineMeta: { flex: 1 },
  wineName: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  wineDetail: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 1 },
  wineScore: { fontFamily: SERIF, fontSize: 16, color: colors.primary.ink },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
    fontFamily: SERIF,
    marginTop: spacing.sm,
  },
  emptySub: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
});
return { colors, styles };
});
