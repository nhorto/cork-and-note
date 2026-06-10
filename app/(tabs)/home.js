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
import { cellarService } from '../../lib/cellar';
import { visitsService } from '../../lib/visits';
import { wishlistService } from '../../lib/wishlist';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [stats, setStats] = useState({ wines: 0, places: 0, wishlist: 0 });
  const [cellar, setCellar] = useState({ totalBottles: 0, readyToDrink: 0 });
  const [recent, setRecent] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Reload whenever the tab gains focus. All calls are defensive: if the
  // backend is unavailable, we simply show zeros and an empty state.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [statsRes, visitsRes, wishRes, cellarRes] = await Promise.all([
            visitsService.getVisitStats().catch(() => ({ success: false })),
            visitsService.getUserVisits().catch(() => ({ success: false })),
            wishlistService.getUserWishlist().catch(() => ({ success: false })),
            cellarService.getCellarStats().catch(() => ({ success: false })),
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
          });

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
        {/* Stat strip */}
        <View style={styles.stats}>
          <Stat n={stats.wines} label="Wines" />
          <Stat n={stats.places} label="Places" />
          <Stat n={stats.wishlist} label="Wishlist" />
        </View>

        {/* Tonight's pick — AI sommelier grounded in the user's own cellar (#51) */}
        <View style={styles.tonightsPick}>
          <TonightsPickCard onRequireCellar={() => router.push('/cellar/add')} />
        </View>

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

        {/* Recent */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RECENT</Text>
          <TouchableOpacity onPress={() => router.push('/wines')}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        {recent.length > 0 ? (
          recent.map((w) => (
            <View key={w.id} style={styles.wineCard}>
              <View style={styles.wineGlass}>
                <Ionicons name="wine-outline" size={18} color={colors.primary.burgundy} />
              </View>
              <View style={styles.wineMeta}>
                <Text style={styles.wineName}>{w.name}</Text>
                <Text style={styles.wineDetail}>{w.detail}</Text>
              </View>
              {w.rating ? <Text style={styles.wineScore}>{w.rating}</Text> : null}
            </View>
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

        {/* Map teaser → Explore */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>WHERE YOU&apos;VE BEEN</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.sectionAction}>Explore</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.teaser}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/map')}
        >
          <Ionicons name="map-outline" size={28} color={colors.primary.burgundy} />
          <Text style={styles.teaserText}>
            {stats.places > 0
              ? `${stats.places} place${stats.places === 1 ? '' : 's'} on your map`
              : 'Your map of places'}
          </Text>
        </TouchableOpacity>

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

function Stat({ n, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

  // Map teaser
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
