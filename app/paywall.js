// app/paywall.js — the Pro paywall (launch plan §4.5 item 3).
//
// APP STORE GUIDELINE 3.1.2 lives in this file. A subscription paywall must show,
// before purchase: the subscription name, its length, its price per period, that
// it renews automatically, a Restore Purchases control, and working links to the
// Terms of Use and Privacy Policy. Everything below marked "3.1.2" is there for
// that reason — do not remove it to tidy the layout.
//
// Prices are never hardcoded: `product.priceString` comes from StoreKit, already
// localised and in the user's currency, and the trial comes from the product's
// intro offer. A hardcoded "$9.99" would be wrong in 174 of 175 territories and
// is itself a rejection risk.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePro } from '../hooks/usePro';
import {
  FREE_CELLAR_BOTTLE_LIMIT,
  FREE_MONTHLY_LIMITS,
  PRIVACY_URL,
  TERMS_URL,
  packagePeriod,
  packagePriceLine,
  packageTrialLabel,
} from '../lib/pro';
import { fetchOffering, purchasePackage } from '../lib/purchases';
import { colors, spacing, typography } from '../styles/theme';

const SERIF = typography.fonts.serif;

// Lead with the sommelier and unlimited scans, not "more journaling" — at $9.99
// this sits with the AI/collector tools, not with the $5 journal apps (§4.2).
const BENEFITS = [
  { icon: 'sparkles', text: 'Unlimited AI sommelier — ask anything, any time' },
  { icon: 'scan', text: 'Unlimited label and tasting-card scans' },
  { icon: 'wine', text: 'An unlimited cellar with drink windows and Tonight’s Pick' },
  { icon: 'download', text: 'Export your tastings to CSV' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams();
  const { isPro, purchasesAvailable, restore, onPurchased } = usePro();

  const [packages, setPackages] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const offering = await fetchOffering();
      if (cancelled) return;
      // Annual first: it is the plan to push (44% retention at 12 months versus
      // 17.5% for monthly, §4.2) and it carries the trial.
      const available = (offering?.availablePackages ?? [])
        .slice()
        .sort((a, b) => (packagePeriod(a) === 'year' ? -1 : 0) - (packagePeriod(b) === 'year' ? -1 : 0));
      setPackages(available);
      setSelected(available[0] ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    const result = await purchasePackage(selected);
    setBusy(false);
    if (result.cancelled) return;
    if (result.error) {
      Alert.alert('Purchase failed', result.error);
      return;
    }
    if (result.isPro) {
      // Deliberately not awaited: onPurchased() spends up to ten seconds waiting
      // for our webhook to land, and it already flips isPro synchronously. Making
      // someone stare at the paywall they just paid on would be a terrible thanks.
      onPurchased();
      router.back();
    }
  }, [selected, busy, onPurchased, router]);

  // 3.1.2: Restore Purchases must be reachable from the paywall itself, not only
  // from Settings — a reinstalling subscriber must never be asked to pay twice.
  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const result = await restore();
    setBusy(false);
    if (result.isPro) {
      Alert.alert('Welcome back', 'Your Cork & Note Pro subscription has been restored.');
      router.back();
      return;
    }
    Alert.alert(
      'Nothing to restore',
      result.error || 'We could not find a previous purchase for this Apple Account.'
    );
  }, [busy, restore, router]);

  const openLink = useCallback((url) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open the link', 'Please try again, or visit cork-and-note.vercel.app.')
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={26} color={colors.primary.burgundy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* 3.1.2: the subscription's name. */}
        <Text style={styles.title}>Cork &amp; Note Pro</Text>
        <Text style={styles.subtitle}>
          {source === 'label_scan'
            ? `You get ${FREE_MONTHLY_LIMITS.label_scan} free scans a month. Pro reads as many labels as you can point a camera at.`
            : source === 'chat'
              ? `You get ${FREE_MONTHLY_LIMITS.chat} free sommelier messages a month. Pro never counts.`
              : source === 'cellar'
                ? `A free cellar holds ${FREE_CELLAR_BOTTLE_LIMIT} bottles. Pro holds your whole collection.`
                : source === 'export'
                  ? 'Exporting your tastings to CSV is part of Pro.'
                  : 'Your journal stays free, forever. Pro unlocks the parts that think.'}
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.text} style={styles.benefitRow}>
              <Ionicons name={benefit.icon} size={18} color={colors.primary.burgundy} />
              <Text style={styles.benefitText}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary.burgundy} />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        ) : !purchasesAvailable || !packages?.length ? (
          // Honest dead end rather than a button that does nothing: this is what a
          // build without the native SDK, or a store outage, actually looks like.
          <View style={styles.unavailable}>
            <Text style={styles.unavailableText}>
              Subscriptions aren&apos;t available on this device right now. Please try again later.
            </Text>
          </View>
        ) : (
          <View style={styles.plans}>
            {packages.map((pkg) => {
              const isSelected = pkg.identifier === selected?.identifier;
              const trial = packageTrialLabel(pkg);
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.plan, isSelected && styles.planSelected]}
                  onPress={() => setSelected(pkg)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.85}
                >
                  <View style={styles.planMain}>
                    {/* 3.1.2: length of subscription + price per period. */}
                    <Text style={styles.planPeriod}>
                      {packagePeriod(pkg) === 'year' ? 'Annual' : 'Monthly'}
                    </Text>
                    <Text style={styles.planPrice}>{packagePriceLine(pkg)}</Text>
                    {trial ? <Text style={styles.planTrial}>{trial}</Text> : null}
                  </View>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? colors.primary.burgundy : colors.neutral.stone}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, (!selected || busy || isPro) && styles.ctaDisabled]}
          onPress={handlePurchase}
          disabled={!selected || busy || isPro}
          accessibilityRole="button"
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator color={colors.neutral.cream} />
          ) : (
            <Text style={styles.ctaText}>
              {isPro ? 'You already have Pro' : packageTrialLabel(selected) ? 'Start free trial' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 3.1.2: auto-renew disclosure, in plain language, before purchase. */}
        <Text style={styles.legalese}>
          Payment is charged to your Apple Account at confirmation of purchase. Your subscription
          renews automatically for the same price and period unless you cancel at least 24 hours
          before the end of the current period. Manage or cancel it any time in your Apple Account
          settings. Any unused part of a free trial is forfeited when you subscribe.
        </Text>

        <View style={styles.footerLinks}>
          {/* 3.1.2: Restore, Terms and Privacy, all on the paywall. */}
          <TouchableOpacity onPress={handleRestore} disabled={busy} accessibilityRole="button">
            <Text style={styles.link}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={styles.linkDivider}>·</Text>
          <TouchableOpacity onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
            <Text style={styles.link}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.linkDivider}>·</Text>
          <TouchableOpacity onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    alignItems: 'flex-end',
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '600',
    color: colors.primary.burgundy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.charcoal,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  benefits: { marginTop: spacing.lg, gap: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitText: { flex: 1, fontSize: 15, color: colors.neutral.charcoal },
  loading: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText: { fontSize: 14, color: colors.neutral.pewter },
  unavailable: { paddingVertical: spacing.lg },
  unavailableText: { fontSize: 14, color: colors.neutral.pewter, textAlign: 'center' },
  plans: { marginTop: spacing.lg, gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: 10,
    padding: spacing.md,
    minHeight: 44,
  },
  planSelected: { borderColor: colors.primary.burgundy, borderWidth: 2 },
  planMain: { flex: 1 },
  planPeriod: { fontFamily: SERIF, fontSize: 17, fontWeight: '600', color: colors.neutral.charcoal },
  planPrice: { fontSize: 15, color: colors.neutral.charcoal, marginTop: 2 },
  planTrial: { fontSize: 13, color: colors.primary.burgundy, marginTop: 2 },
  cta: {
    backgroundColor: colors.primary.burgundy,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.neutral.cream, fontSize: 16, fontWeight: '600' },
  legalese: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.neutral.pewter,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  link: {
    fontSize: 13,
    color: colors.primary.burgundy,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  linkDivider: { fontSize: 13, color: colors.neutral.pewter },
});
