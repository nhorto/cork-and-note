// components/Chip.js
// Canonical pill chip for flavor tags and similar selectable/removable tokens.
// One recipe replaces the three drifted colorways (rosé/burgundy,
// burgundy/cream, gold.light/gold):
//   unselected — parchment fill, stone border, charcoal label
//   selected   — burgundy fill, cream label
// Pass onPress to make it selectable; pass onRemove to show a trailing ×.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing } from '../styles/theme';

export default function Chip({
  label,
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
            color={selected ? colors.neutral.cream : colors.neutral.pewter}
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
    backgroundColor: colors.neutral.parchment,
    borderColor: colors.neutral.stone,
  },
  chipSelected: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral.charcoal,
  },
  labelSelected: {
    color: colors.neutral.cream,
  },
  removeBtn: {
    marginLeft: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});
