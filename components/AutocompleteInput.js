// components/AutocompleteInput.js - Reusable debounced autocomplete field (#53, Epic #6)
//
// A controlled text input that suggests matches from an in-memory `items` list as the
// user types, lets them pick an existing record (onSelect) or keep free-typing (onChangeText),
// and shows a small "linked / new" hint so the enthusiast knows when a producer/wine was
// matched to something already in the app (dedupe) vs. created fresh.
//
// Generic on purpose so the same component backs both the Producer and Wine fields on the
// add-bottle form. Styling mirrors components/AutocompleteVarietal.js (the Château theme).
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function AutocompleteInput({
  label,
  required,
  value,
  onChangeText,
  onSelect,
  items = [],
  getLabel = (item) => item?.name ?? '',
  getSubtitle, // optional (item) => string shown under the suggestion label
  placeholder,
  linked = false, // true once the current value came from a picked suggestion
  maxResults = 6,
  debounceMs = 200,
  autoCapitalize = 'words',
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [dismissed, setDismissed] = useState(false); // suppress dropdown right after a pick
  const inputRef = useRef(null);

  // Debounce the matched query so we don't re-filter on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(value || ''), debounceMs);
    return () => clearTimeout(id);
  }, [value, debounceMs]);

  const suggestions = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const matches = [];
    for (const item of items) {
      const lbl = getLabel(item);
      if (!lbl) continue;
      const lower = lbl.toLowerCase();
      if (lower.includes(q)) {
        // Don't suggest an item that is already an exact match of the field.
        if (lower === q) continue;
        matches.push(item);
        if (matches.length >= maxResults) break;
      }
    }
    return matches;
  }, [query, items, getLabel, maxResults]);

  const showSuggestions = isFocused && !dismissed && suggestions.length > 0;

  const handleChange = (text) => {
    setDismissed(false);
    onChangeText(text);
  };

  const handlePick = (item) => {
    setDismissed(true);
    inputRef.current?.blur();
    onSelect?.(item);
  };

  const clearInput = () => {
    setDismissed(false);
    onChangeText('');
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.field, { zIndex: showSuggestions ? 1000 : 1 }]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.req}> *</Text> : null}
          </Text>
          {linked ? (
            <View style={styles.linkedPill}>
              <Ionicons name="link" size={11} color={colors.primary.burgundy} />
              <Text style={styles.linkedText}>Linked</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            showSuggestions && styles.inputWithSuggestions,
          ]}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.silver}
          selectionColor={colors.primary.burgundy}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {value?.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.neutral.silver} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSuggestions ? (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((item, index) => {
              const subtitle = getSubtitle?.(item);
              return (
                <TouchableOpacity
                  key={`${getLabel(item)}-${index}`}
                  style={[
                    styles.suggestionItem,
                    index === suggestions.length - 1 && styles.lastSuggestionItem,
                  ]}
                  onPress={() => handlePick(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionTextWrap}>
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {getLabel(item)}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="return-down-back" size={16} color={colors.primary.burgundy} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, position: 'relative' },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: { ...typography.body.caption, color: colors.neutral.pewter },
  req: { color: colors.primary.wine },
  linkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    backgroundColor: colors.gold.light,
  },
  linkedText: {
    ...typography.body.caption,
    color: colors.primary.burgundy,
    textTransform: 'none',
    letterSpacing: 0.3,
  },

  inputContainer: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingRight: 40,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
  },
  inputFocused: {
    borderColor: colors.primary.burgundy,
    backgroundColor: colors.neutral.cream,
  },
  inputWithSuggestions: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
  },

  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary.burgundy,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    ...shadows.medium,
    zIndex: 1001,
    maxHeight: 220,
  },
  suggestionsList: { maxHeight: 220 },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  lastSuggestionItem: { borderBottomWidth: 0 },
  suggestionTextWrap: { flex: 1, marginRight: spacing.sm },
  suggestionText: { ...typography.body.regular, color: colors.neutral.charcoal },
  suggestionSubtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },
});
