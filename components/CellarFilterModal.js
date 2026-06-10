// components/CellarFilterModal.js - Cellar browse filters (Epic #6, #52)
// Château Label Design - Elegant & Refined
//
// A bottom-sheet modal that edits a draft copy of the filter state and only commits on
// "Apply". Facet chips (type / region / varietal) come from the live set so they show
// real result counts; ready-status, price and rating round out the facets. Pure
// filter logic lives in lib/cellarBrowse.js — this component is presentation + draft state.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { drinkWindowMeta } from '../lib/cellar';
import {
  EMPTY_FILTERS,
  UNKNOWN,
  applyFilters,
  hasActiveFilters,
} from '../lib/cellarBrowse';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

// Drink-window statuses offered as filter chips — labels come from the canonical
// taxonomy (lib/cellar.js) so they stay in sync with the badges everywhere.
const STATUS_OPTIONS = [
  { value: 'ready', label: drinkWindowMeta('ready').label },
  { value: 'drink_up', label: drinkWindowMeta('drink_up').label },
  { value: 'too_young', label: drinkWindowMeta('too_young').label },
  { value: 'past_peak', label: drinkWindowMeta('past_peak').label },
  { value: UNKNOWN, label: drinkWindowMeta(UNKNOWN).label },
];

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function CellarFilterModal({
  visible,
  bottles, // the segment+search-narrowed set the filters will run against
  facets, // { types, regions, varietals } each [{ value, count }]
  filters, // the currently-committed filters
  onApply,
  onClose,
}) {
  // Draft state — edits don't take effect until Apply.
  const [draft, setDraft] = useState(filters || EMPTY_FILTERS);

  // Re-seed the draft whenever the sheet (re)opens with the committed filters.
  useEffect(() => {
    if (visible) setDraft(filters || EMPTY_FILTERS);
  }, [visible, filters]);

  const toggleIn = (key) => (value) =>
    setDraft((d) => {
      const list = d[key] || [];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...d, [key]: next };
    });

  const setNum = (key) => (text) => setDraft((d) => ({ ...d, [key]: toNum(text) }));

  // Live preview of how many lots the draft would show.
  const previewCount = useMemo(
    () => applyFilters(bottles || [], draft).length,
    [bottles, draft]
  );

  const numStr = (v) => (v == null ? '' : String(v));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity
              onPress={() => setDraft(EMPTY_FILTERS)}
              disabled={!hasActiveFilters(draft)}
              hitSlop={8}
            >
              <Text style={[styles.clearAll, !hasActiveFilters(draft) && styles.clearAllDisabled]}>
                Clear all
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <FacetSection
              title="Ready status"
              options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              selected={draft.statuses}
              onToggle={toggleIn('statuses')}
            />

            {facets?.types?.length > 0 && (
              <FacetSection
                title="Type"
                options={facets.types.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.types}
                onToggle={toggleIn('types')}
              />
            )}

            {facets?.varietals?.length > 0 && (
              <FacetSection
                title="Varietal"
                options={facets.varietals.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.varietals}
                onToggle={toggleIn('varietals')}
              />
            )}

            {facets?.regions?.length > 0 && (
              <FacetSection
                title="Region"
                options={facets.regions.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.regions}
                onToggle={toggleIn('regions')}
              />
            )}

            {/* Price range */}
            <Text style={styles.sectionTitle}>Price</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={numStr(draft.minPrice)}
                  onChangeText={setNum('minPrice')}
                  placeholder="$0"
                  placeholderTextColor={colors.neutral.silver}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>Max</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={numStr(draft.maxPrice)}
                  onChangeText={setNum('maxPrice')}
                  placeholder="Any"
                  placeholderTextColor={colors.neutral.silver}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Minimum rating */}
            <Text style={styles.sectionTitle}>Minimum rating</Text>
            <View style={styles.chipWrap}>
              {[3, 3.5, 4, 4.5].map((r) => (
                <Chip
                  key={r}
                  label={`${r}+`}
                  active={draft.minRating === r}
                  onPress={() =>
                    setDraft((d) => ({ ...d, minRating: d.minRating === r ? null : r }))
                  }
                />
              ))}
            </View>
          </ScrollView>

          {/* Apply */}
          <TouchableOpacity
            style={styles.applyBtn}
            activeOpacity={0.9}
            onPress={() => onApply?.(draft)}
          >
            <Text style={styles.applyText}>
              {previewCount === (bottles?.length || 0) && !hasActiveFilters(draft)
                ? 'Show all'
                : `Show ${previewCount} ${previewCount === 1 ? 'lot' : 'lots'}`}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function FacetSection({ title, options, selected = [], onToggle }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.count != null ? `${o.label} (${o.count})` : o.label}
            active={selected.includes(o.value)}
            onPress={() => onToggle(o.value)}
          />
        ))}
      </View>
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
      {active && (
        <Ionicons
          name="checkmark"
          size={13}
          color={colors.neutral.cream}
          style={styles.chipCheck}
        />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay.dark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.stone,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...typography.heading.h2, color: colors.neutral.charcoal, fontFamily: 'Georgia' },
  clearAll: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600' },
  clearAllDisabled: { color: colors.neutral.silver },

  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: spacing.md },

  sectionTitle: {
    ...typography.body.caption,
    color: colors.neutral.pewter,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: colors.primary.burgundy, borderColor: colors.primary.burgundy },
  chipCheck: { marginRight: 4 },
  chipText: { ...typography.body.small, color: colors.neutral.graphite, flexShrink: 1 },
  chipTextActive: { color: colors.neutral.cream },

  rangeRow: { flexDirection: 'row', gap: spacing.md },
  rangeField: { flex: 1 },
  rangeLabel: { ...typography.body.small, color: colors.neutral.pewter, marginBottom: spacing.xs },
  rangeInput: {
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
  },

  applyBtn: {
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.soft,
  },
  applyText: { ...typography.body.large, color: colors.neutral.cream, fontWeight: '600' },
});
