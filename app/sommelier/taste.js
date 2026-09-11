// app/sommelier/taste.js: the "My taste" Pro tool.
//
// Three states, decided by the user's own journal before Pro is ever asked:
//   progress            fewer than five distinct rated wines, everyone, no paywall
//   preview (free)      enough wines, real numbers, a labelled SAMPLE narrative
//   report (Pro)        the saved report, or a "Create my report" call to action
//
// A saved report stays readable after Pro lapses; only writing a new one is
// gated. All numbers come from lib/tasteProfile.js; the model only writes prose.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeBack } from '../../hooks/useSafeBack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '../../components/Button';
import { CompositionBars } from '../../components/CompositionBars';
import ProFeaturePreview from '../../components/ProFeaturePreview';
import ScreenHeader from '../../components/ScreenHeader';
import { usePro } from '../../hooks/usePro';
import { isPaywallError } from '../../lib/pro';
import {
  MIN_DISTINCT_FOR_REPORT,
  SAMPLE_TASTE_REPORT,
  buildAggregates,
  collectRatedWines,
  reportTier,
  sourceRevision,
  tasteReportService,
} from '../../lib/tasteProfile';
import { visitsService } from '../../lib/visits';
import { createThemedStyles } from '../../styles/ThemeProvider';

const ASK_PROMPT = 'Based on my taste report, what should I try next?';
const STAGES = ['Reading your journal', 'Finding what keeps standing out', 'Writing your report'];
const SLIDER_LABELS = {
  sweetness: 'Sweetness',
  tannin: 'Tannin',
  acidity: 'Acidity',
  body: 'Body',
  alcohol: 'Alcohol',
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

export default function TasteScreen() {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(tabs)/sommelier');
  const { isPro, presentPaywall } = usePro();

  const [loaded, setLoaded] = useState(false);
  const [rated, setRated] = useState([]);
  const [saved, setSaved] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [visitsRes, reportRes] = await Promise.all([
          visitsService.getUserVisits().catch(() => ({ success: false })),
          tasteReportService.loadLatest().catch(() => ({ success: false, report: null })),
        ]);
        if (!active) return;
        setRated(visitsRes?.success ? collectRatedWines(visitsRes.visits) : []);
        // Keep whatever we already had if the read failed (offline): the last
        // saved report is the whole point of saving it.
        if (reportRes?.success) setSaved(reportRes.report);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const aggregates = useMemo(() => buildAggregates(rated), [rated]);
  const tier = reportTier(aggregates.counts);
  const revision = useMemo(() => sourceRevision(rated), [rated]);
  const stale = !!saved && saved.source_revision !== revision;

  const generate = async () => {
    if (!isPro) {
      presentPaywall('taste_report');
      return;
    }
    setError(null);
    setGenerating(true);
    const res = await tasteReportService.generate({ rated });
    setGenerating(false);
    if (res.success) {
      setSaved(res.report);
      return;
    }
    if (isPaywallError(res)) {
      presentPaywall('taste_report');
      return;
    }
    setError(res.error || 'Something went wrong. Please try again.');
  };

  const remove = async () => {
    if (!saved) return;
    const res = await tasteReportService.remove(saved.id);
    if (res.success) setSaved(null);
  };

  const askAbout = () =>
    router.push({ pathname: '/(tabs)/sommelier', params: { ask: ASK_PROMPT } });

  let content;
  if (!loaded) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary.ink} />
      </View>
    );
  } else if (tier === 'progress' && !saved) {
    content = (
      <ProgressState
        counts={aggregates.counts}
        onJournal={() => router.push('/(tabs)/wines')}
        onLog={() => router.push('/(tabs)/log')}
      />
    );
  } else if (saved) {
    content = (
      <ReportView
        saved={saved}
        rated={rated}
        stale={stale}
        isPro={isPro}
        generating={generating}
        error={error}
        onRefresh={generate}
        onRemove={remove}
        onAsk={askAbout}
        onOpenWine={(id) => router.push(`/wine/${id}`)}
      />
    );
  } else if (isPro) {
    content = (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MY TASTE</Text>
        <Text style={styles.title}>What your journal says about you</Text>
        <Text style={styles.body}>
          {`You have rated ${aggregates.counts.distinctWines} distinct wines over ${plural(aggregates.counts.sessions, 'session')}. The sommelier reads all of them and writes three observations, each backed by the tastings behind it.`}
        </Text>
        {generating ? (
          <GeneratingCard />
        ) : (
          <Button
            variant="primary"
            title="Create my report"
            icon="sparkles"
            onPress={generate}
            style={styles.cta}
            accessibilityLabel="Create my report"
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <StatsSections aggregates={aggregates} />
      </ScrollView>
    );
  } else {
    content = (
      <ProFeaturePreview
        source="taste_report"
        title="What your journal says about you"
        body={`You have rated ${aggregates.counts.distinctWines} distinct wines. Your numbers are real. The report itself is written by the sommelier with Pro.`}
        ctaLabel="Unlock my report with Pro"
        above={<StatsSections aggregates={aggregates} compact />}
      >
        <Text style={styles.sampleNote}>A sample of what the sommelier writes, for a fictional journal:</Text>
        <ReportBody report={SAMPLE_TASTE_REPORT} />
      </ProFeaturePreview>
    );
  }

  return (
    <View style={styles.safeArea}>
      <ScreenHeader title="My taste" onBack={goBack} />
      {content}
    </View>
  );
}

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// ── Progress ───────────────────────────────────────────────────────────────

function ProgressState({ counts, onJournal, onLog }) {
  const { colors, styles } = useScreenTheme();
  const done = Math.min(counts.distinctWines, MIN_DISTINCT_FOR_REPORT);
  const pct = (done / MIN_DISTINCT_FOR_REPORT) * 100;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.progressIcon}>
        <Ionicons name="wine-outline" size={32} color={colors.accent.strong} />
      </View>
      <Text style={[styles.title, styles.centerText]}>A little more tasting to go</Text>
      <Text style={[styles.body, styles.centerText]} testID="taste-progress-count">
        {`${counts.distinctWines} of ${MIN_DISTINCT_FOR_REPORT} distinct wines rated`}
      </Text>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: MIN_DISTINCT_FOR_REPORT, now: done }}>
        <View style={[styles.progressFill, { width: `${Math.max(pct, 3)}%` }]} />
      </View>
      <Text style={[styles.caption, styles.centerText]}>
        {counts.sessions === 0
          ? 'No rated sessions yet'
          : `Across ${plural(counts.sessions, 'session')}`}
      </Text>
      <Text style={[styles.body, styles.centerText, { marginTop: 24 }]}>
        Rate the wines you taste, at a winery or at home, and the sommelier will start to see a pattern. Your journal stays free. Pro writes the report when there is enough to work with.
      </Text>
      <Button variant="primary" title="Log a tasting" icon="add" onPress={onLog} style={styles.cta} accessibilityLabel="Log a tasting" />
      <Button variant="ghost" title="Open my journal" onPress={onJournal} accessibilityLabel="Open my journal" />
    </ScrollView>
  );
}

// ── Report ─────────────────────────────────────────────────────────────────

function ReportView({ saved, rated, stale, isPro, generating, error, onRefresh, onRemove, onAsk, onOpenWine }) {
  const { colors, styles } = useScreenTheme();
  const report = saved.report || {};
  const aggregates = saved.aggregates || buildAggregates(rated);
  const wineById = useMemo(() => new Map(rated.map((w) => [String(w.id), w])), [rated]);
  const count = saved.wine_count ?? aggregates?.counts?.distinctWines ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>
        {saved.tier === 'full' ? 'YOUR TASTE REPORT' : 'FIRST IMPRESSIONS'}
      </Text>
      <View style={styles.headlineCard}>
        <Text style={styles.headline} testID="taste-headline">{report.headline}</Text>
        <Text style={styles.caption}>
          {`Based on ${plural(count, 'rated wine')} · ${formatDate(saved.created_at)}`}
        </Text>
      </View>

      {generating ? (
        <GeneratingCard />
      ) : stale ? (
        <View style={styles.staleCard}>
          <Ionicons name="time-outline" size={18} color={colors.accent.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.staleTitle}>New tastings since this report</Text>
            <Text style={styles.caption}>
              {isPro ? 'Refresh to fold them in.' : 'Refreshing the report is part of Pro.'}
            </Text>
          </View>
          <Button variant="outline" title="Refresh report" onPress={onRefresh} accessibilityLabel="Refresh report" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ReportBody report={report} wineById={wineById} onOpenWine={onOpenWine} />

      <Button
        variant="primary"
        title="Ask about my taste"
        icon="chatbubble-ellipses-outline"
        onPress={onAsk}
        style={styles.cta}
        accessibilityLabel="Ask about my taste"
      />

      <StatsSections aggregates={aggregates} />

      <TouchableOpacity onPress={onRemove} style={styles.removeLink} accessibilityRole="button" accessibilityLabel="Remove this report">
        <Text style={styles.removeText}>Remove this report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// The prose part, shared by the real report and the free sample.
function ReportBody({ report, wineById, onOpenWine }) {
  const { styles } = useScreenTheme();
  return (
    <View>
      {(report.observations || []).map((o, i) => (
        <ObservationCard key={i} index={i + 1} observation={o} wineById={wineById} onOpenWine={onOpenWine} />
      ))}
      {(report.try_next || []).length ? (
        <>
          <Text style={styles.sectionLabel}>TRY NEXT</Text>
          {report.try_next.map((t, i) => (
            <View key={i} style={styles.tryCard}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.cardBody}>{t.body}</Text>
            </View>
          ))}
        </>
      ) : null}
      {report.caveat ? <Text style={styles.caveat}>{report.caveat}</Text> : null}
    </View>
  );
}

function ObservationCard({ index, observation, wineById, onOpenWine }) {
  const { colors, styles } = useScreenTheme();
  const [open, setOpen] = useState(false);
  const ids = observation.evidence_wine_ids || [];
  const wines = wineById ? ids.map((id) => wineById.get(String(id))).filter(Boolean) : [];
  const canExpand = !!wineById && ids.length > 0;

  return (
    <View style={styles.obsCard}>
      <View style={styles.obsIndex}>
        <Text style={styles.obsIndexText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{observation.title}</Text>
        <Text style={styles.cardBody}>{observation.body}</Text>
        {canExpand ? (
          <TouchableOpacity
            onPress={() => setOpen((v) => !v)}
            style={styles.evidenceToggle}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide the supporting tastings' : 'See the supporting tastings'}
          >
            <Text style={styles.evidenceToggleText}>
              {open ? 'Hide the supporting tastings' : 'See the supporting tastings'}
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary.ink} />
          </TouchableOpacity>
        ) : null}
        {open ? (
          <View style={styles.evidenceList}>
            {wines.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.evidenceRow}
                onPress={() => onOpenWine?.(w.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${w.name || 'this tasting'}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.evidenceName} numberOfLines={1}>
                    {[w.name || 'Unnamed wine', w.year].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={styles.caption} numberOfLines={1}>
                    {[w.producer, w.place, formatDate(w.visitDate)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.evidenceRating}>{`${w.rating}/5`}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.neutral.inkTertiary} />
              </TouchableOpacity>
            ))}
            {wines.length < ids.length ? (
              <Text style={styles.caption}>
                {wines.length === 0
                  ? 'The supporting tastings were removed from your journal.'
                  : 'Some supporting tastings were removed from your journal.'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function GeneratingCard() {
  const { colors, styles } = useScreenTheme();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.generating}>
      <ActivityIndicator color={colors.primary.ink} />
      <Text style={styles.generatingText}>{`${STAGES[stage]}...`}</Text>
    </View>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────

function StatsSections({ aggregates, compact = false }) {
  const { styles } = useScreenTheme();
  const { counts, byType, byVarietal, topFlavors, sliders } = aggregates;
  const typeRows = byType.map((t) => ({ key: t.type, label: t.type, count: t.count, pct: t.pct }));
  const varietals = byVarietal.slice(0, compact ? 3 : 6);
  const sliderRows = Object.keys(SLIDER_LABELS)
    .map((k) => ({ key: k, label: SLIDER_LABELS[k], ...sliders[k] }))
    .filter((r) => r.n > 0);

  return (
    <View>
      <View style={styles.totals}>
        <Stat n={counts.distinctWines} label={counts.distinctWines === 1 ? 'Wine rated' : 'Wines rated'} />
        <View style={styles.totalDivider} />
        <Stat n={counts.sessions} label={counts.sessions === 1 ? 'Session' : 'Sessions'} />
        <View style={styles.totalDivider} />
        <Stat n={counts.places} label={counts.places === 1 ? 'Place' : 'Places'} />
      </View>

      <Section title="BY TYPE">
        <CompositionBars rows={typeRows} max={compact ? 3 : 5} />
      </Section>

      <Section title="TOP GRAPES" caption="How often you rated each, and how it did">
        {varietals.length ? (
          varietals.map((v) => (
            <MetricRow
              key={v.varietal}
              label={v.varietal}
              value={v.count}
              max={varietals[0].count}
              right={`${plural(v.count, 'wine')} · ${v.avgRating} avg`}
              highlight={v.standsOut}
            />
          ))
        ) : (
          <Text style={styles.caption}>No grapes recorded yet.</Text>
        )}
      </Section>

      {!compact ? (
        <>
          <Section title="FLAVORS YOU RATE HIGHLY" caption="Tagged on wines you gave 4 stars or more">
            {topFlavors.length ? (
              <View style={styles.chips}>
                {topFlavors.map((f) => (
                  <View key={f.name} style={styles.chip}>
                    <Text style={styles.chipText}>{`${f.name} · ${f.count}`}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.caption}>Tag a few flavor notes and they will show up here.</Text>
            )}
          </Section>

          <Section title="HOW YOU RATE STRUCTURE" caption="Average of the sliders you filled in, out of 5">
            {sliderRows.length ? (
              sliderRows.map((r) => (
                <MetricRow key={r.key} label={r.label} value={r.avg} max={5} right={`${r.avg} · ${r.n} rated`} />
              ))
            ) : (
              <Text style={styles.caption}>No structure sliders filled in yet.</Text>
            )}
          </Section>
        </>
      ) : null}
    </View>
  );
}

function Stat({ n, label }) {
  const { styles } = useScreenTheme();
  return (
    <View style={styles.totalCard}>
      <Text style={styles.totalNum}>{n}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, caption, children }) {
  const { styles } = useScreenTheme();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function MetricRow({ label, value, max, right, highlight }) {
  const { colors, styles } = useScreenTheme();
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
          {highlight ? <Text style={styles.standsOut}>  stands out</Text> : null}
        </Text>
        <Text style={styles.caption}>{right}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: highlight ? colors.accent.base : colors.primary.base }]} />
      </View>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const SERIF = typography.fonts.serif;
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.neutral.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerText: { textAlign: 'center' },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },

    eyebrow: { ...typography.body.caption, color: colors.accent.ink, letterSpacing: 0.8, marginBottom: spacing.xs },
    title: { ...typography.heading.h2, color: colors.neutral.ink, fontFamily: SERIF, marginBottom: spacing.sm },
    body: { ...typography.body.regular, color: colors.neutral.inkSecondary, lineHeight: 22 },
    caption: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
    error: { ...typography.body.small, color: colors.status.error, marginTop: spacing.sm },
    cta: { marginTop: spacing.lg, marginBottom: spacing.sm },

    // Progress
    progressIcon: {
      alignSelf: 'center',
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    progressTrack: {
      height: 10,
      borderRadius: borderRadius.round,
      backgroundColor: colors.neutral.divider,
      overflow: 'hidden',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    progressFill: { height: 10, borderRadius: borderRadius.round, backgroundColor: colors.primary.base },

    // Headline
    headlineCard: {
      backgroundColor: colors.primary.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    headline: { ...typography.heading.h2, fontFamily: SERIF, color: colors.neutral.ink, marginBottom: spacing.sm, lineHeight: 30 },

    staleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    staleTitle: { ...typography.body.regular, fontWeight: '600', color: colors.neutral.ink },

    generating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      marginVertical: spacing.md,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
    },
    generatingText: { ...typography.body.regular, color: colors.neutral.inkSecondary, fontStyle: 'italic' },

    // Cards
    obsCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    obsIndex: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    obsIndexText: { fontFamily: SERIF, fontSize: 14, color: colors.primary.ink },
    cardTitle: { ...typography.body.regular, fontWeight: '600', color: colors.neutral.ink, marginBottom: 4 },
    cardBody: { ...typography.body.regular, color: colors.neutral.inkSecondary, lineHeight: 21 },
    tryCard: {
      backgroundColor: colors.accent.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    caveat: { ...typography.body.small, color: colors.neutral.inkTertiary, fontStyle: 'italic', marginTop: spacing.xs },

    evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
    evidenceToggleText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },
    evidenceList: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.neutral.divider },
    evidenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral.divider,
    },
    evidenceName: { ...typography.body.small, fontWeight: '600', color: colors.neutral.ink },
    evidenceRating: { ...typography.body.small, color: colors.accent.ink, fontWeight: '600' },

    // Sample
    sampleNote: { ...typography.body.small, color: colors.neutral.inkTertiary, fontStyle: 'italic', marginBottom: spacing.sm },

    // Stats
    totals: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.md,
    },
    totalCard: { flex: 1, alignItems: 'center' },
    totalNum: { fontFamily: SERIF, fontSize: 28, color: colors.primary.ink },
    totalLabel: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: 2 },
    totalDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neutral.border },

    section: { marginTop: spacing.lg },
    sectionLabel: { ...typography.body.caption, color: colors.accent.ink, letterSpacing: 0.8, marginTop: spacing.sm },
    sectionBody: {
      marginTop: spacing.sm,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    metricRow: { marginBottom: spacing.md },
    metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs },
    metricLabel: { ...typography.body.regular, color: colors.neutral.ink, flex: 1 },
    standsOut: { ...typography.body.caption, color: colors.accent.ink, fontWeight: '700' },
    track: { height: 8, borderRadius: borderRadius.round, backgroundColor: colors.neutral.divider, overflow: 'hidden' },
    fill: { height: 8, borderRadius: borderRadius.round },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      backgroundColor: colors.primary.surface,
      borderRadius: borderRadius.round,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    chipText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },

    removeLink: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
    removeText: { ...typography.body.small, color: colors.neutral.inkTertiary, textDecorationLine: 'underline' },
  });
  return { colors, styles };
});
