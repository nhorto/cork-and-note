// components/ProFeaturePreview.js — what a free user sees inside a Pro tool.
//
// Owner decision 2026-09-11: every guided tool opens for everyone. A free user
// gets a clearly labelled SAMPLE of the result plus one upgrade button, never a
// paid answer that is then hidden behind a purchase. The paywall is a modal,
// so when it dismisses with Pro granted the tool screen re-renders into its
// real state with any draft the caller kept in its own state — that is the
// "resume the task after upgrading" behaviour, with no extra plumbing.
//
// The screen owns the sample (`children`) and the copy; this component owns the
// framing so the four tools read as one family.
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePro } from '../hooks/usePro';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';

export default function ProFeaturePreview({
  source,
  eyebrow = 'PART OF PRO',
  title,
  body,
  ctaLabel = 'Unlock with Pro',
  sampleLabel = 'SAMPLE',
  footnote = 'Your journal, map, wineries and cellar stay free.',
  // Optional real content rendered ABOVE the sample box, outside the SAMPLE
  // badge, for tools that can show the user's own numbers before the paid part.
  above = null,
  children,
  contentContainerStyle,
}) {
  const { colors, spacing, styles } = useScreenTheme();
  const { presentPaywall } = usePro();

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {above ? <View style={styles.above}>{above}</View> : null}

      {children ? (
        <View style={styles.sampleWrap}>
          <View style={styles.sampleBadge}>
            <Ionicons name="eye-outline" size={12} color={colors.accent.ink} />
            <Text style={styles.sampleBadgeText}>{sampleLabel}</Text>
          </View>
          {children}
        </View>
      ) : null}

      <Button
        variant="primary"
        title={ctaLabel}
        icon="sparkles"
        onPress={() => presentPaywall(source)}
        style={{ marginTop: spacing.lg }}
        accessibilityLabel={`${ctaLabel}. Opens Cork and Note Pro.`}
      />
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </ScrollView>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;

  const styles = StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    eyebrow: {
      ...typography.body.caption,
      color: colors.accent.ink,
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.heading.h2,
      color: colors.neutral.ink,
      marginBottom: spacing.sm,
    },
    body: {
      ...typography.body.regular,
      color: colors.neutral.inkSecondary,
      marginBottom: spacing.md,
    },
    above: { marginBottom: spacing.lg },
    sampleWrap: {
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      paddingTop: spacing.lg + 4,
      overflow: 'hidden',
    },
    sampleBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accent.surface,
      borderBottomRightRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    sampleBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.accent.ink,
    },
    footnote: {
      ...typography.body.caption,
      color: colors.neutral.inkTertiary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
  return { colors, spacing, styles };
});
