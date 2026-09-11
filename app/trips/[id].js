// app/trips/[id].js: a saved wine day, as an editable mapless itinerary.
// Design brief: docs/research/pro-features-ux-and-implementation-2026-09-11.md
// section 7.
//
// The timeline is recomputed in code from the plan's stops, drive legs and
// settings. Visit lengths only need a recompute; reordering, swapping and
// removing a stop re-run the routes function first. Every change is saved.
// Hours come live from Google for the trip's weekday (Pro, bounded to the
// stops, never persisted, never parsed into the schedule). The sommelier's
// notes are fetched on demand so a saved day opens instantly.
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
import Button from '../../components/Button';
import CellarOptionSheet from '../../components/CellarOptionSheet';
import Chip from '../../components/Chip';
import ScreenHeader from '../../components/ScreenHeader';
import TripTimeline from '../../components/TripTimeline';
import { usePro } from '../../hooks/usePro';
import {
  DEFAULTS,
  TRANSPORT_REMINDER,
  VISIT_MINUTE_OPTIONS,
  askSommelierAboutDay,
  directionsFallbackUrl,
  directionsUrl,
  fetchStopHours,
  formatClock,
  formatTripDate,
  isProRequired,
  loadCandidates,
  routesService,
  scheduleForPlan,
  tripsService,
} from '../../lib/trips';
import { createThemedStyles } from '../../styles/ThemeProvider';

export default function TripDetailScreen() {
  const { colors, spacing, styles } = useScreenTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isPro, presentPaywall } = usePro();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [routeNote, setRouteNote] = useState(null);

  const [hoursByIndex, setHoursByIndex] = useState({});
  const [hoursLoading, setHoursLoading] = useState(false);

  const [swapIndex, setSwapIndex] = useState(null);
  const [swapOptions, setSwapOptions] = useState([]);
  const [swapCandidates, setSwapCandidates] = useState([]);

  const [asking, setAsking] = useState(false);

  const schedule = plan ? scheduleForPlan(plan) : null;

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    tripsService.get(id).then((res) => {
      if (!active) return;
      if (res.success) setPlan(res.plan);
      else setLoadError(res.error || 'Plan not found');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  // ── Hours (live, Pro, bounded to the stops) ───────────────────────────
  const stopSignature = (plan?.stops || []).map((s) => `${s.key}:${s.placeId || ''}`).join('|');
  useEffect(() => {
    if (!isPro || !plan?.stops?.length) return undefined;
    let active = true;
    setHoursLoading(true);
    (async () => {
      const results = await Promise.all(plan.stops.map((stop) => fetchStopHours(stop, plan.trip_date)));
      if (!active) return;
      const next = {};
      let learnedPlaceId = false;
      const stops = plan.stops.map((stop, index) => {
        next[index] = results[index];
        if (results[index].placeId && !stop.placeId) {
          learnedPlaceId = true;
          return { ...stop, placeId: results[index].placeId };
        }
        return stop;
      });
      setHoursByIndex(next);
      setHoursLoading(false);
      // Place ids are the one Google datum we may keep; storing them means
      // the next open skips the match call entirely.
      if (learnedPlaceId) {
        const res = await tripsService.update(plan.id, { stops });
        if (active && res.success) setPlan(res.plan);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, plan?.id, plan?.trip_date, stopSignature]);

  // ── Save helpers ──────────────────────────────────────────────────────
  const persist = useCallback(
    async (patch) => {
      setSaving(true);
      try {
        const res = await tripsService.update(plan.id, patch);
        if (res.success) setPlan(res.plan);
        else Alert.alert('Could not save', res.error || 'Please try again.');
        return res.success;
      } finally {
        setSaving(false);
      }
    },
    [plan?.id]
  );

  /** Reorder, swap or remove: re-route, recompute and save. */
  const applyStops = async (stops) => {
    if (!plan) return;
    if (stops.length === 0) {
      const gone = await tripsService.remove(plan.id);
      if (gone.success) router.back();
      else Alert.alert('Could not delete this day', gone.error || 'Please try again.');
      return;
    }
    setSaving(true);
    setRouteNote(null);
    try {
      const routed = await routesService.legs({
        origin: { lat: plan.start_lat, lng: plan.start_lng },
        stops,
      });
      let legs = plan.legs || [];
      if (routed.success) {
        legs = routed.legs;
      } else {
        // Keep the plan editable: the stops change, the legs go unknown.
        legs = [];
        if (isProRequired(routed)) presentPaywall('trip_plan');
        setRouteNote(
          isProRequired(routed)
            ? 'Drive times need Pro. Your order is saved without them.'
            : `Drive times could not be refreshed. ${routed.error || ''}`.trim()
        );
      }
      const next = { ...plan, stops, legs };
      const res = await tripsService.update(plan.id, { stops, legs, schedule: scheduleForPlan(next) });
      if (res.success) setPlan(res.plan);
      else Alert.alert('Could not save', res.error || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setVisitMinutes = async (index, minutes) => {
    const stops = plan.stops.map((stop, i) => (i === index ? { ...stop, visitMinutes: minutes } : stop));
    await persist({ stops, schedule: scheduleForPlan({ ...plan, stops }) });
  };

  const moveStop = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= plan.stops.length) return;
    const stops = [...plan.stops];
    [stops[index], stops[target]] = [stops[target], stops[index]];
    applyStops(stops);
  };

  const removeStop = (index) => {
    const stop = plan.stops[index];
    Alert.alert('Remove this stop?', stop?.name || '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => applyStops(plan.stops.filter((_, i) => i !== index)),
      },
    ]);
  };

  const openSwap = async (index) => {
    setSwapIndex(index);
    setSwapOptions([]);
    const res = await loadCandidates({
      center: { lat: plan.start_lat, lng: plan.start_lng },
      exclude: plan.stops.map((s) => s.key),
      limit: 10,
    });
    const candidates = res.success ? res.candidates : [];
    setSwapCandidates(candidates);
    setSwapOptions(
      candidates.length
        ? candidates.map((c) => ({ key: c.key, label: `${c.name} · ${Math.round(c.distanceKm)} km` }))
        : [{ key: '__none', label: 'No other wineries found nearby' }]
    );
  };

  const chooseSwap = (key) => {
    const candidate = swapCandidates.find((c) => c.key === key);
    const index = swapIndex;
    setSwapIndex(null);
    if (!candidate || index === null) return;
    const replacement = {
      key: candidate.key,
      name: candidate.name,
      lat: candidate.lat,
      lng: candidate.lng,
      source: candidate.source,
      directoryId: candidate.directoryId ?? null,
      wineryId: candidate.wineryId ?? null,
      city: candidate.city ?? null,
      state: candidate.state ?? null,
      website: candidate.website ?? null,
      visitMinutes: plan.stops[index]?.visitMinutes ?? DEFAULTS.visitMinutes,
    };
    applyStops(plan.stops.map((stop, i) => (i === index ? replacement : stop)));
  };

  const openDirections = (stop) => {
    Linking.openURL(directionsUrl(stop)).catch(() => Linking.openURL(directionsFallbackUrl(stop)));
  };

  const openWebsite = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Could not open the website'));
  };

  const askSommelier = async () => {
    setAsking(true);
    try {
      const res = await askSommelierAboutDay({ ...plan, schedule });
      if (!res.success) {
        if (isProRequired(res)) presentPaywall('trip_plan');
        else Alert.alert('The sommelier is unavailable', res.error || 'Please try again.');
        return;
      }
      await persist({ ai_notes: res.notes });
    } finally {
      setAsking(false);
    }
  };

  const deletePlan = () => {
    Alert.alert('Delete this day?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await tripsService.remove(plan.id);
          if (res.success) router.back();
          else Alert.alert('Could not delete', res.error || 'Please try again.');
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.safeArea}>
        <ScreenHeader title="Your wine day" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.ink} />
        </View>
      </View>
    );
  }
  if (!plan) {
    return (
      <View style={styles.safeArea}>
        <ScreenHeader title="Your wine day" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.body}>{loadError || 'This day could not be found.'}</Text>
        </View>
      </View>
    );
  }

  const notes = plan.ai_notes;
  const busy = saving;

  const renderStopExtras = (index) => {
    const stop = plan.stops[index];
    const info = hoursByIndex[index];
    const website = info?.website || stop.website || null;
    return (
      <View style={styles.extras}>
        <Text style={styles.hours}>
          {!isPro
            ? 'Hours need Pro. Check the winery website.'
            : hoursLoading && !info
              ? 'Checking hours…'
              : info?.businessStatus === 'CLOSED_PERMANENTLY'
                ? 'Google lists this winery as permanently closed.'
                : info?.hours
                  ? `Hours on ${formatTripDate(plan.trip_date).split(',')[0]}: ${info.hours}`
                  : 'Hours unknown, check the winery website'}
        </Text>
        {isPro && info?.hours ? <Text style={styles.attribution}>Hours from Google</Text> : null}

        <View style={styles.chipRow}>
          {VISIT_MINUTE_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={(stop.visitMinutes ?? DEFAULTS.visitMinutes) === minutes}
              onPress={() => setVisitMinutes(index, minutes)}
              disabled={busy}
            />
          ))}
        </View>

        <View style={styles.actionRow}>
          {website ? (
            <ActionLink icon="globe-outline" label="Website" onPress={() => openWebsite(website)} styles={styles} colors={colors} />
          ) : null}
          <ActionLink icon="navigate-outline" label="Directions" onPress={() => openDirections(stop)} styles={styles} colors={colors} />
          <ActionLink icon="swap-horizontal-outline" label="Swap" onPress={() => openSwap(index)} disabled={busy} styles={styles} colors={colors} />
          <ActionLink icon="trash-outline" label="Remove" onPress={() => removeStop(index)} disabled={busy} styles={styles} colors={colors} />
          <ActionLink
            icon="chevron-up"
            label="Up"
            onPress={() => moveStop(index, -1)}
            disabled={busy || index === 0}
            styles={styles}
            colors={colors}
          />
          <ActionLink
            icon="chevron-down"
            label="Down"
            onPress={() => moveStop(index, 1)}
            disabled={busy || index === plan.stops.length - 1}
            styles={styles}
            colors={colors}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <ScreenHeader
        title={plan.title || 'Your wine day'}
        subtitle={formatTripDate(plan.trip_date)}
        onBack={() => router.back()}
        right={busy ? <ActivityIndicator size="small" color={colors.primary.ink} /> : null}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.summaryLine}>
          {formatClock(plan.start_time)} to {formatClock(plan.end_time)} from {plan.start_label}
        </Text>
        {routeNote ? <Text style={styles.note}>{routeNote}</Text> : null}
        {schedule?.unknownLegs && !routeNote ? (
          <Text style={styles.note}>Some drive times are unknown, so arrival times are estimates without them.</Text>
        ) : null}

        <TripTimeline
          schedule={schedule}
          stops={plan.stops}
          startLabel={plan.start_label}
          endTime={plan.end_time}
          renderStopExtras={renderStopExtras}
        />

        <View style={styles.reminderBox}>
          <Ionicons name="car-sport-outline" size={18} color={colors.accent.ink} />
          <Text style={styles.reminderText}>{TRANSPORT_REMINDER}</Text>
        </View>

        {notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.sectionLabel}>FROM YOUR SOMMELIER</Text>
            {notes.summary ? <Text style={styles.notesBody}>{notes.summary}</Text> : null}
            {(notes.stopNotes || []).map((entry) => (
              <View key={entry.index} style={styles.noteRow}>
                <Text style={styles.noteTitle}>
                  {entry.index + 1}. {plan.stops[entry.index]?.name || 'Stop'}
                </Text>
                <Text style={styles.notesBody}>{entry.note}</Text>
              </View>
            ))}
            {(notes.tips || []).length ? (
              <View style={styles.noteRow}>
                <Text style={styles.noteTitle}>Tips</Text>
                {notes.tips.map((tip, i) => (
                  <Text key={i} style={styles.notesBody}>• {tip}</Text>
                ))}
              </View>
            ) : null}
            <Button
              variant="ghost"
              title="Ask again"
              onPress={askSommelier}
              loading={asking}
              disabled={busy}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : (
          <Button
            variant="outline"
            title="Ask the sommelier about this day"
            icon="sparkles"
            onPress={askSommelier}
            loading={asking}
            disabled={busy}
            style={{ marginTop: spacing.lg }}
          />
        )}

        <Button
          variant="ghost"
          title="Delete this day"
          onPress={deletePlan}
          disabled={busy}
          style={{ marginTop: spacing.md }}
          textStyle={{ color: colors.status.error }}
        />
      </ScrollView>

      <CellarOptionSheet
        visible={swapIndex !== null}
        title="Swap for"
        options={swapOptions.length ? swapOptions : [{ key: '__loading', label: 'Finding wineries nearby…' }]}
        selected={null}
        onSelect={chooseSwap}
        onClose={() => setSwapIndex(null)}
      />
    </View>
  );
}

function ActionLink({ icon, label, onPress, disabled, styles, colors }) {
  const ink = disabled ? colors.neutral.border : colors.primary.ink;
  return (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={ink} />
      <Text style={[styles.actionText, { color: ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.neutral.bg },
    centered: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
    body: { ...typography.body.regular, color: colors.neutral.inkSecondary },
    summaryLine: { ...typography.body.regular, color: colors.neutral.inkSecondary, marginBottom: spacing.md },
    note: { ...typography.body.small, color: colors.status.drinkSoon, marginBottom: spacing.md },
    extras: { marginTop: spacing.sm },
    hours: { ...typography.body.small, color: colors.neutral.inkSecondary },
    attribution: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: 2 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.sm },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs + 2,
      paddingRight: spacing.md,
      minHeight: 36,
    },
    actionText: { ...typography.body.small, fontWeight: '600' },
    reminderBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    reminderText: { ...typography.body.small, color: colors.accent.ink, flex: 1 },
    notesCard: {
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    sectionLabel: { ...typography.body.caption, color: colors.accent.ink, marginBottom: spacing.sm },
    notesBody: { ...typography.body.regular, color: colors.neutral.ink, marginBottom: spacing.xs },
    noteRow: { marginTop: spacing.sm },
    noteTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600', marginBottom: 2 },
  });
  return { colors, spacing, styles };
});
