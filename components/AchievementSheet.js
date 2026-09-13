// components/AchievementSheet.js — the "you just earned this" bottom sheet (#296).
//
// Shown once per save that earns something, never as a queue of popups: the
// service writes every new badge in one go, so one sheet can list them all.
// Modelled on components/CellarOptionSheet.js so it behaves like the rest of
// the app's sheets.
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect } from 'react';
import AchievementBadge from './AchievementBadge';
import { tapMedium } from '../lib/haptics';
import { createThemedStyles } from '../styles/ThemeProvider';


export default function AchievementSheet({
  visible,
  awards = [],
  level = null,
  levelUp = null,
  backfill = false,
  onClose,
  onViewCollection,
}) {
  const { styles } = useScreenTheme();

  useEffect(() => {
    if (visible && awards.length > 0) tapMedium();
  }, [visible, awards.length]);

  const title = backfill
    ? 'Your journal has been recognized'
    : awards.length === 1
      ? 'New badge'
      : 'New badges';

  const subtitle = backfill
    ? 'Badges you had already earned before this, all at once.'
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {awards.map((award) => (
              <View key={`${award.badge_key}:${award.tier ?? ''}`} style={styles.row}>
                <AchievementBadge icon={award.icon} tier={award.tier || 'earned'} size={44} />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{award.label || award.name}</Text>
                  <Text style={styles.rowPoints}>{`+${award.points} pts`}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {levelUp ? (
            <Text style={styles.levelUp}>
              {`Level up: Level ${level?.level} · ${level?.title}`}
            </Text>
          ) : level ? (
            <Text style={styles.levelLine}>
              {`Level ${level.level} · ${level.title}`}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              onPress={onViewCollection}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>See collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay.dark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    marginTop: spacing.xs,
  },
  list: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  rowPoints: { ...typography.body.small, color: colors.accent.ink, marginTop: 2 },
  levelUp: {
    ...typography.body.regular,
    color: colors.primary.ink,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  levelLine: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    marginTop: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  secondaryBtnText: { ...typography.body.regular, color: colors.primary.ink, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.base,
  },
  primaryBtnText: { ...typography.body.regular, color: colors.onPrimary, fontWeight: '600' },
});
return { colors, styles };
});
