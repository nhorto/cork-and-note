// components/CollapsibleSection.js
// Accordion row for the log-a-wine form's optional deep-dive sections (#216):
// an Ionicons badge, a title, a live one-line summary, and a chevron. Collapsed
// by default so a quick log never scrolls past empty sliders and pickers; the
// summary turns accent-colored once the section actually holds data, so
// collapsed never means hidden.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CollapsibleSection({
  icon,
  title,
  summary,
  hasData = false,
  initiallyOpen = false,
  children,
}) {
  const [open, setOpen] = useState(initiallyOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        accessibilityHint={summary}
      >
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={18} color={colors.primary.deep} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text
            style={[styles.summary, hasData && styles.summaryData]}
            numberOfLines={1}
          >
            {summary}
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.neutral.placeholder}
        />
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.surface,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.heading.h3,
    fontSize: 15.5,
    color: colors.neutral.ink,
    fontFamily: typography.fonts.serif,
  },
  summary: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
  },
  summaryData: {
    color: colors.primary.deep,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
    paddingTop: spacing.sm,
  },
});
