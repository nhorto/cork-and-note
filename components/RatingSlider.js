// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Slider } from '@miblanchard/react-native-slider';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const RatingSlider = ({ 
  label, 
  value = 0, 
  min = 0, 
  max = 5, 
  step = 0.1,
  onValueChange,
  showStars = false 
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Handle slider value change
  const handleValueChange = (newValue) => {
    // newValue comes as an array from this slider library
    const actualValue = Array.isArray(newValue) ? newValue[0] : newValue;
    setLocalValue(actualValue);
    
    if (onValueChange) {
      onValueChange(actualValue);
    }
  };

  // Render stars if enabled
  const renderStars = () => {
    if (!showStars) return null;

    const stars = [];
    const fullStars = Math.floor(localValue);
    const hasHalfStar = localValue % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      let iconName = 'star-outline';
      let iconColor = colors.neutral.placeholder; // Light for empty stars

      if (i < fullStars) {
        iconName = 'star';
        iconColor = colors.accent.base; // Gold for filled stars
      } else if (i === fullStars && hasHalfStar) {
        iconName = 'star-half';
        iconColor = colors.accent.base; // Gold for half stars
      }

      stars.push(
        <View key={i} style={styles.starWrapper}>
          <Ionicons
            name={iconName}
            size={28}
            color={iconColor}
            style={styles.starIcon}
          />
        </View>
      );
    }

    return <View style={styles.starsContainer}>{stars}</View>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{localValue.toFixed(1)}</Text>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          value={localValue}
          minimumValue={min}
          maximumValue={max}
          step={step}
          onValueChange={handleValueChange}
          thumbStyle={styles.thumb}
          trackStyle={styles.track}
          minimumTrackTintColor={colors.primary.base}
          maximumTrackTintColor={colors.neutral.divider}
          containerStyle={styles.sliderWrapper}
        />
      </View>

      {showStars && renderStars()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body.regular,
    fontWeight: '500',
    color: colors.neutral.ink,
  },
  valueText: {
    ...typography.body.regular,
    fontWeight: 'bold',
    color: colors.neutral.inkSecondary,
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
  },
  sliderWrapper: {
    height: 40,
    width: '100%',
  },
  track: {
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: colors.neutral.bg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  starWrapper: {
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  starIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default RatingSlider;