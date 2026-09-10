// components/Chip.js
// Canonical pill chip for flavor tags and similar selectable/removable tokens.
// One recipe replaces the three drifted colorways (primary.soft/primary.base,
// primary.base/neutral.bg, accent.surface/accent):
//   unselected — neutral.surface fill, neutral.border border, neutral.ink label
//   selected   — primary.base fill, neutral.bg label
// Pass onPress to make it selectable; pass onRemove to show a trailing ×.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing } from '../styles/theme';

export default function Chip({
  label,
  hint, // optional small muted suffix, e.g. the flavor category on search results
  selected = false,
  onPress,
  onRemove,
  disabled = false,
  style,
}) {
  const body = (
    <>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
        {hint ? (
          <Text style={[styles.hint, selected && styles.hintSelected]}> {hint}</Text>
        ) : null}
      </Text>
      {onRemove ? (
        <TouchableOpacity
          onPress={onRemove}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          style={styles.removeBtn}
        >
          <Ionicons
            name="close"
            size={14}
            color={selected ? colors.neutral.bg : colors.neutral.inkTertiary}
          />
        </TouchableOpacity>
      ) : null}
    </>
  );

  const containerStyle = [
    styles.chip,
    selected ? styles.chipSelected : styles.chipUnselected,
    disabled && styles.disabled,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={containerStyle}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.border,
  },
  chipSelected: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral.ink,
  },
  labelSelected: {
    color: colors.neutral.bg,
  },
  hint: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.neutral.placeholder,
  },
  hintSelected: {
    color: colors.neutral.divider,
  },
  removeBtn: {
    marginLeft: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});
