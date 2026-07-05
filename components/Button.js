// components/Button.js
// Canonical button for the app. Replaces the three drifted primary-button
// recipes (radius 4 + sans / radius 8 + Georgia / radius 8 + h3 serif) and the
// three cancel recipes with one set of variants:
//   primary   — burgundy fill, cream label (the main CTA)
//   secondary — parchment fill, stone border, graphite label (Cancel / muted,
//               subordinate to a primary it sits beside)
//   outline   — burgundy outline + label (a branded secondary action)
//   ghost     — text-only, burgundy label
// Labels are sans (System) weight 600; serif is reserved for headings/titles.
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing } from '../styles/theme';

// Ink (label + icon + spinner) color per variant.
const INK = {
  primary: colors.neutral.cream,
  secondary: colors.neutral.graphite,
  outline: colors.primary.burgundy,
  ghost: colors.primary.burgundy,
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,               // optional Ionicons name, rendered leading
  style,              // extra container style
  textStyle,          // extra label style
  accessibilityLabel,
  ...rest
}) {
  const isDisabled = disabled || loading;
  const ink = INK[variant] || INK.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons name={icon} size={18} color={ink} style={styles.icon} />
          ) : null}
          <Text style={[styles.label, { color: ink }, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  primary: {
    backgroundColor: colors.primary.burgundy,
  },
  secondary: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary.burgundy,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 0,
    paddingVertical: spacing.sm,
  },

  disabled: {
    opacity: 0.5,
  },
});
