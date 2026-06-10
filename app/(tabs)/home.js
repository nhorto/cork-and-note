// app/(tabs)/home.js - Home / overview landing
// Château Label Design - Elegant & Refined
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
import TonightsPickCard from '../../components/TonightsPickCard';
import { DRINK_WINDOW_META, cellarService } from '../../lib/cellar';
import { getCellarInsights } from '../../lib/cellarInsights';
import { visitsService } from '../../lib/visits';
import { wishlistService } from '../../lib/wishlist';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [stats, setStats] = useState({ wines: 0, places: 0, wishlist: 0 });
  const [cellar, setCellar] = useState({ totalBottles: 0, readyToDrink: 0, byStatus: null });
  const [insights, setInsights] = useState(null);
  const [recent, setRecent] = useState([]);
  const [highlights, setHighlights] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Reload whenever the tab gains focus. All calls are defensive: if the
  // backend is unavailable, we simply show zeros and an empty state.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [statsRes, visitsRes, wishRes, cellarRes, insightsRes] = await Promise.all([
            visitsService.getVisitStats().catch(() => ({ success: false })),
            visitsService.getUserVisits().catch(() => ({ success: false })),
            wishlistService.getUserWishlist().catch(() => ({ success: false })),
            cellarService.getCellarStats().catch(() => ({ success: false })),
            getCellarInsights().catch(() => ({ success: false })),
          ]);
          if (!active) return;

          setStats({
            wines: statsRes?.stats?.totalWines ?? 0,
            places: statsRes?.stats?.totalWineries ?? 0,
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
          const visits = visitsRes?.visits ?? [];
          const items = [];
          for (const visit of visits) {
            for (const wine of visit.wines ?? []) {
              items.push({
                id: wine.id,
                name: wine.wine_name || wine.wine_varietal || 'Wine',
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

          // "Where you've been" at-a-glance highlights (#95): most-recent place,
          // most-visited winery, total places. Derived from the same visits.
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
    }, [])
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
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerBorder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stat strip — each counter taps through to its list (#96). */}
        <View style={styles.stats}>
          <Stat n={stats.wines} label="Wines" onPress={() => router.push('/wines')} />
          <Stat n={stats.places} label="Places" onPress={() => router.push('/(tabs)/map')} />
          <Stat n={stats.wishlist} label="Wishlist" onPress={() => router.push('/wishlist')} />
        </View>

        {/* Tonight's pick — AI sommelier grounded in the user's own cellar (#51) */}
        <View style={styles.tonightsPick}>
          <TonightsPickCard onRequireCellar={() => router.push('/cellar/add')} />
        </View>

        {/* Ready-to-Drink strip — first-class drink-window surface (R4 / #54).
            Per-status counts tap through to the cellar pre-filtered to that status. */}
        <ReadyToDrinkStrip
          byStatus={cellar.byStatus}
          onPressStatus={(status) =>
            router.push({ pathname: '/(tabs)/cellar', params: { status } })
          }
        />

        {/* Log a wine hero */}
        <TouchableOpacity
          style={styles.hero}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/log')}
        >
          <Ionicons name="wine" size={26} color={colors.gold.rich} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Log a wine</Text>
            <Text style={styles.heroSub}>Had something good? Capture it.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gold.rich} />
        </TouchableOpacity>

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
            <Ionicons name="file-tray-stacked-outline" size={22} color={colors.primary.burgundy} />
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
          <Ionicons name="chevron-forward" size={20} color={colors.primary.burgundy} />
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
                <Ionicons name="wine-outline" size={18} color={colors.primary.burgundy} />
              </View>
              <View style={styles.wineMeta}>
                <Text style={styles.wineName}>{w.name}</Text>
                <Text style={styles.wineDetail}>{w.detail}</Text>
              </View>
              {w.rating ? <Text style={styles.wineScore}>{w.rating}</Text> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.neutral.silver} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.empty}>
            <Ionicons name="wine-outline" size={26} color={colors.gold.shimmer} />
            <Text style={styles.emptyText}>
              {loaded ? 'No wines logged yet' : 'Loading…'}
            </Text>
            <Text style={styles.emptySub}>Tap “Log a wine” to start your journal.</Text>
          </View>
        )}

        {/* Where you've been → Explore. Shows at-a-glance stats (most-recent
            place, most-visited winery, total places) once there's a place to
            describe, otherwise a simple map teaser (#95). */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>WHERE YOU&apos;VE BEEN</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.sectionAction}>Explore</Text>
          </TouchableOpacity>
        </View>
        <WhereYouveBeen
          highlights={highlights}
          onPress={() => router.push('/(tabs)/map')}
        />

        {/* Sommelier */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>SOMMELIER</Text>
        </View>
        <TouchableOpacity
          style={styles.somm}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/sommelier')}
        >
          <Ionicons name="sparkles" size={22} color={colors.gold.shimmer} />
          <View style={styles.sommText}>
            <Text style={styles.sommTitle}>Ask your Sommelier</Text>
            <Text style={styles.sommSub}>Personalized to the wines you&apos;ve rated</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gold.shimmer} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Stat({ n, label, onPress }) {
  return (
    <TouchableOpacity
      style={styles.stat}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// Compact relative date for the "where you've been" highlights.
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

// "Where you've been" card. Renders at-a-glance stats when the user has visited
// at least one real place, otherwise a simple map teaser. The whole card taps
// through to the map (#95).
function WhereYouveBeen({ highlights, onPress }) {
  const hasPlaces = highlights && highlights.totalPlaces > 0;

  return (
    <TouchableOpacity
      style={hasPlaces ? styles.whereCard : styles.teaser}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {hasPlaces ? (
        <>
          {highlights.mostRecentPlace && (
            <WhereRow
              icon="time-outline"
              label="Most recent"
              value={`${highlights.mostRecentPlace.name} · ${timeAgo(highlights.mostRecentPlace.date)}`}
            />
          )}
          {highlights.topWinery && highlights.topWinery.visits > 1 && (
            <WhereRow
              icon="star-outline"
              label="Most visited"
              value={`${highlights.topWinery.name} · ${highlights.topWinery.visits} visits`}
            />
          )}
          <WhereRow
            icon="map-outline"
            label="On your map"
            value={`${highlights.totalPlaces} place${highlights.totalPlaces === 1 ? '' : 's'} explored`}
            showChevron
          />
        </>
      ) : (
        <>
          <Ionicons name="map-outline" size={28} color={colors.primary.burgundy} />
          <Text style={styles.teaserText}>Your map of places</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function WhereRow({ icon, label, value, showChevron }) {
  return (
    <View style={styles.whereRow}>
      <View style={styles.whereIcon}>
        <Ionicons name={icon} size={18} color={colors.primary.burgundy} />
      </View>
      <View style={styles.whereText}>
        <Text style={styles.whereLabel}>{label}</Text>
        <Text style={styles.whereValue} numberOfLines={1}>{value}</Text>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.neutral.silver} />
      )}
    </View>
  );
}

// First-class drink-window surface: one tappable tile per status (R4 / #54).
// Order = most-urgent-to-act first (Drink soon · Ready · Too young · Past peak).
const READY_STRIP_ORDER = ['drink_up', 'ready', 'too_young', 'past_peak'];

function ReadyToDrinkStrip({ byStatus, onPressStatus }) {
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
          const meta = DRINK_WINDOW_META[status];
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
          <Ionicons name="analytics-outline" size={22} color={colors.gold.shimmer} />
        </View>
        <View style={styles.insightsMeta}>
          <Text style={styles.insightsTitle}>{highlight}</Text>
          <Text style={styles.insightsSub} numberOfLines={1}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gold.shimmer} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },

  header: { backgroundColor: colors.neutral.cream, paddingTop: 60 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  welcome: { ...typography.body.caption, color: colors.neutral.pewter },
  name: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Georgia',
    fontSize: 18,
    color: colors.primary.burgundy,
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginHorizontal: spacing.lg,
  },

  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Stat strip
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  // Tonight's pick hero
  tonightsPick: { marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: 'Georgia',
    fontSize: 24,
    color: colors.primary.burgundy,
  },
  statLabel: { ...typography.body.caption, color: colors.neutral.pewter, marginTop: 4 },

  // Ready-to-Drink strip (R4 / #54)
  rtdStrip: { flexDirection: 'row', gap: spacing.sm },
  rtdTile: {
    flex: 1,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  rtdDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.xs },
  rtdCount: { fontFamily: 'Georgia', fontSize: 22, color: colors.neutral.charcoal },
  rtdCountMuted: { color: colors.neutral.silver },
  rtdLabel: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
    fontSize: 11,
    textAlign: 'center',
  },

  // Hero CTA
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadows.medium,
  },
  heroText: { flex: 1 },
  heroTitle: {
    ...typography.heading.h3,
    color: colors.neutral.cream,
    fontFamily: 'Georgia',
  },
  heroSub: { ...typography.body.small, color: colors.primary.rosé, marginTop: 2 },

  // Cellar summary
  cellar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  cellarIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellarMeta: { flex: 1 },
  cellarTitle: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  cellarSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },

  // At-a-glance insights entry (R6 / #56)
  insights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  insightsIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsMeta: { flex: 1 },
  insightsTitle: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  insightsSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.body.caption, color: colors.gold.shimmer },
  sectionAction: { ...typography.body.small, color: colors.primary.burgundy },

  // Wine card
  wineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  wineGlass: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineMeta: { flex: 1 },
  wineName: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  wineDetail: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },
  wineScore: { fontFamily: 'Georgia', fontSize: 16, color: colors.primary.burgundy },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderStyle: 'dashed',
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    fontFamily: 'Georgia',
    marginTop: spacing.sm,
  },
  emptySub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 2 },

  // Map teaser (empty state for "where you've been")
  teaser: {
    height: 110,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.linen,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  teaserText: { ...typography.body.small, color: colors.neutral.graphite },

  // Where you've been — at-a-glance stats card (#95)
  whereCard: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  whereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  whereIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whereText: { flex: 1 },
  whereLabel: { ...typography.body.caption, color: colors.neutral.pewter },
  whereValue: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
    marginTop: 1,
  },

  // Sommelier
  somm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  sommText: { flex: 1 },
  sommTitle: {
    ...typography.heading.h3,
    color: colors.gold.shimmer,
    fontFamily: 'Georgia',
  },
  sommSub: { ...typography.body.small, color: colors.gold.shimmer, marginTop: 2 },
});
