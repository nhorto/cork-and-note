// components/CellarOptionSheet.js - Single-select bottom sheet (Epic #6, #52)
// Château Label Design - Elegant & Refined
//
// A small reusable picker used for the cellar's Sort and Group-by controls: a titled
// bottom sheet with a radio-style list of { key, label } options.
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function CellarOptionSheet({ visible, title, options = [], selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <View style={styles.list}>
            {options.map((opt) => {
              const active = opt.key === selected;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => onSelect?.(opt.key)}
                >
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{opt.label}</Text>
                  {active && (
                    <Ionicons name="checkmark" size={20} color={colors.primary.burgundy} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay.dark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.stone,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.sm,
  },
  list: { marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  rowLabel: { ...typography.body.regular, color: colors.neutral.graphite },
  rowLabelActive: { color: colors.primary.burgundy, fontWeight: '600' },
});
