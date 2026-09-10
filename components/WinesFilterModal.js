// components/WinesFilterModal.js - Tastings filter sheet (#170 Layer C)
// Château Label Design - Elegant & Refined
//
// Rebuilt on the CellarFilterModal pattern: a bottom sheet that edits a DRAFT
// copy of the filters and only commits on Apply, with searchable, counted,
// wrapped facet chips instead of the old unbounded horizontal rows. Sort lives
// on the screen, not in here. Pure filter logic is in lib/winesBrowse.js.
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
import { EMPTY_FILTERS, applyFilters, hasActiveFilters } from '../lib/winesBrowse';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';


export default function WinesFilterModal({
  visible,
  wines, // the search-narrowed set the filters will run against
  facets, // { types, wineries, varietals } each [{ value, count }]
  filters, // the currently-committed filters
  onApply,
  onClose,
}) {
  const { spacing, styles } = useScreenTheme();

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

  // Live preview of how many wines the draft would show.
  const previewCount = useMemo(
    () => applyFilters(wines || [], draft).length,
    [wines, draft]
  );

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
            {facets?.types?.length > 0 && (
              <FacetSection
                title="Wine type"
                options={facets.types.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.types}
                onToggle={toggleIn('types')}
              />
            )}

            {facets?.wineries?.length > 0 && (
              <FacetSection
                title="Winery"
                options={facets.wineries.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.wineries}
                onToggle={toggleIn('wineries')}
                searchable
              />
            )}

            {facets?.varietals?.length > 0 && (
              <FacetSection
                title="Varietal"
                options={facets.varietals.map((o) => ({ value: o.value, label: o.value, count: o.count }))}
                selected={draft.varietals}
                onToggle={toggleIn('varietals')}
                searchable
              />
            )}

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
          <Button
            variant="primary"
            title={
              previewCount === (wines?.length || 0) && !hasActiveFilters(draft)
                ? 'Show all'
                : `Show ${previewCount} ${previewCount === 1 ? 'wine' : 'wines'}`
            }
            onPress={() => onApply?.(draft)}
            style={{ marginTop: spacing.md }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function FacetSection({ title, options, selected = [], onToggle, searchable = false }) {
  const { colors, styles } = useScreenTheme();

  const [query, setQuery] = useState('');
  // Only bother with a search box once the list is long enough to scroll past.
  const showSearch = searchable && options.length > 6;
  const needle = query.trim().toLowerCase();
  // Narrow by query, but ALWAYS keep already-selected chips visible so a
  // selection never silently disappears while the user is searching.
  const shown = needle
    ? options.filter(
        (o) => selected.includes(o.value) || String(o.label).toLowerCase().includes(needle)
      )
    : options;

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showSearch && (
        <TextInput
          style={styles.facetSearch}
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${title.toLowerCase()}…`}
          placeholderTextColor={colors.neutral.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      <View style={styles.chipWrap}>
        {shown.map((o) => (
          <Chip
            key={o.value}
            label={o.count != null ? `${o.label} (${o.count})` : o.label}
            active={selected.includes(o.value)}
            onPress={() => onToggle(o.value)}
          />
        ))}
        {showSearch && shown.length === 0 && (
          <Text style={styles.facetEmpty}>No matches</Text>
        )}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  const { colors, styles } = useScreenTheme();

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
          color={colors.onPrimary}
          style={styles.chipCheck}
        />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.bg,
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
    backgroundColor: colors.neutral.border,
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
  title: { ...typography.heading.h2, color: colors.neutral.ink, fontFamily: SERIF },
  clearAll: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },
  clearAllDisabled: { color: colors.neutral.placeholder },

  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: spacing.md },

  sectionTitle: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  facetSearch: {
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.small.fontSize,
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
  },
  facetEmpty: {
    ...typography.body.small,
    color: colors.neutral.placeholder,
    fontStyle: 'italic',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  chipCheck: { marginRight: 4 },
  chipText: { ...typography.body.small, color: colors.neutral.inkSecondary, flexShrink: 1 },
  chipTextActive: { color: colors.onPrimary },
});
return { colors, styles, spacing };
});
