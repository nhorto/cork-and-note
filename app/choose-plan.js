// app/choose-plan.js — the post-signup Free vs Pro choice.
//
// Owner ask 2026-09-10: a brand-new account should be shown, right after
// signing up, what Free and Pro each include — the marketing site's
// comparison (site/build.mjs COMPARE, launch plan §4.2), optimised for one
// phone screen. The nav guard in _layout.js routes fresh sign-ups here
// instead of Home.
//
// Two hard rules, both App Store driven:
//   · The free path is always one obvious tap ("Continue with Free") — the
//     choice is an offer, never a wall.
//   · Prices are never hardcoded: the Pro price line is built from StoreKit's
//     own localised strings, exactly like the paywall, and simply omitted
//     when the store hasn't answered. The paywall (one tap away) remains the
//     3.1.2 surface of record.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePro } from '../hooks/usePro';
import { packagePeriod, packagePriceLine, packageTrialLabel } from '../lib/pro';
import { fetchOffering } from '../lib/purchases';
import { createThemedStyles } from '../styles/ThemeProvider';


// The site's comparison table, condensed to the rows that decide the choice.
// Keep in step with site/build.mjs COMPARE and launch plan §4.2.
const COMPARE = [
  { label: 'Tastings, notes & photos', free: 'Unlimited', pro: 'Unlimited' },
  { label: 'Winery map, visits & wishlist', free: 'Unlimited', pro: 'Unlimited' },
  { label: 'Cellar bottles', free: 'Up to 25', pro: 'Unlimited' },
  { label: 'Drink windows & Tonight’s Pick', free: null, pro: 'Included' },
  { label: 'Sommelier messages', free: '5 a month', pro: 'Unlimited + photos' },
  { label: 'Label & tasting-card scans', free: '3 to try', pro: 'Unlimited' },
  { label: 'Live winery ratings & hours', free: null, pro: 'Included' },
  { label: 'Export your journal to CSV', free: null, pro: 'Included' },
];

export default function ChoosePlanScreen() {
  const { colors, spacing, styles } = useScreenTheme();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro, presentPaywall } = usePro();

  // StoreKit's localised price line for the Pro card, or nothing at all —
  // never a hardcoded "$9.99" (wrong in 174 of 175 territories).
  const [priceLine, setPriceLine] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const offering = await fetchOffering();
      if (cancelled) return;
      const packages = offering?.availablePackages ?? [];
      const monthly = packages.find((p) => packagePeriod(p) === 'month');
      const annual = packages.find((p) => packagePeriod(p) === 'year');
      const parts = [];
      if (monthly) parts.push(packagePriceLine(monthly));
      if (annual) {
        const trial = packageTrialLabel(annual);
        parts.push(`${packagePriceLine(annual)}${trial ? ` with a ${trial}` : ''}`);
      }
      if (parts.length) setPriceLine(parts.join(' · '));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueFree = () => router.replace('/(tabs)/home');

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Welcome to Cork &amp; Note</Text>
        <Text style={styles.subtitle}>
          Your journal is free forever — every tasting, place, photo and note. Pro adds the parts
          that think. Choose how you&apos;d like to start; you can change your mind any time.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.labelCol} />
            <Text style={styles.colTitle}>FREE</Text>
            <Text style={[styles.colTitle, styles.colTitlePro]}>PRO</Text>
          </View>
          {COMPARE.map((row) => (
            <View key={row.label} style={styles.tableRow}>
              <Text style={[styles.rowLabel, styles.labelCol]}>{row.label}</Text>
              <View style={styles.valueCol}>
                {row.free ? (
                  <Text style={styles.valueText}>{row.free}</Text>
                ) : (
                  <Text style={styles.valueMuted}>—</Text>
                )}
              </View>
              <View style={styles.valueCol}>
                {row.pro === 'Included' ? (
                  <Ionicons name="checkmark" size={16} color={colors.accent.strong} />
                ) : (
                  <Text style={[styles.valueText, styles.valuePro]}>{row.pro}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {priceLine ? <Text style={styles.priceLine}>Pro is {priceLine}.</Text> : null}

        {isPro ? (
          // They upgraded on the paywall and came back — say so, then let them in.
          <>
            <View style={styles.proWelcome}>
              <Ionicons name="sparkles" size={16} color={colors.accent.strong} />
              <Text style={styles.proWelcomeText}>You&apos;re all set with Cork &amp; Note Pro.</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={continueFree}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Start exploring</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => presentPaywall('onboarding')}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Start with Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={continueFree}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>Continue with the free journal</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, spacing, typography, borderRadius } = theme;
const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '600',
    color: colors.primary.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  table: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.border,
  },
  colTitle: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    fontWeight: '800',
    letterSpacing: 0.6,
    width: 88,
    textAlign: 'center',
  },
  colTitlePro: { color: colors.accent.strong },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
  },
  labelCol: { flex: 1, paddingRight: spacing.sm },
  rowLabel: { ...typography.body.small, color: colors.neutral.ink },
  valueCol: { width: 88, alignItems: 'center', justifyContent: 'center' },
  valueText: {
    ...typography.body.caption,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
  },
  valuePro: { color: colors.neutral.ink, fontWeight: '600' },
  valueMuted: { ...typography.body.caption, color: colors.neutral.placeholder },

  priceLine: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  proWelcome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  proWelcomeText: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: { fontSize: 15, color: colors.primary.ink, fontWeight: '600' },
});
return { colors, spacing, styles };
});
