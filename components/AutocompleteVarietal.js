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
          placeholderTextColor="#999"
          autoCapitalize="words"
          autoCorrect={false}
        />

        {value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
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
                <Ionicons name="arrow-up-outline" size={16} color="#8C1C13" />
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
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingRight: 40,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    color: '#333',
  },
  inputFocused: {
    borderColor: '#8C1C13',
    backgroundColor: '#FFF',
    shadowColor: '#8C1C13',
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
    right: 15,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#8C1C13',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
});

export default AutocompleteVarietal;
