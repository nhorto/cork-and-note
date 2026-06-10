// app/cellar/insights.js - "Collection at a glance" insights dashboard (Epic #6 · R6 · #56)
//
// A calm, glanceable reflection surface over the cellar the user already owns:
// headline totals, composition by type / region / vintage, and a recent-months
// consumption trend. This is a pleasure surface, not a control panel — minimal
// chrome, generous whitespace, on-theme.
//
// All aggregation lives in lib/cellarInsights.js (pure functions + one read-only
// loader). The visuals are the dependency-free bars from components/CompositionBars.js.
// Total *value* is intentionally out of scope (needs a pricing source — see R6).
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CompositionBars, TrendBars } from '../../components/CompositionBars';
import { getCellarInsights } from '../../lib/cellarInsights';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function CellarInsightsScreen() {
  const router = useRouter();
  const [insights, setInsights] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Reload on focus so the dashboard reflects bottles added / opened elsewhere.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      (async () => {
        const res = await getCellarInsights().catch(() => ({ success: false }));
        if (!active) return;
        // getCellarInsights always returns an empty-shaped `insights` even on
        // failure, so we can render the empty state rather than erroring out.
        setInsights(res?.insights ?? null);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary.burgundy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>At a glance</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.headerBorder} />

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.burgundy} />
        </View>
      ) : !insights || insights.isEmpty ? (
        <EmptyState onAdd={() => router.push('/cellar/add')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Totals summary={insights.summary} />

          <Section title="By type">
            <CompositionBars rows={insights.byType} />
          </Section>

          <Section title="By region">
            <CompositionBars rows={insights.byRegion} />
          </Section>

          <Section title="By vintage">
            <CompositionBars rows={insights.byVintage} />
          </Section>

          <Section
            title="Recently enjoyed"
            caption={
              insights.trend.hasAny
                ? `${insights.trend.total} bottle${insights.trend.total === 1 ? '' : 's'} opened in the last 6 months`
                : 'Open a bottle to start your trend'
            }
          >
            <TrendBars series={insights.trend.series} max={insights.trend.max} />
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

// Headline numbers: total bottles + ready, with a quiet breadth line beneath.
function Totals({ summary }) {
  const { totalBottles, readyToDrink, lots, producers, regions } = summary;
  const breadth = [
    `${lots} lot${lots === 1 ? '' : 's'}`,
    producers > 0 ? `${producers} producer${producers === 1 ? '' : 's'}` : null,
    regions > 0 ? `${regions} region${regions === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.totals}>
      <View style={styles.totalCard}>
        <Text style={styles.totalNum}>{totalBottles}</Text>
        <Text style={styles.totalLabel}>
          {totalBottles === 1 ? 'Bottle' : 'Bottles'}
        </Text>
      </View>
      <View style={styles.totalDivider} />
      <View style={styles.totalCard}>
        <Text style={[styles.totalNum, { color: colors.status.visited }]}>{readyToDrink}</Text>
        <Text style={styles.totalLabel}>Ready to drink</Text>
      </View>
      {breadth ? <Text style={styles.breadth}>{breadth}</Text> : null}
    </View>
  );
}

function Section({ title, caption, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EmptyState({ onAdd }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="analytics-outline" size={40} color={colors.gold.shimmer} />
      <Text style={styles.emptyTitle}>Your collection, at a glance</Text>
      <Text style={styles.emptyText}>
        Add a few bottles and we&apos;ll show how your cellar breaks down by type, region and
        vintage — plus what you&apos;ve been enjoying lately.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.9} onPress={onAdd}>
        <Ionicons name="add" size={18} color={colors.neutral.cream} />
        <Text style={styles.emptyBtnText}>Add a bottle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerBorder: { height: 1, backgroundColor: colors.gold.muted, marginHorizontal: spacing.lg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Totals
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  totalCard: { flex: 1, alignItems: 'center' },
  totalNum: { fontFamily: 'Georgia', fontSize: 34, color: colors.primary.burgundy },
  totalLabel: { ...typography.body.caption, color: colors.neutral.pewter, marginTop: 2 },
  totalDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neutral.stone },
  breadth: {
    width: '100%',
    textAlign: 'center',
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: spacing.md,
  },

  // Sections
  section: { marginTop: spacing.xl },
  sectionLabel: { ...typography.body.caption, color: colors.gold.shimmer },
  sectionCaption: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 2 },
  sectionBody: {
    marginTop: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyBtnText: { ...typography.body.regular, color: colors.neutral.cream, fontWeight: '600' },
});
