// components/FlavorTagSelector.js
// Flavor-note picker, rebuilt for #216. What changed vs. the original:
//   • Searching shows ONE flat, ranked list of tappable pills (with a small
//     category hint on each) — no more collapsed per-category headers to open
//     one by one just to reach "Strawberry".
//   • A ⭐ Popular tab is the default browse view; the five categories follow.
//   • ONE input does both search and add-custom: when nothing matches exactly,
//     the first result becomes an "Add “…”" pill (the old separate custom-note
//     input row is gone).
//   • The library itself moved to lib/flavorNotes.js and grew ~45 notes.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FLAVOR_CATEGORIES,
  POPULAR_FLAVORS,
  flavorCategoryOf,
  searchFlavorNotes,
} from '../lib/flavorNotes';
import { createThemedStyles } from '../styles/ThemeProvider';
import Chip from './Chip';


const POPULAR_TAB = 'Popular';
const TABS = [POPULAR_TAB, ...Object.keys(FLAVOR_CATEGORIES)];

// Category names get shortened on result pills so they stay pill-sized.
const HINT_LABEL = {
  'Fruit': 'fruit',
  'Floral & Herbal': 'floral·herbal',
  'Spice & Wood': 'spice·wood',
  'Earth & Mineral': 'earth·mineral',
  'Other': 'other',
};

const FlavorTagSelector = ({ selectedTags = [], onTagsChange }) => {
  const { colors, styles } = useScreenTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(POPULAR_TAB);

  const query = searchQuery.trim();
  const results = useMemo(() => searchFlavorNotes(query), [query]);
  const hasExactMatch = useMemo(
    () => results.some((t) => t.toLowerCase() === query.toLowerCase()),
    [results, query]
  );

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  // Add whatever was typed as a custom note (capitalized like the library).
  const addCustom = () => {
    const label = query.replace(/^\w/, (c) => c.toUpperCase());
    if (!label) return;
    if (!selectedTags.includes(label)) onTagsChange([...selectedTags, label]);
    setSearchQuery('');
  };

  // Keyboard "done" on the search field: pick the exact match if there is one,
  // otherwise add the query as a custom note.
  const submitSearch = () => {
    if (!query) return;
    const exact = results.find((t) => t.toLowerCase() === query.toLowerCase());
    if (exact) {
      if (!selectedTags.includes(exact)) onTagsChange([...selectedTags, exact]);
      setSearchQuery('');
    } else {
      addCustom();
    }
  };

  const browseTags = activeTab === POPULAR_TAB ? POPULAR_FLAVORS : FLAVOR_CATEGORIES[activeTab];

  return (
    <View style={styles.container}>
      {/* Selected notes — wraps so everything picked stays visible */}
      <View style={styles.selectedWrap}>
        {selectedTags.length === 0 ? (
          <Text style={styles.noTagsText}>Nothing picked yet</Text>
        ) : (
          selectedTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected
              onRemove={() => toggleTag(tag)}
              style={styles.selectedChip}
            />
          ))
        )}
      </View>

      {/* One input: search the library, or add a custom note */}
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={18} color={colors.primary.ink} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search or add a note…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={submitSearch}
          returnKeyType="done"
          placeholderTextColor={colors.neutral.placeholder}
          selectionColor={colors.primary.ink}
        />
        {searchQuery !== '' && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.primary.ink} />
          </TouchableOpacity>
        )}
      </View>

      {query ? (
        /* ── Searching: flat ranked pills, category shown as a hint ── */
        <View>
          <Text style={styles.matchCount}>
            {results.length > 0
              ? `${results.length} match${results.length === 1 ? '' : 'es'} — tap to add`
              : 'No matches in the library'}
          </Text>
          <View style={styles.pillsWrap}>
            {!hasExactMatch && query.length > 1 && (
              <TouchableOpacity
                style={styles.addCustomChip}
                onPress={addCustom}
                accessibilityRole="button"
                accessibilityLabel={`Add custom note ${query}`}
              >
                <Ionicons name="add" size={14} color={colors.accent.ink} />
                <Text style={styles.addCustomText}>
                  Add “{query.replace(/^\w/, (c) => c.toUpperCase())}”
                </Text>
              </TouchableOpacity>
            )}
            {results.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                hint={HINT_LABEL[flavorCategoryOf(tag)]}
                selected={selectedTags.includes(tag)}
                onPress={() => toggleTag(tag)}
                style={styles.tagChip}
              />
            ))}
          </View>
        </View>
      ) : (
        /* ── Browsing: Popular first, then the categories ── */
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabsScroll}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.categoryTab, active && styles.activeCategoryTab]}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {tab === POPULAR_TAB && (
                    <Ionicons
                      name="star"
                      size={11}
                      color={active ? colors.onPrimary : colors.accent.base}
                      style={styles.popularStar}
                    />
                  )}
                  <Text style={[styles.categoryTabText, active && styles.activeCategoryTabText]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.pillsWrap}>
            {browseTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={selectedTags.includes(tag)}
                onPress={() => toggleTag(tag)}
                style={styles.tagChip}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};


export default FlavorTagSelector;


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
  },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: 30,
    alignItems: 'center',
  },
  noTagsText: {
    ...typography.body.small,
    fontStyle: 'italic',
    color: colors.neutral.placeholder,
  },
  selectedChip: {
    marginRight: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.bg,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body.regular,
    color: colors.neutral.ink,
  },
  matchCount: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginBottom: spacing.sm,
  },
  categoryTabsScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    backgroundColor: colors.neutral.divider,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  activeCategoryTab: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  popularStar: {
    marginRight: 4,
  },
  categoryTabText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    fontWeight: '500',
  },
  activeCategoryTabText: {
    color: colors.onPrimary,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    marginRight: 0,
    marginBottom: 0,
  },
  addCustomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent.strong,
    backgroundColor: colors.accent.surface,
  },
  addCustomText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent.ink,
  },
});
return { colors, styles };
});
