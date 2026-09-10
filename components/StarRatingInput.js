// components/StarRatingInput.js
// Tappable star input for the OVERALL rating (#216) — replaces the 0.1-step
// drag slider so the input matches how the rating is displayed everywhere else
// (StarRating). Half stars: tap a star for the full value, tap the same star
// again for the half, a third tap clears. Tap-only, so it can never hijack the
// form's vertical scroll the way the slider track did.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';


export default function StarRatingInput({ value = 0, onChange, size = 36 }) {
  const { colors, styles } = useScreenTheme();

  const handleTap = (star) => {
    let next;
    if (value === star) next = star - 0.5;
    else if (value === star - 0.5) next = 0;
    else next = star;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange?.(next);
  };

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    let name = 'star-outline';
    if (value >= i) name = 'star';
    else if (value >= i - 0.5) name = 'star-half';
    stars.push(
      <TouchableOpacity
        key={i}
        onPress={() => handleTap(i)}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel={`${i} star${i === 1 ? '' : 's'}`}
      >
        <Ionicons
          name={name}
          size={size}
          color={name === 'star-outline' ? colors.neutral.inkTertiary : colors.accent.base}
          style={styles.star}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Overall rating"
      accessibilityValue={{ min: 0, max: 5, now: value, text: `${value} out of 5` }}
    >
      <View style={styles.row}>{stars}</View>
      <Text style={styles.hint}>
        {value > 0
          ? `${value.toFixed(1)} / 5 — tap the same star for a half, again to clear`
          : 'Tap a star — tap it again for a half'}
      </Text>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing } = theme;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { marginRight: spacing.xs },
  hint: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.xs,
  },
});
return { colors, styles };
});
