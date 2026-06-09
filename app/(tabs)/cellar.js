// app/(tabs)/cellar.js - Wine Cellar (inventory) — Epic #6
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { cellarService, READY_STATUSES } from '../../lib/cellar';
import theme from '../../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

// Drink-window badge presentation.
const DRINK_BADGE = {
  too_young: { label: 'Too young', color: colors.status.wishlist },
  ready: { label: 'Ready', color: colors.status.visited },
  drink_up: { label: 'Drink up', color: colors.gold.shimmer },
  past_peak: { label: 'Past peak', color: colors.status.error },
};

export default function CellarScreen() {
  const router = useRouter();
  const [bottles, setBottles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'ready'

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const res = await cellarService.getCellar().catch(() => ({ success: false }));
        if (!active) return;
        setBottles(res?.success ? res.bottles : []);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const visible = useMemo(() => {
    if (filter === 'ready') {
      return bottles.filter((b) => READY_STATUSES.includes(b.drinkStatus));
    }
    return bottles;
  }, [bottles, filter]);

  const readyCount = useMemo(
    () => bottles.filter((b) => READY_STATUSES.includes(b.drinkStatus)).length,
    [bottles]
  );
  const totalBottles = useMemo(
    () => bottles.reduce((sum, b) => sum + (b.quantity || 0), 0),
    [bottles]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="file-tray-stacked-outline" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.headerTitle}>Cellar</Text>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/cellar/add')}>
            <Ionicons name="add" size={22} color={colors.primary.burgundy} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerBorder} />
      </View>

      {/* Summary + filter */}
      {loaded && bottles.length > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.summary}>
            {totalBottles} bottle{totalBottles === 1 ? '' : 's'} · {readyCount} ready
          </Text>
          <View style={styles.filters}>
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Ready to drink" active={filter === 'ready'} onPress={() => setFilter('ready')} />
          </View>
        </View>
      )}

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.burgundy} />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState filter={filter} onAdd={() => router.push('/cellar/add')} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BottleCard bottle={item} onPress={() => router.push(`/cellar/${item.id}`)} />
          )}
        />
      )}

      {/* Add FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => router.push('/cellar/add')}
      >
        <Ionicons name="add" size={26} color={colors.neutral.cream} />
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BottleCard({ bottle, onPress }) {
  const producer = bottle.producer || bottle.wineries?.name;
  const subtitle = [bottle.vintage, bottle.varietal || bottle.wine_type, bottle.region]
    .filter(Boolean)
    .join(' · ');
  const badge = bottle.drinkStatus ? DRINK_BADGE[bottle.drinkStatus] : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardGlass}>
        <Ionicons name="wine-outline" size={20} color={colors.primary.burgundy} />
        {bottle.quantity > 1 && (
          <View style={styles.qtyDot}>
            <Text style={styles.qtyDotText}>{bottle.quantity}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardName} numberOfLines={1}>
          {bottle.wine_name}
        </Text>
        {producer ? (
          <Text style={styles.cardProducer} numberOfLines={1}>
            {producer}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.cardSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.neutral.silver} />
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter, onAdd }) {
  if (filter === 'ready') {
    return (
      <View style={styles.body}>
        <View style={styles.iconRing}>
          <Ionicons name="time-outline" size={36} color={colors.gold.shimmer} />
        </View>
        <Text style={styles.emptyTitle}>Nothing ready just yet</Text>
        <Text style={styles.emptySub}>
          No bottles are in their drinking window. Set a “drink from / by” year on a
          bottle to track this.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.body}>
      <View style={styles.iconRing}>
        <Ionicons name="file-tray-stacked-outline" size={36} color={colors.gold.shimmer} />
      </View>
      <Text style={styles.emptyTitle}>Your cellar is empty</Text>
      <Text style={styles.emptySub}>
        Track the bottles you own — vintages, quantities, and when they are ready to
        drink.
      </Text>
      <TouchableOpacity style={styles.emptyCta} onPress={onAdd} activeOpacity={0.9}>
        <Ionicons name="add" size={18} color={colors.neutral.cream} />
        <Text style={styles.emptyCtaText}>Add a bottle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { backgroundColor: colors.neutral.cream, paddingTop: 60 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerBorder: { height: 1, backgroundColor: colors.gold.muted, marginHorizontal: spacing.lg },

  toolbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  summary: { ...typography.body.small, color: colors.neutral.pewter, marginBottom: spacing.sm },
  filters: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
  },
  chipActive: { backgroundColor: colors.primary.burgundy, borderColor: colors.primary.burgundy },
  chipText: { ...typography.body.small, color: colors.neutral.graphite },
  chipTextActive: { color: colors.neutral.cream },

  listContent: { padding: spacing.lg, paddingBottom: 120 },

  card: {
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
  cardGlass: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyDotText: { color: colors.neutral.cream, fontSize: 10, fontWeight: '700' },
  cardMeta: { flex: 1 },
  cardName: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  cardProducer: { ...typography.body.small, color: colors.neutral.graphite, marginTop: 1 },
  cardSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  badge: { paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  badgeText: { ...typography.body.caption, color: colors.neutral.cream, fontSize: 9 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl,
  },
  emptyCtaText: { ...typography.body.regular, color: colors.neutral.cream, fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.strong,
  },
});
