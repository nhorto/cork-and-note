// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';
// Single source of truth for the varietal list (shared with the cellar form) —
// see lib/varietals.js (#134).
import { searchVarietals } from '../lib/varietals';


const AutocompleteVarietal = ({
  value,
  onChangeText,
  placeholder = "Enter wine varietal (optional)",
  style,
  // Optional: when provided, picking a suggestion calls this (e.g. to add the
  // grape as a chip and clear the box) instead of just filling the input (#135).
  onSelect,
}) => {
  const { colors, styles } = useScreenTheme();

  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && value.length > 0 && isFocused) {
      const filtered = searchVarietals(value);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    // Small delay so a tap on a suggestion row lands before the dropdown
    // unmounts (mirrors AutocompleteInput's blur handling).
    setTimeout(() => {
      setIsFocused(false);
      setSuggestions([]);
      setShowSuggestions(false);
    }, 150);
  };

  const handleSuggestionPress = (suggestion) => {
    if (onSelect) {
      onSelect(suggestion);
    } else {
      onChangeText(suggestion);
    }
    setShowSuggestions(false);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const clearInput = () => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            showSuggestions && styles.inputWithSuggestions
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.placeholder}
          selectionColor={colors.primary.ink}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearInput}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.neutral.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionItem,
                  index === suggestions.length - 1 && styles.lastSuggestionItem
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${suggestion}`}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
                <Ionicons name="arrow-up-outline" size={16} color={colors.primary.ink} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};


export default AutocompleteVarietal;


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingRight: 40,
    ...typography.body.regular,
    backgroundColor: colors.neutral.surface,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  inputFocused: {
    borderColor: colors.primary.base,
    backgroundColor: colors.neutral.bg,
    shadowColor: colors.primary.base,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary.base,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    ...shadows.medium,
    zIndex: 1001,
    maxHeight: 200,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    flex: 1,
  },
});
return { colors, styles };
});
