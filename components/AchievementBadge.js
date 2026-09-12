// components/AchievementBadge.js — one badge, earned or locked (#296).
//
// A circular icon inside a tier-coloured ring. Colour is never the only signal:
// the tier is also written underneath whenever a label is passed, and a locked
// badge is dimmed AND dashed, so the state reads without relying on hue.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';


const SIZES = { ring: 3 };

export default function AchievementBadge({
  icon = 'trophy-outline',
  tier = null,
  size = 56,
  locked = false,
  label = null,
  testID,
}) {
  const { colors, styles, tierColors } = useScreenTheme();

  const ringColor = tierColors[tier] || colors.neutral.border;
  const iconColor = locked ? colors.neutral.inkTertiary : ringColor;

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ringColor,
            borderStyle: locked ? 'dashed' : 'solid',
            opacity: locked ? 0.35 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={Math.round(size * 0.5)} color={iconColor} />
      </View>
      {label ? (
        <Text style={[styles.label, locked && styles.labelLocked]} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing } = theme;

// Fan, Lover and Devotee ride the same three colours as Bronze, Silver and
// Gold: one visual ladder to learn, not two.
const tierColors = {
  bronze: colors.accent.strong,
  silver: colors.neutral.inkTertiary,
  gold: colors.accent.base,
  platinum: colors.primary.ink,
  fan: colors.accent.strong,
  lover: colors.neutral.inkTertiary,
  devotee: colors.accent.base,
  earned: colors.primary.ink,
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: SIZES.ring,
    backgroundColor: colors.neutral.surface,
  },
  label: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  labelLocked: { color: colors.neutral.inkTertiary },
});
return { colors, styles, tierColors };
});
