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
import theme from '../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

// Common wine varietals for autocomplete suggestions
const WINE_VARIETALS = [
  'Cabernet Sauvignon',
  'Merlot',
  'Pinot Noir',
  'Syrah/Shiraz',
  'Malbec',
  'Chardonnay',
  'Sauvignon Blanc',
  'Pinot Grigio',
  'Pinot Gris',
  'Riesling',
  'Moscato',
  'Cabernet Franc',
  'Sangiovese',
  'Tempranillo',
  'Grenache',
  'Petit Verdot',
  'Zinfandel',
  'Barbera',
  'Nebbiolo',
  'Petite Sirah',
  'Mourvedre',
  'Gewürztraminer',
  'Viognier',
  'Albariño',
  'Chenin Blanc',
  'Sémillon',
  'Marsanne',
  'Roussanne',
  'Vermentino',
  'Grüner Veltliner',
  'Muscadet',
  'Champagne',
  'Prosecco',
  'Cava',
  'Port',
  'Sherry',
  'Madeira'
];

const AutocompleteVarietal = ({
  value,
  onChangeText,
  placeholder = "Enter wine varietal (optional)",
  style
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && value.length > 0 && isFocused) {
      const filtered = WINE_VARIETALS.filter(varietal =>
        varietal.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value && value.length > 0) {
      const filtered = WINE_VARIETALS.filter(varietal =>
        varietal.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  };

  const handleSuggestionPress = (suggestion) => {
    onChangeText(suggestion);
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
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.silver}
          selectionColor={colors.primary.burgundy}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.neutral.silver} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionItem,
                  index === suggestions.length - 1 && styles.lastSuggestionItem
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
                <Ionicons name="arrow-up-outline" size={16} color={colors.primary.burgundy} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

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
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingRight: 40,
    ...typography.body.regular,
    backgroundColor: colors.neutral.parchment,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  inputFocused: {
    borderColor: colors.primary.burgundy,
    backgroundColor: colors.neutral.cream,
    shadowColor: colors.primary.burgundy,
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
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary.burgundy,
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
    borderBottomColor: colors.neutral.linen,
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    flex: 1,
  },
});

export default AutocompleteVarietal;
