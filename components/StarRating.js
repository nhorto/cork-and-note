// components/StarRating.js
// Canonical read-only star-rating display. Unifies the four ad-hoc rating
// treatments (bare star row, bordered score pill, 12/13/16px star+number) into
// one: a row of gold stars (filled / half / empty) with an optional "N.N/5".
// For RATING INPUT, use RatingSlider — this component is display-only.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export default function StarRating({
  value = 0,
  max = 5,
  size = 16,
  showValue = true,
  style,
}) {
  const v = Math.max(0, Math.min(max, Number(value) || 0));
  const stars = [];
  for (let i = 1; i <= max; i++) {
    let name = 'star-outline';
    if (v >= i) name = 'star';
    else if (v >= i - 0.5) name = 'star-half';
    stars.push(
      <Ionicons
        key={i}
        name={name}
        size={size}
        color={name === 'star-outline' ? colors.neutral.stone : colors.gold.rich}
        style={styles.star}
      />
    );
  }

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="image"
      accessibilityLabel={`Rated ${v} out of ${max}`}
    >
      {stars}
      {showValue ? (
        <Text style={[styles.value, { fontSize: Math.max(11, size - 2) }]}>
          {v.toFixed(1)}/{max}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { marginRight: 1 },
  value: {
    marginLeft: 6,
    color: colors.neutral.graphite,
    fontWeight: '600',
  },
});
