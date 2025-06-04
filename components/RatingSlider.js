import { Ionicons } from '@expo/vector-icons';
import { Slider } from '@miblanchard/react-native-slider';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
      if (i < fullStars) {
        iconName = 'star';
      } else if (i === fullStars && hasHalfStar) {
        iconName = 'star-half';
      }
      stars.push(
        <Ionicons
          key={i}
          name={iconName}
          size={24}
          color="#FFD700"
          style={{ marginHorizontal: 3 }}
        />
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
          minimumTrackTintColor="#8C1C13"
          maximumTrackTintColor="#f0f0f0"
          containerStyle={styles.sliderWrapper}
        />
      </View>

      {showStars && renderStars()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#444',
  },
  valueText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#666',
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
    backgroundColor: '#8C1C13',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
  },
});

export default RatingSlider;