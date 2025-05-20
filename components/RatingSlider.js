import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RatingSlider = ({ 
  label, 
  value = 0, 
  min = 0, 
  max = 5, 
  step = 0.5,
  onValueChange,
  showStars = false 
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [localValue, setLocalValue] = useState(value);
  
  // Handle the touch/click on the slider
  const handleSliderPress = (event) => {
    if (sliderWidth === 0) return;
    
    // Get the touch position relative to the slider
    const touchX = event.nativeEvent.locationX;
    
    // Calculate the percentage and the new value
    const percentage = Math.max(0, Math.min(touchX / sliderWidth, 1));
    const newValue = min + percentage * (max - min);
    
    // Round to the nearest step
    const roundedValue = Math.round(newValue / step) * step;
    
    // Update local state
    setLocalValue(roundedValue);
    
    // Call the callback if provided
    if (onValueChange) {
      onValueChange(roundedValue);
    }
  };
  
  // Calculate the thumb position
  const getThumbPosition = () => {
    if (sliderWidth === 0) return 0;
    const percentage = (localValue - min) / (max - min);
    return percentage * sliderWidth - 15; // 15 is half the thumb width
  };
  
  // Calculate the active track width
  const getActiveTrackWidth = () => {
    if (sliderWidth === 0) return 0;
    const percentage = (localValue - min) / (max - min);
    return percentage * sliderWidth;
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
          size={20}
          color="#FFD700"
          style={{ marginHorizontal: 2 }}
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

      <TouchableWithoutFeedback onPress={handleSliderPress}>
        <View
          style={styles.sliderContainer}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setSliderWidth(width);
          }}
        >
          <View style={[styles.track, { backgroundColor: '#f0f0f0' }]}>
            <View
              style={[
                styles.activeTrack,
                {
                  backgroundColor: '#8E2DE2',
                  width: getActiveTrackWidth(),
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.thumb,
              {
                backgroundColor: '#8E2DE2',
                transform: [{ translateX: getThumbPosition() }],
              },
            ]}
          />

          <View style={styles.tickContainer}>
            {Array.from({ length: Math.floor((max - min) / step) + 1 }).map((_, i) => (
              <View
                key={i}
                style={[styles.tick, i % 2 === 0 && styles.majorTick]}
              />
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {showStars && renderStars()}
    </View>
  );
};

// Your styles unchanged
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
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    position: 'absolute',
  },
  activeTrack: {
    height: '100%',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
  },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    position: 'absolute',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    zIndex: 2,
  },
  tickContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
  },
  tick: {
    width: 1,
    height: 5,
    backgroundColor: '#ccc',
    marginTop: 8,
  },
  majorTick: {
    height: 8,
    width: 2,
    backgroundColor: '#aaa',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
});

export default RatingSlider;