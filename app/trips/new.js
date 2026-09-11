// app/trips/new.js: "Plan a wine day" (Pro tool). Design brief:
// docs/research/pro-features-ux-and-implementation-2026-09-11.md section 7.
//
// Free: the framed sample (a fictional two-stop day) and one upgrade button.
// Pro: starting place, date, times, stop count, saved-first switch, then a
// ranked shortlist to tick and reorder, then "Build my day". The draft is
// saved BEFORE drive times are fetched so a dropped connection never loses
// the user's choices; the built day opens at /trips/[id].
//
// Reached from the Sommelier hub and (later) a map region sheet, which passes
// { areaLabel, areaLat, areaLng, areaRadiusKm } to centre the search there.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../hooks/useSafeBack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import ProFeaturePreview from '../../components/ProFeaturePreview';
import ScreenHeader from '../../components/ScreenHeader';
import TripTimeline from '../../components/TripTimeline';
import { usePro } from '../../hooks/usePro';
import {
  DEFAULTS,
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  STOP_COUNT_OPTIONS,
  TRANSPORT_REMINDER,
  buildSchedule,
  dateChips,
  formatTripDate,
  isProRequired,
  isValidDateString,
  loadCandidates,
  nextSaturday,
  parseTime,
  routesService,
  tripsService,
} from '../../lib/trips';
import { createThemedStyles } from '../../styles/ThemeProvider';

// The free sample: fictional wineries, fictional drive times.
const SAMPLE_STOPS = [
  { name: 'Stone Ridge Vineyards', city: 'Delaplane', state: 'VA', visitMinutes: 75 },
  { name: 'Hollow Creek Cellars', city: 'Linden', state: 'VA', visitMinutes: 75 },
];
const SAMPLE_LEGS = [{ seconds: 28 * 60 }, { seconds: 19 * 60 }];

function readNumberParam(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function NewTripScreen() {
  const { colors, spacing, styles } = useScreenTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(tabs)/sommelier');
  const params = useLocalSearchParams();
  const { isPro, presentPaywall } = usePro();

  const area = useMemo(() => {
    const lat = readNumberParam(params.areaLat);
    const lng = readNumberParam(params.areaLng);
    if (lat === null || lng === null) return null;
    return {
      label: typeof params.areaLabel === 'string' && params.areaLabel.trim() ? params.areaLabel.trim() : 'this area',
      lat,
      lng,
      radiusKm: readNumberParam(params.areaRadiusKm) || DEFAULTS.radiusKm,
    };
  }, [params.areaLabel, params.areaLat, params.areaLng, params.areaRadiusKm]);

  // Saved days
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Form
  const [startLabel, setStartLabel] = useState(area?.label || '');
  const [startCoords, setStartCoords] = useState(area ? { lat: area.lat, lng: area.lng, label: area.label } : null);
  const [locating, setLocating] = useState(false);
  const [date, setDate] = useState(() => nextSaturday());
  const [dateText, setDateText] = useState('');
  const [startTime, setStartTime] = useState(DEFAULTS.startTime);
  const [endTime, setEndTime] = useState(DEFAULTS.endTime);
  const [stopCount, setStopCount] = useState(DEFAULTS.stopCount);
  const [savedFirst, setSavedFirst] = useState(true);
  const chips = useMemo(() => dateChips(), []);

  // Candidates
  const [step, setStep] = useState('form');
  const [candidates, setCandidates] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [finding, setFinding] = useState(false);
  const [candidateNote, setCandidateNote] = useState(null);

  // Build
  const [building, setBuilding] = useState(false);
  const [draftId, setDraftId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!isPro) {
        setPlansLoading(false);
        return undefined;
      }
      let active = true;
      tripsService.list().then((res) => {
        if (!active) return;
        setPlans(res.success ? res.plans : []);
        setPlansLoading(false);
      });
      return () => {
        active = false;
      };
    }, [isPro])
  );

  const sampleSchedule = useMemo(
    () => buildSchedule({ stops: SAMPLE_STOPS, legs: SAMPLE_LEGS, startTime: '11:00', endTime: '17:00' }),
    []
  );

  // ── Starting place ────────────────────────────────────────────────────
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location is off', 'Type a town or address instead, or allow location in Settings.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      let label = 'My location';
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
        const parts = [place?.city || place?.subregion, place?.region].filter(Boolean);
        if (parts.length) label = parts.join(', ');
      } catch {
        // a label is a nicety; the coordinates are what the route needs
      }
      setStartLabel(label);
      setStartCoords({ ...coords, label });
    } catch {
      Alert.alert('Could not get your location', 'Type a town or address instead.');
    } finally {
      setLocating(false);
    }
  };

  const resolveStart = async () => {
    const label = startLabel.trim();
    if (!label) return null;
    if (startCoords && startCoords.label === label) return startCoords;
    const results = await Location.geocodeAsync(label);
    const first = results?.[0];
    if (!first) return null;
    const resolved = { lat: first.latitude, lng: first.longitude, label };
    setStartCoords(resolved);
    return resolved;
  };

  // ── Date ──────────────────────────────────────────────────────────────
  const applyDateText = () => {
    const value = dateText.trim();
    if (!value) return;
    if (!isValidDateString(value)) {
      Alert.alert('Check the date', 'Use the form YYYY-MM-DD, for example 2026-10-03.');
      return;
    }
    setDate(value);
  };

  const timeValid = parseTime(startTime) !== null && parseTime(endTime) !== null && parseTime(startTime) < parseTime(endTime);

  // ── Find wineries ─────────────────────────────────────────────────────
  const findWineries = async () => {
    if (!timeValid) {
      Alert.alert('Check the times', 'Use HH:MM and make the finish later than the start.');
      return;
    }
    setFinding(true);
    setCandidateNote(null);
    try {
      const start = await resolveStart();
      if (!start) {
        Alert.alert('Where are you starting?', 'Type a town or address we can find, or use your location.');
        return;
      }
      const center = area ? { lat: area.lat, lng: area.lng } : { lat: start.lat, lng: start.lng };
      const res = await loadCandidates({
        center,
        radiusKm: area?.radiusKm || DEFAULTS.radiusKm,
        savedFirst,
      });
      if (!res.success || res.candidates.length === 0) {
        setCandidateNote(
          res.directoryError
            ? 'Could not reach the winery directory. Check your connection and try again.'
            : 'No wineries found within reach. Try another starting place.'
        );
        setCandidates([]);
        setSelectedKeys([]);
      } else {
        setCandidates(res.candidates);
        setSelectedKeys(res.candidates.slice(0, stopCount).map((c) => c.key));
        if (res.directoryError) setCandidateNote('Showing your saved wineries only; the directory is unreachable right now.');
      }
      setStep('candidates');
    } catch (error) {
      Alert.alert('Could not find wineries', error.message || 'Please try again.');
    } finally {
      setFinding(false);
    }
  };

  const toggleCandidate = (key) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 4) return prev;
      return [...prev, key];
    });
  };

  const moveSelected = (key, direction) => {
    setSelectedKeys((prev) => {
      const index = prev.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const selectedStops = selectedKeys
    .map((key) => candidates.find((c) => c.key === key))
    .filter(Boolean);

  // ── Build my day ──────────────────────────────────────────────────────
  const buildDay = async () => {
    if (selectedStops.length === 0) {
      Alert.alert('Pick at least one winery');
      return;
    }
    const start = startCoords;
    if (!start) return;
    setBuilding(true);
    try {
      const stops = selectedStops.map((c) => ({
        key: c.key,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        source: c.source,
        directoryId: c.directoryId ?? null,
        wineryId: c.wineryId ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        website: c.website ?? null,
        visitMinutes: DEFAULTS.visitMinutes,
      }));
      const settings = {
        visitMinutes: DEFAULTS.visitMinutes,
        lunchMinutes: DEFAULTS.lunchMinutes,
        lunchAfterStop: DEFAULTS.lunchAfterStop,
      };
      const base = {
        title: `A day around ${area?.label || start.label}`,
        trip_date: date,
        start_label: start.label,
        start_lat: start.lat,
        start_lng: start.lng,
        start_time: startTime,
        end_time: endTime,
        stops,
        settings,
        legs: null,
        schedule: buildSchedule({ startTime, endTime, stops, legs: [], ...settings }),
      };

      // Save the draft first so nothing is lost if drive times fail.
      let id = draftId;
      const saved = id ? await tripsService.update(id, base) : await tripsService.save(base);
      if (!saved.success) {
        Alert.alert('Could not save your day', saved.error || 'Please try again.');
        return;
      }
      id = saved.plan.id;
      setDraftId(id);

      const routed = await routesService.legs({ origin: { lat: start.lat, lng: start.lng }, stops });
      if (!routed.success) {
        if (isProRequired(routed)) {
          presentPaywall('trip_plan');
        } else {
          Alert.alert(
            'Drive times are unavailable',
            `${routed.error || 'Please try again.'} Your draft is saved under Your days.`
          );
        }
        const refreshed = await tripsService.list();
        if (refreshed.success) setPlans(refreshed.plans);
        return;
      }
      const schedule = buildSchedule({ startTime, endTime, stops, legs: routed.legs, ...settings });
      const finished = await tripsService.update(id, { legs: routed.legs, schedule });
      if (!finished.success) {
        Alert.alert('Could not save your day', finished.error || 'Please try again.');
        return;
      }
      setDraftId(null);
      router.replace(`/trips/${id}`);
    } finally {
      setBuilding(false);
    }
  };

  // ── Free ──────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <View style={styles.safeArea}>
        <ScreenHeader title="Plan a wine day" onBack={goBack} />
        <ProFeaturePreview
          source="trip_plan"
          title="A day in wine country, planned"
          body="Pick a start, a date and two or three stops. You get drive times, a schedule with room for lunch, and directions to each stop."
        >
          <TripTimeline
            schedule={sampleSchedule}
            stops={SAMPLE_STOPS}
            startLabel="Middleburg, VA"
            endTime="17:00"
          />
          <Text style={styles.reminder}>{TRANSPORT_REMINDER}</Text>
        </ProFeaturePreview>
      </View>
    );
  }

  // ── Pro ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.safeArea}>
      <ScreenHeader
        title="Plan a wine day"
        subtitle={area ? `A day around ${area.label}` : undefined}
        onBack={() => (step === 'candidates' ? setStep('form') : goBack())}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'form' ? (
          <>
            {plansLoading ? null : plans.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>YOUR DAYS</Text>
                {plans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.planRow}
                    onPress={() => router.push(`/trips/${plan.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${plan.title || 'saved day'}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle} numberOfLines={1}>{plan.title || 'A wine day'}</Text>
                      <Text style={styles.planMeta}>
                        {formatTripDate(plan.trip_date)} · {Array.isArray(plan.stops) ? plan.stops.length : 0} stops
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.neutral.placeholder} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.title}>{area ? `A day around ${area.label}` : 'Build your day'}</Text>

            <Text style={styles.label}>Starting place</Text>
            <TextInput
              style={styles.input}
              value={startLabel}
              onChangeText={(text) => setStartLabel(text)}
              placeholder="Town, address or hotel"
              placeholderTextColor={colors.neutral.placeholder}
              autoCapitalize="words"
              returnKeyType="done"
              accessibilityLabel="Starting place"
            />
            <TouchableOpacity
              style={styles.inlineAction}
              onPress={useMyLocation}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel="Use my location"
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary.ink} />
              ) : (
                <Ionicons name="locate-outline" size={16} color={colors.primary.ink} />
              )}
              <Text style={styles.inlineActionText}>Use my location</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatTripDate(date)}</Text>
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <Chip
                  key={chip.value}
                  label={chip.label}
                  selected={chip.value === date}
                  onPress={() => {
                    setDate(chip.value);
                    setDateText('');
                  }}
                  style={styles.chip}
                />
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={dateText}
              onChangeText={setDateText}
              onBlur={applyDateText}
              onSubmitEditing={applyDateText}
              placeholder="Or type a date, YYYY-MM-DD"
              placeholderTextColor={colors.neutral.placeholder}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Trip date"
            />

            <Text style={styles.label}>Start</Text>
            <View style={styles.chipRow}>
              {START_TIME_OPTIONS.map((t) => (
                <Chip key={t} label={t} selected={t === startTime} onPress={() => setStartTime(t)} style={styles.chip} />
              ))}
              <TextInput
                style={styles.timeInput}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.neutral.placeholder}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Start time"
              />
            </View>

            <Text style={styles.label}>Finish</Text>
            <View style={styles.chipRow}>
              {END_TIME_OPTIONS.map((t) => (
                <Chip key={t} label={t} selected={t === endTime} onPress={() => setEndTime(t)} style={styles.chip} />
              ))}
              <TextInput
                style={styles.timeInput}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.neutral.placeholder}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Finish time"
              />
            </View>

            <Text style={styles.label}>Stops</Text>
            <View style={styles.chipRow}>
              {STOP_COUNT_OPTIONS.map((n) => (
                <Chip key={n} label={`${n} wineries`} selected={n === stopCount} onPress={() => setStopCount(n)} style={styles.chip} />
              ))}
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Start with my saved wineries</Text>
                <Text style={styles.switchHint}>Your want-to-visit list and places you have been come first.</Text>
              </View>
              <Switch
                value={savedFirst}
                onValueChange={setSavedFirst}
                trackColor={{ true: colors.primary.base, false: colors.neutral.border }}
                accessibilityLabel="Start with my saved wineries"
              />
            </View>

            <Button
              variant="primary"
              title="Find wineries"
              icon="search-outline"
              onPress={findWineries}
              loading={finding}
              disabled={!startLabel.trim()}
              style={{ marginTop: spacing.lg }}
            />
            <Text style={styles.reminder}>{TRANSPORT_REMINDER}</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Choose your stops</Text>
            <Text style={styles.body}>
              {formatTripDate(date)}, {startTime} to {endTime}, from {startCoords?.label || startLabel}. Tick up to four and put them in order.
            </Text>
            {candidateNote ? <Text style={styles.note}>{candidateNote}</Text> : null}

            {candidates.map((candidate) => {
              const order = selectedKeys.indexOf(candidate.key);
              const selected = order >= 0;
              return (
                <View key={candidate.key} style={[styles.candidateRow, selected && styles.candidateRowSelected]}>
                  <TouchableOpacity
                    style={styles.candidateMain}
                    onPress={() => toggleCandidate(candidate.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={candidate.name}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary.ink : colors.neutral.inkTertiary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.candidateName} numberOfLines={1}>
                        {selected ? `${order + 1}. ` : ''}{candidate.name}
                      </Text>
                      <Text style={styles.candidateMeta}>
                        {Math.round(candidate.distanceKm)} km
                        {candidate.city ? ` · ${candidate.city}${candidate.state ? `, ${candidate.state}` : ''}` : ''}
                        {candidate.source === 'wishlist' ? ' · On your list' : candidate.source === 'visited' ? ' · Visited' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {selected ? (
                    <View style={styles.orderButtons}>
                      <TouchableOpacity
                        onPress={() => moveSelected(candidate.key, -1)}
                        disabled={order === 0}
                        style={styles.orderButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${candidate.name} up`}
                      >
                        <Ionicons name="chevron-up" size={20} color={order === 0 ? colors.neutral.border : colors.primary.ink} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveSelected(candidate.key, 1)}
                        disabled={order === selectedKeys.length - 1}
                        style={styles.orderButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${candidate.name} down`}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={order === selectedKeys.length - 1 ? colors.neutral.border : colors.primary.ink}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Button
              variant="primary"
              title="Build my day"
              icon="calendar-outline"
              onPress={buildDay}
              loading={building}
              disabled={selectedStops.length === 0}
              style={{ marginTop: spacing.lg }}
            />
            <Button
              variant="ghost"
              title="Change the details"
              onPress={() => setStep('form')}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.reminder}>{TRANSPORT_REMINDER}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.neutral.bg },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
    section: { marginBottom: spacing.lg },
    sectionLabel: { ...typography.body.caption, color: colors.accent.ink, marginBottom: spacing.xs },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    planTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    planMeta: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
    title: { ...typography.heading.h2, color: colors.neutral.ink, marginBottom: spacing.sm },
    body: { ...typography.body.regular, color: colors.neutral.inkSecondary, marginBottom: spacing.md },
    note: { ...typography.body.small, color: colors.status.drinkSoon, marginBottom: spacing.md },
    label: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
    value: { ...typography.body.regular, color: colors.neutral.ink, marginBottom: spacing.xs },
    input: {
      ...typography.body.regular,
      color: colors.neutral.ink,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    timeInput: {
      ...typography.body.small,
      color: colors.neutral.ink,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      minWidth: 76,
      textAlign: 'center',
    },
    inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
    inlineActionText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
    chip: {},
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    switchLabel: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '500' },
    switchHint: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
    candidateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.md,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    candidateRowSelected: { borderColor: colors.primary.base },
    candidateMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    candidateName: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '500' },
    candidateMeta: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
    orderButtons: { flexDirection: 'row' },
    orderButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    reminder: {
      ...typography.body.small,
      color: colors.neutral.inkTertiary,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
  return { colors, spacing, styles };
});
