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
  Image,
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
  FREE_TIER_LIMITS,
  PRIVACY_URL,
  STORE_ACCOUNT_NAME,
  TERMS_URL,
  packagePeriod,
  packagePriceLine,
  packageTrialLabel,
} from '../lib/pro';
import { fetchOffering, fetchTrialEligibility, purchasePackage } from '../lib/purchases';
import { createThemedStyles } from '../styles/ThemeProvider';
import { SUPPORT_EMAIL } from '../lib/legalContent';


// Lead with the sommelier and unlimited scans, not "more journaling" — at $9.99
// this sits with the AI/collector tools, not with the $5 journal apps (§4.2).
const BENEFITS = [
  { icon: 'sparkles', text: 'Unlimited AI sommelier: ask anything, any time' },
  { icon: 'list', text: 'Photograph a wine list and get picks in your budget, based on your ratings' },
  { icon: 'analytics', text: 'A taste report that reads your whole journal and tells you what to try next' },
  { icon: 'car', text: 'Plan a wine day: two or three stops, drive times and a schedule' },
  { icon: 'map', text: 'US wine regions on your map, with the wineries inside each one' },
  { icon: 'scan', text: 'Unlimited label and tasting-card scans' },
  { icon: 'wine', text: 'An unlimited cellar with drink windows and Tonight’s Pick' },
  { icon: 'star', text: 'Google ratings and opening hours on winery pages, where available' },
  { icon: 'download', text: 'Export your tastings to CSV' },
];

export default function PaywallScreen() {
  const { colors, spacing, styles } = useScreenTheme();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams();
  const { isPro, purchasesAvailable, restore, onPurchased } = usePro();

  const [packages, setPackages] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [trialEligibility, setTrialEligibility] = useState({});
  const trialFor = (pkg) => trialEligibility[pkg?.product?.identifier] ? packageTrialLabel(pkg) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setSelected(null);
      try {
        const offering = await fetchOffering();
        if (cancelled) return;
        const available = (offering?.availablePackages ?? [])
          .slice()
          .sort((a, b) => (packagePeriod(a) === 'year' ? -1 : 0) - (packagePeriod(b) === 'year' ? -1 : 0));
        const eligibility = await fetchTrialEligibility(available);
        if (cancelled) return;
        setTrialEligibility(eligibility);
        setPackages(available);
        setSelected(available[0] ?? null);
      } catch (error) {
        if (cancelled) return;
        setPackages([]);
        setLoadError({ message: error.message, code: error.code });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

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
      result.error || `We could not find a previous purchase for this ${STORE_ACCOUNT_NAME}.`
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
          <Ionicons name="close" size={26} color={colors.primary.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Image
          source={require('../assets/images/cork_and_note_logo.png')}
          style={styles.brandMark}
          resizeMode="contain"
          accessibilityLabel="Cork & Note"
        />
        {/* 3.1.2: the subscription's name. */}
        <Text style={styles.title}>Cork &amp; Note Pro</Text>
        <Text style={styles.subtitle}>
          {source === 'label_scan'
            ? `You get ${FREE_TIER_LIMITS.label_scan} free scans to try. Pro reads as many labels as you can point a camera at.`
            : source === 'chat'
              ? `You get ${FREE_TIER_LIMITS.chat} free sommelier messages a month. Pro never counts, and photos come along.`
              : source === 'cellar'
                ? `A free cellar holds ${FREE_CELLAR_BOTTLE_LIMIT} bottles. Pro holds your whole collection.`
                : source === 'export'
                  ? 'Exporting your tastings to CSV is part of Pro.'
                  : source === 'places'
                    ? 'Find wineries and save your favorites for free. Pro adds Google ratings and opening hours to help plan your visit, where available.'
                    : source === 'tonights_pick'
                      ? "Tonight's Pick — a bottle from your own cellar, chosen by your sommelier — is part of Pro."
                      : source === 'onboarding'
                        ? 'Start with the sommelier on call. Your journal itself stays free, forever.'
                        : 'Your journal stays free, forever. Pro unlocks the parts that think.'}
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.text} style={styles.benefitRow}>
              <Ionicons name={benefit.icon} size={18} color={colors.primary.ink} />
              <Text style={styles.benefitText}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary.ink} />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        ) : !purchasesAvailable || !packages?.length ? (
          // Honest dead end rather than a button that does nothing: this is what a
          // build without the native SDK, or a store outage, actually looks like.
          <View style={styles.unavailable}>
            <Text style={styles.unavailableText}>
              {loadError?.message || 'Subscriptions are unavailable right now. Please try again.'}
            </Text>
            {loadError?.code ? <Text style={styles.unavailableText}>Reference: {loadError.code}</Text> : null}
            <TouchableOpacity onPress={() => setAttempt((value) => value + 1)} style={styles.retry} accessibilityRole="button">
              <Text style={styles.link}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.plans}>
            {packages.map((pkg) => {
              const isSelected = pkg.identifier === selected?.identifier;
              const trial = trialFor(pkg);
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
                    color={isSelected ? colors.primary.ink : colors.neutral.border}
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
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>
              {isPro ? 'You already have Pro' : trialFor(selected) ? 'Start free trial' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        {trialFor(selected) ? <Text style={styles.legalese}>
          {trialFor(selected)}, then {packagePriceLine(selected)}. Cancel before the trial ends to avoid being charged.
        </Text> : null}
        {/* 3.1.2: auto-renew disclosure, in plain language, before purchase.
            STORE_ACCOUNT_NAME names the store this build actually bills through
            (Apple Account on iOS, Google Play account on Android). */}
        <Text style={styles.legalese}>
          Payment is charged to your {STORE_ACCOUNT_NAME} at confirmation of purchase. Your
          subscription renews automatically for the same price and period unless you cancel at
          least 24 hours before the end of the current period. Manage or cancel it any time in
          your {STORE_ACCOUNT_NAME} settings. Any unused part of a free trial is forfeited when
          you subscribe.
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
          <Text style={styles.linkDivider}>·</Text>
          <TouchableOpacity onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)} accessibilityRole="link">
            <Text style={styles.link}>Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, spacing, typography } = theme;
const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.bg },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    alignItems: 'flex-end',
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  brandMark: { width: 88, height: 88, alignSelf: 'center', marginBottom: spacing.md },
  retry: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  title: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '600',
    color: colors.primary.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.ink,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  benefits: { marginTop: spacing.lg, gap: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitText: { flex: 1, fontSize: 15, color: colors.neutral.ink },
  loading: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText: { fontSize: 14, color: colors.neutral.inkTertiary },
  unavailable: { paddingVertical: spacing.lg },
  unavailableText: { fontSize: 14, color: colors.neutral.inkTertiary, textAlign: 'center' },
  plans: { marginTop: spacing.lg, gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: spacing.md,
    minHeight: 44,
  },
  planSelected: { borderColor: colors.primary.base, borderWidth: 2 },
  planMain: { flex: 1 },
  planPeriod: { fontFamily: SERIF, fontSize: 17, fontWeight: '600', color: colors.neutral.ink },
  planPrice: { fontSize: 15, color: colors.neutral.ink, marginTop: 2 },
  planTrial: { fontSize: 13, color: colors.primary.ink, marginTop: 2 },
  cta: {
    backgroundColor: colors.primary.base,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  legalese: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.neutral.inkTertiary,
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
    color: colors.primary.ink,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  linkDivider: { fontSize: 13, color: colors.neutral.inkTertiary },
});
return { colors, spacing, styles };
});
