// app/(tabs)/cellar.js - Wine Cellar (inventory) — Epic #6
// Château Label Design - Elegant & Refined
//
// Real browsing (#52): search, a Ready now / Hold / All segment, a filter modal with
// removable chips + clear-all + live counts, sort, and a Group-by pivot with per-group
// subtotals. All slicing runs client-side over the already-fetched list via
// lib/cellarBrowse.js (the enthusiast persona = dozens of bottles, not thousands).
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CellarFilterModal from '../../components/CellarFilterModal';
import CellarOptionSheet from '../../components/CellarOptionSheet';
import { cellarService, drinkWindowMeta } from '../../lib/cellar';
import {
  EMPTY_FILTERS,
  GROUPS,
  SEGMENTS,
  SORTS,
  browseCellar,
  hasActiveFilters,
} from '../../lib/cellarBrowse';
import theme from '../../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

const SORT_LABEL = Object.fromEntries(SORTS.map((s) => [s.key, s.label]));
const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label]));

// Statuses the Home "Ready to Drink" strip can deep-link into via ?status=.
const DEEP_LINK_STATUSES = ['too_young', 'ready', 'drink_up', 'past_peak'];

export default function CellarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [bottles, setBottles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Browse state.
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all'); // all | ready | hold
  const [sort, setSort] = useState('readiness');
  const [groupBy, setGroupBy] = useState('none');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Sheet visibility.
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

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

  // Deep-link from the Home "Ready to Drink" strip: ?status=ready pre-applies the
  // matching drink-window filter (and resets the segment so the filter shows).
  useEffect(() => {
    const status = params?.status;
    if (status && DEEP_LINK_STATUSES.includes(status)) {
      setSegment('all');
      setFilters({ ...EMPTY_FILTERS, statuses: [status] });
    }
  }, [params?.status]);

  // Whole pipeline (search -> segment -> filters -> sort -> group) in one memo.
  const { sections, facets, counts } = useMemo(
    () => browseCellar(bottles, { query, segment, filters, sort, groupBy }),
    [bottles, query, segment, filters, sort, groupBy]
  );

  // The segment+search-narrowed set the filter modal previews against.
  const filterScope = useMemo(
    () => browseCellar(bottles, { query, segment, filters: EMPTY_FILTERS, sort: 'readiness', groupBy: 'none' }).filtered,
    [bottles, query, segment]
  );

  const filtersActive = hasActiveFilters(filters);
  const hasResults = counts.result > 0;
  const grouped = groupBy !== 'none';

  // Removable active-filter chips (facets + price + rating).
  const activeChips = useMemo(() => buildActiveChips(filters), [filters]);

  const removeChip = (chip) => {
    setFilters((f) => {
      if (chip.kind === 'list') {
        return { ...f, [chip.key]: (f[chip.key] || []).filter((v) => v !== chip.value) };
      }
      return { ...f, [chip.key]: null };
    });
  };

  const resetAll = () => {
    setQuery('');
    setSegment('all');
    setFilters(EMPTY_FILTERS);
  };

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

      {/* Browse controls (only once there's something to browse) */}
      {loaded && bottles.length > 0 && (
        <View style={styles.toolbar}>
          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.neutral.pewter} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, producer, region, vintage"
              placeholderTextColor={colors.neutral.silver}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.neutral.silver} />
              </TouchableOpacity>
            )}
          </View>

          {/* Segmented Ready now / Hold / All */}
          <View style={styles.segment}>
            {SEGMENTS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.segmentBtn, segment === s.key && styles.segmentBtnActive]}
                onPress={() => setSegment(s.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort / Group / Filter buttons */}
          <View style={styles.controlRow}>
            <ControlButton
              icon="swap-vertical"
              label={SORT_LABEL[sort]}
              onPress={() => setSortOpen(true)}
            />
            <ControlButton
              icon="albums-outline"
              label={grouped ? GROUP_LABEL[groupBy] : 'Group'}
              active={grouped}
              onPress={() => setGroupOpen(true)}
            />
            <ControlButton
              icon="options-outline"
              label="Filters"
              active={filtersActive}
              badge={filtersActive ? activeChips.length : 0}
              onPress={() => setFilterOpen(true)}
            />
          </View>

          {/* Active filter chips (removable) */}
          {activeChips.length > 0 && (
            <View style={styles.chipsRow}>
              {activeChips.map((chip) => (
                <TouchableOpacity
                  key={chip.id}
                  style={styles.activeChip}
                  onPress={() => removeChip(chip)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.activeChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                  <Ionicons name="close" size={13} color={colors.primary.burgundy} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.clearChip}
                onPress={() => setFilters(EMPTY_FILTERS)}
                activeOpacity={0.8}
              >
                <Text style={styles.clearChipText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Result summary */}
          <Text style={styles.summary}>
            {counts.result} {counts.result === 1 ? 'lot' : 'lots'} · {counts.resultBottles}{' '}
            {counts.resultBottles === 1 ? 'bottle' : 'bottles'}
          </Text>
        </View>
      )}

      {/* Body */}
      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.burgundy} />
        </View>
      ) : bottles.length === 0 ? (
        <EmptyCellar onAdd={() => router.push('/cellar/add')} />
      ) : !hasResults ? (
        <NoResults onReset={resetAll} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  {section.title}
                </Text>
                <Text style={styles.sectionCount}>
                  {section.count} {section.count === 1 ? 'lot' : 'lots'} · {section.bottleCount}
                </Text>
              </View>
            ) : null
          }
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

      {/* Sheets */}
      <CellarOptionSheet
        visible={sortOpen}
        title="Sort by"
        options={SORTS}
        selected={sort}
        onSelect={(key) => {
          setSort(key);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
      <CellarOptionSheet
        visible={groupOpen}
        title="Group by"
        options={GROUPS}
        selected={groupBy}
        onSelect={(key) => {
          setGroupBy(key);
          setGroupOpen(false);
        }}
        onClose={() => setGroupOpen(false)}
      />
      <CellarFilterModal
        visible={filterOpen}
        bottles={filterScope}
        facets={facets}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

// Build the removable-chip descriptors from the committed filters.
function buildActiveChips(filters) {
  const chips = [];
  const pushList = (key, values, fmt) =>
    (values || []).forEach((value) =>
      chips.push({ id: `${key}:${value}`, kind: 'list', key, value, label: fmt(value) })
    );

  pushList('statuses', filters.statuses, (v) => drinkWindowMeta(v).label);
  pushList('types', filters.types, (v) => v);
  pushList('varietals', filters.varietals, (v) => v);
  pushList('regions', filters.regions, (v) => v);
  pushList('locations', filters.locations, (v) => v);

  if (filters.minPrice != null || filters.maxPrice != null) {
    const lo = filters.minPrice != null ? `$${filters.minPrice}` : '$0';
    const hi = filters.maxPrice != null ? `$${filters.maxPrice}` : 'any';
    // Two scalars share the price facet; remove both at once.
    chips.push({ id: 'price', kind: 'scalar', key: 'minPrice', label: `${lo}–${hi}`, value: null });
  }
  if (filters.minRating != null) {
    chips.push({ id: 'rating', kind: 'scalar', key: 'minRating', label: `${filters.minRating}+ rating`, value: null });
  }
  return chips;
}

function ControlButton({ icon, label, active, badge, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.control, active && styles.controlActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? colors.primary.burgundy : colors.neutral.graphite}
      />
      <Text style={[styles.controlText, active && styles.controlTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={styles.controlBadge}>
          <Text style={styles.controlBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function BottleCard({ bottle, onPress }) {
  const producer = bottle.producer || bottle.wineries?.name;
  const subtitle = [bottle.vintage, bottle.varietal || bottle.wine_type, bottle.region]
    .filter(Boolean)
    .join(' · ');
  const badge = bottle.drinkStatus ? drinkWindowMeta(bottle.drinkStatus) : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      {/* Bottle / label photo thumbnail (#58) replaces the glass tile when set;
          the quantity dot stays layered on top either way. */}
      <View style={styles.cardGlass}>
        {bottle.photo_url ? (
          <Image source={{ uri: bottle.photo_url }} style={styles.cardThumb} />
        ) : (
          <Ionicons name="wine-outline" size={20} color={colors.primary.burgundy} />
        )}
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

// Illustrative bottles used only to SHOW newcomers what a populated cellar looks
// like. Each mirrors BottleCard's vocabulary (glass tile, quantity dot, name /
// producer / subtitle, drink-window badge) and reuses real drinkWindowMeta labels
// so the preview reads like the live list — just muted and non-interactive.
const PREVIEW_BOTTLES = [
  {
    id: 'preview-ready',
    wine_name: 'Estate Cabernet Sauvignon',
    producer: 'Château Margaux',
    subtitle: '2016 · Cabernet Sauvignon · Bordeaux',
    quantity: 3,
    status: 'ready',
  },
  {
    id: 'preview-drink-up',
    wine_name: 'Sancerre Blanc',
    producer: 'Domaine Vacheron',
    subtitle: '2021 · Sauvignon Blanc · Loire',
    quantity: 1,
    status: 'drink_up',
  },
  {
    id: 'preview-too-young',
    wine_name: 'Barolo Riserva',
    producer: 'Giacomo Conterno',
    subtitle: '2019 · Nebbiolo · Piedmont',
    quantity: 6,
    status: 'too_young',
  },
];

// What the cellar earns you — kept to a tight, scannable line per item.
const VALUE_POINTS = [
  { icon: 'pricetags-outline', text: 'Track vintages & quantities' },
  { icon: 'time-outline', text: 'Know when each bottle is ready to drink' },
  { icon: 'sparkles-outline', text: 'Get sommelier pairings for what you own' },
];

// A muted, non-interactive twin of BottleCard for the preview strip.
function PreviewCard({ bottle }) {
  const badge = drinkWindowMeta(bottle.status);
  return (
    <View style={[styles.card, styles.previewCard]}>
      <View style={[styles.cardGlass, styles.previewGlass]}>
        <Ionicons name="wine-outline" size={20} color={colors.gold.shimmer} />
        {bottle.quantity > 1 && (
          <View style={[styles.qtyDot, styles.previewQtyDot]}>
            <Text style={styles.qtyDotText}>{bottle.quantity}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardName} numberOfLines={1}>
          {bottle.wine_name}
        </Text>
        <Text style={styles.cardProducer} numberOfLines={1}>
          {bottle.producer}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {bottle.subtitle}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.badge, styles.previewBadge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
      </View>
    </View>
  );
}

// Onboarding empty state: shows what a populated cellar looks like, a tight value
// line, and drives ONE primary action ("Add your first bottle").
function EmptyCellar({ onAdd }) {
  return (
    <ScrollView
      style={styles.onboardScroll}
      contentContainerStyle={styles.onboardContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.onboardHero}>
        <View style={styles.iconRing}>
          <Ionicons name="file-tray-stacked-outline" size={36} color={colors.gold.shimmer} />
        </View>
        <Text style={styles.emptyTitle}>Start your cellar</Text>
        <Text style={styles.emptySub}>
          Add the bottles you own and Cork & Note tracks their drinking windows for
          you. Here is what it looks like once it fills up.
        </Text>
      </View>

      {/* Preview of a populated cellar — labelled so it reads as an example. */}
      <View style={styles.previewHeaderRow}>
        <Text style={styles.previewLabel}>Example cellar</Text>
        <View style={styles.previewRule} />
      </View>
      <View style={styles.previewList} pointerEvents="none">
        {PREVIEW_BOTTLES.map((bottle) => (
          <PreviewCard key={bottle.id} bottle={bottle} />
        ))}
      </View>

      {/* What the cellar earns you. */}
      <View style={styles.valueList}>
        {VALUE_POINTS.map((point) => (
          <View key={point.text} style={styles.valueRow}>
            <View style={styles.valueIcon}>
              <Ionicons name={point.icon} size={15} color={colors.primary.burgundy} />
            </View>
            <Text style={styles.valueText}>{point.text}</Text>
          </View>
        ))}
      </View>

      {/* Exactly one primary action. */}
      <TouchableOpacity style={styles.onboardCta} onPress={onAdd} activeOpacity={0.9}>
        <Ionicons name="add" size={18} color={colors.neutral.cream} />
        <Text style={styles.emptyCtaText}>Add your first bottle</Text>
      </TouchableOpacity>

      {/* Subtle, subordinate secondary affordance. Routes to the same add screen,
          which gains a label-scan entry point once #59 lands. */}
      <TouchableOpacity
        style={styles.onboardSecondary}
        onPress={onAdd}
        activeOpacity={0.7}
        hitSlop={8}
      >
        <Ionicons name="camera-outline" size={15} color={colors.neutral.pewter} />
        <Text style={styles.onboardSecondaryText}>or scan a label to add faster</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function NoResults({ onReset }) {
  return (
    <View style={styles.body}>
      <View style={styles.iconRing}>
        <Ionicons name="search-outline" size={36} color={colors.gold.shimmer} />
      </View>
      <Text style={styles.emptyTitle}>No matches</Text>
      <Text style={styles.emptySub}>
        Your cellar has bottles, but none fit the current search and filters. Clear
        them to see everything again.
      </Text>
      <TouchableOpacity style={styles.emptyCta} onPress={onReset} activeOpacity={0.9}>
        <Ionicons name="refresh" size={18} color={colors.neutral.cream} />
        <Text style={styles.emptyCtaText}>Clear search & filters</Text>
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
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
    paddingVertical: 0,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    padding: 3,
    marginTop: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: { backgroundColor: colors.primary.burgundy },
  segmentText: { ...typography.body.small, color: colors.neutral.graphite },
  segmentTextActive: { color: colors.neutral.cream, fontWeight: '600' },

  controlRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  control: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
  },
  controlActive: { borderColor: colors.primary.burgundy, backgroundColor: colors.gold.light },
  controlText: { ...typography.body.small, color: colors.neutral.graphite, flexShrink: 1 },
  controlTextActive: { color: colors.primary.burgundy, fontWeight: '600' },
  controlBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBadgeText: { color: colors.neutral.cream, fontSize: 10, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.gold.light,
    maxWidth: '100%',
  },
  activeChipText: { ...typography.body.small, color: colors.primary.burgundy, flexShrink: 1 },
  clearChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
  },
  clearChipText: { ...typography.body.small, color: colors.neutral.pewter, fontWeight: '600' },

  summary: { ...typography.body.small, color: colors.neutral.pewter, marginTop: spacing.sm },

  listContent: { padding: spacing.lg, paddingBottom: 120 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold.muted,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  sectionCount: { ...typography.body.small, color: colors.neutral.pewter },

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
  cardThumb: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
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

  // --- Onboarding empty state ---
  onboardScroll: { flex: 1 },
  onboardContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 140,
  },
  onboardHero: { alignItems: 'center', marginBottom: spacing.xl },
  // The preview strip's "Example cellar" caption with a gold rule beside it.
  previewHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  previewLabel: { ...typography.body.caption, color: colors.neutral.pewter },
  previewRule: { flex: 1, height: 1, backgroundColor: colors.gold.muted },
  previewList: { opacity: 0.75 },
  // Muted twin of `card` — softer surface, no shadow, so it reads as a sample.
  previewCard: { backgroundColor: colors.neutral.cream, borderColor: colors.neutral.linen },
  previewGlass: { backgroundColor: colors.neutral.parchment },
  previewQtyDot: { backgroundColor: colors.gold.shimmer },
  previewBadge: { opacity: 0.9 },

  // Value list — three tight, scannable benefit lines.
  valueList: { marginTop: spacing.lg, gap: spacing.md },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  valueIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: { ...typography.body.regular, color: colors.neutral.graphite, flex: 1 },

  onboardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl,
    ...shadows.soft,
  },
  // Plain, clearly subordinate secondary affordance (no fill / border).
  onboardSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  onboardSecondaryText: { ...typography.body.small, color: colors.neutral.pewter },

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
