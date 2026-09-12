// app/sommelier/wine-list.js: the "Choose from a wine list" Pro tool (§4).
//
// One screen, four steps, one draft kept in local state the whole time:
//   Capture (up to 3 photos) -> Check the list (edit rows and prices)
//   -> Preferences (budget, serving, meal, use my ratings) -> Picks (up to 3)
//
// The budget filter runs in code before the pick call (lib/wineList.js), so
// nothing over budget ever reaches the model. A server 402 opens the paywall
// and leaves the draft where it was; the paywall is a modal, so when it grants
// Pro the screen re-renders into its real state with the draft intact. Free
// users see a labelled sample plus any lists they saved before Pro expired.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeBack } from '../../hooks/useSafeBack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { usePro } from '../../hooks/usePro';
import { isPaywallError } from '../../lib/pro';
import {
  DEFAULT_CURRENCY,
  MAX_PHOTOS,
  PICK_LABELS,
  filterEntries,
  formatPrice,
  minorToText,
  normalizeEntries,
  textToMinor,
  wineListService,
} from '../../lib/wineList';
import { createThemedStyles } from '../../styles/ThemeProvider';

const STEPS = [
  { key: 'capture', label: 'Capture' },
  { key: 'check', label: 'Check the list' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'picks', label: 'Picks' },
];
const stepIndex = (key) => STEPS.findIndex((s) => s.key === key);

const SERVING_OPTIONS = [
  { key: 'any', label: 'Any' },
  { key: 'glass', label: 'Glass' },
  { key: 'bottle', label: 'Bottle' },
];
const ROW_SERVINGS = [
  { key: 'glass', label: 'Glass' },
  { key: 'bottle', label: 'Bottle' },
  { key: 'other', label: 'Other' },
];

const DEFAULT_PREFERENCES = { budgetText: '', serving: 'any', meal: '', useRatings: true };

// Fictional sample for the free preview. Nothing here is a real producer.
const SAMPLE_ENTRIES = [
  { entry_id: 's1', producer: 'Hollow Oak Cellars', wine_name: 'Cabernet Franc', vintage: 2021, price_minor: 1400, currency: 'USD', serving: 'glass' },
  { entry_id: 's2', producer: 'Marlowe Ridge', wine_name: 'Viognier', vintage: 2022, price_minor: 1200, currency: 'USD', serving: 'glass' },
  { entry_id: 's3', producer: 'Stone Fence Estate', wine_name: 'Meritage', vintage: 2019, price_minor: 5800, currency: 'USD', serving: 'bottle' },
];
const SAMPLE_PICK = {
  entry_id: 's1',
  label: 'closest_to_favorites',
  reason: 'At $14 a glass this Cabernet Franc sits inside your $20 budget, and it is the style you rate highest in your journal.',
  evidence: ['You rated two Virginia Cabernet Francs 4.5 stars', 'Medium body and soft tannin suit the roast chicken you mentioned'],
};

// Editable copies of scanned entries keep text fields as strings so typing
// "24." in a price box is not rewritten to "24.00" under the cursor.
const toDraft = (e) => ({
  ...e,
  producer: e.producer || '',
  vintageText: e.vintage ? String(e.vintage) : '',
  priceText: minorToText(e.price_minor),
});
const fromDraft = (d) => ({
  entry_id: d.entry_id,
  page_index: d.page_index,
  producer: d.producer,
  wine_name: d.wine_name,
  vintage: d.vintageText,
  price_minor: textToMinor(d.priceText),
  currency: d.currency,
  serving: d.serving,
  uncertain_fields: d.uncertain_fields,
});
const blankDraft = (n, currency) => ({
  entry_id: `n${n}`,
  page_index: 0,
  producer: '',
  wine_name: '',
  vintageText: '',
  priceText: '',
  price_minor: null,
  currency,
  serving: null,
  uncertain_fields: [],
});

const describeEntry = (e) =>
  [e?.producer, e?.wine_name, e?.vintage ? String(e.vintage) : null].filter(Boolean).join(' ') || 'this wine';

const sessionTitle = (session) => {
  if (session?.title) return session.title;
  const d = session?.created_at ? new Date(session.created_at) : new Date();
  return `List from ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

export default function WineListScreen() {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(tabs)/sommelier');
  const { isPro, isLoading, presentPaywall } = usePro();

  const [step, setStep] = useState('capture');
  const [maxStep, setMaxStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [scanNotes, setScanNotes] = useState(null);
  const [entries, setEntries] = useState([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [picks, setPicks] = useState([]);
  const [pickNote, setPickNote] = useState(null);
  const [usedRatings, setUsedRatings] = useState(true);
  const [busy, setBusy] = useState(null); // 'scan' | 'pick' | 'save'
  const [error, setError] = useState(null);
  const [emptyScan, setEmptyScan] = useState(false);
  const [noneInBudget, setNoneInBudget] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let active = true;
    wineListService.list().then((res) => {
      if (active && res?.success) setSessions(res.sessions || []);
    });
    return () => {
      active = false;
    };
  }, []);

  const goTo = useCallback((key) => {
    setError(null);
    setStep(key);
    setMaxStep((m) => Math.max(m, stepIndex(key)));
  }, []);

  const resetAll = useCallback(() => {
    setStep('capture');
    setMaxStep(0);
    setPhotos([]);
    setDrafts([]);
    setScanNotes(null);
    setEntries([]);
    setCurrency(DEFAULT_CURRENCY);
    setPreferences(DEFAULT_PREFERENCES);
    setPicks([]);
    setPickNote(null);
    setBusy(null);
    setError(null);
    setEmptyScan(false);
    setNoneInBudget(false);
    setSavedId(null);
    setReadOnly(false);
  }, []);

  // ── Capture ─────────────────────────────────────────────────────────

  const addPhoto = useCallback(async (source) => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const ask =
        source === 'camera'
          ? ImagePicker.requestCameraPermissionsAsync
          : ImagePicker.requestMediaLibraryPermissionsAsync;
      const { status } = await ask();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          source === 'camera' ? 'Camera access is needed to photograph the list.' : 'Photo library access is needed to choose a photo.'
        );
        return;
      }
      const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      const uri = !result.canceled && result.assets?.[0]?.uri;
      if (uri) {
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, uri]));
        setError(null);
        setEmptyScan(false);
      }
    } catch {
      Alert.alert(
        source === 'camera' ? 'Camera unavailable' : 'Library unavailable',
        source === 'camera' ? 'Could not open the camera. You can choose from your library instead.' : 'Could not open your photo library. You can use the camera instead.'
      );
    }
  }, [photos.length]);

  const removePhoto = useCallback((index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const runScan = useCallback(async () => {
    if (!photos.length || busy) return;
    setBusy('scan');
    setError(null);
    setEmptyScan(false);
    const res = await wineListService.scan(photos);
    setBusy(null);
    if (res.success) {
      const list = res.entries;
      setEntries(list);
      setDrafts(list.map(toDraft));
      setCurrency(list[0]?.currency || DEFAULT_CURRENCY);
      setScanNotes(res.notes || null);
      setSavedId(null);
      setPicks([]);
      goTo('check');
      return;
    }
    if (isPaywallError(res)) {
      presentPaywall('wine_list_pick');
      return;
    }
    if (res.empty) setEmptyScan(true);
    setError(res.error || 'Could not read the list. Please try again.');
  }, [photos, busy, goTo, presentPaywall]);

  // "Type a few options" after an empty read: three blank rows to fill in.
  const typeInstead = useCallback(() => {
    setDrafts([blankDraft(1, currency), blankDraft(2, currency), blankDraft(3, currency)]);
    setScanNotes(null);
    setEmptyScan(false);
    goTo('check');
  }, [currency, goTo]);

  // ── Check ───────────────────────────────────────────────────────────

  const updateDraft = useCallback((index, patch) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }, []);
  const removeDraft = useCallback((index) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const addDraft = useCallback(() => {
    setDrafts((prev) => [...prev, blankDraft(prev.length + 1, currency)]);
  }, [currency]);

  const confirmList = useCallback(() => {
    const committed = normalizeEntries(drafts.map(fromDraft));
    if (!committed.length) {
      setError('Add at least one wine with a name before continuing.');
      return;
    }
    setEntries(committed);
    setDrafts(committed.map(toDraft));
    setNoneInBudget(false);
    goTo('preferences');
  }, [drafts, goTo]);

  // ── Preferences and picks ───────────────────────────────────────────

  const budgetMinor = useMemo(() => textToMinor(preferences.budgetText), [preferences.budgetText]);

  const findPicks = useCallback(async () => {
    if (busy) return;
    const shortlist = filterEntries(entries, { budgetMinor, serving: preferences.serving });
    if (!shortlist.length) {
      setNoneInBudget(true);
      return;
    }
    setNoneInBudget(false);
    setBusy('pick');
    setError(null);
    const res = await wineListService.pick({
      entries: shortlist,
      preferences: {
        budgetMinor,
        serving: preferences.serving,
        meal: preferences.meal,
        useRatings: preferences.useRatings,
        currency,
      },
    });
    setBusy(null);
    if (res.success) {
      setPicks(res.picks);
      setPickNote(res.note || null);
      setUsedRatings(!!res.usedRatings);
      setSavedId(null);
      goTo('picks');
      return;
    }
    if (isPaywallError(res)) {
      presentPaywall('wine_list_pick');
      return;
    }
    setError(res.error || 'Could not get picks right now. Your list is still here, so try again.');
  }, [busy, entries, budgetMinor, preferences, currency, goTo, presentPaywall]);

  const entryById = useCallback((id) => entries.find((e) => e.entry_id === id), [entries]);

  const savePicks = useCallback(async () => {
    if (busy || savedId) return;
    setBusy('save');
    const first = entryById(picks[0]?.entry_id);
    const res = await wineListService.save({
      title: first ? describeEntry(first) : null,
      entries,
      preferences: {
        budgetMinor,
        serving: preferences.serving,
        meal: preferences.meal,
        useRatings: preferences.useRatings,
      },
      picks,
      currency,
    });
    setBusy(null);
    if (res.success) {
      setSavedId(res.session.id);
      setSessions((prev) => [res.session, ...prev]);
    } else {
      Alert.alert('Could not save', res.error || 'Something went wrong. Please try again.');
    }
  }, [busy, savedId, picks, entries, budgetMinor, preferences, currency, entryById]);

  const logWine = useCallback(
    (entry) => {
      if (!entry) return;
      const prefill = JSON.stringify({
        winemaker: entry.producer || '',
        name: entry.wine_name || '',
        year: entry.vintage ? String(entry.vintage) : '',
      });
      router.push({ pathname: '/log-session', params: { mode: 'wine', prefill } });
    },
    [router]
  );

  const askAboutPicks = useCallback(() => {
    const named = picks
      .map((p) => entryById(p.entry_id))
      .filter(Boolean)
      .map((e) => `${describeEntry(e)} (${formatPrice(e.price_minor, e.currency)})`);
    if (!named.length) return;
    const meal = preferences.meal?.trim();
    const ask = `From the wine list I photographed you suggested ${named.join('; ')}. Which one would you order first${meal ? ` with ${meal}` : ''}, and why?`;
    router.push({ pathname: '/(tabs)/sommelier', params: { ask } });
  }, [picks, entryById, preferences.meal, router]);

  const openSession = useCallback((session) => {
    const list = normalizeEntries(session.entries);
    const prefs = session.preferences || {};
    setEntries(list);
    setDrafts(list.map(toDraft));
    setCurrency(session.currency || list[0]?.currency || DEFAULT_CURRENCY);
    setPreferences({
      budgetText: minorToText(prefs.budgetMinor),
      serving: prefs.serving || 'any',
      meal: prefs.meal || '',
      useRatings: prefs.useRatings !== false,
    });
    setPicks(Array.isArray(session.picks) ? session.picks : []);
    setPickNote(null);
    setUsedRatings(prefs.useRatings !== false);
    setSavedId(session.id);
    setReadOnly(true);
    setError(null);
    setStep('picks');
    setMaxStep(STEPS.length - 1);
  }, []);

  const deleteSession = useCallback((session) => {
    Alert.alert('Delete this list?', `"${sessionTitle(session)}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await wineListService.remove(session.id);
          if (res.success) setSessions((prev) => prev.filter((s) => s.id !== session.id));
          else Alert.alert('Could not delete', res.error || 'Please try again.');
        },
      },
    ]);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  const recent = sessions.length ? (
    <View style={styles.recent}>
      <Text style={styles.sectionLabel}>RECENT LISTS</Text>
      {sessions.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={styles.recentRow}
          onPress={() => openSession(s)}
          onLongPress={() => deleteSession(s)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open saved list ${sessionTitle(s)}`}
        >
          <Ionicons name="list-outline" size={18} color={colors.primary.ink} />
          <View style={styles.recentText}>
            <Text style={styles.recentTitle} numberOfLines={1}>{sessionTitle(s)}</Text>
            <Text style={styles.recentMeta}>
              {Array.isArray(s.picks) ? s.picks.length : 0} pick{Array.isArray(s.picks) && s.picks.length === 1 ? '' : 's'}
              {s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => deleteSession(s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete saved list ${sessionTitle(s)}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.neutral.inkTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  if (isLoading) {
    return (
      <View style={styles.safeArea}>
        <ScreenHeader title="Photograph a wine list" onBack={goBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.ink} />
        </View>
      </View>
    );
  }

  // A saved list stays readable without Pro; everything else is the sample.
  if (!isPro && !(readOnly && step === 'picks')) {
    return (
      <View style={styles.safeArea}>
        <ScreenHeader title="Photograph a wine list" onBack={goBack} />
        <ProFeaturePreview
          source="wine_list_pick"
          title="A few good picks from the list in front of you"
          body="Photograph a wine list, set a budget, and the sommelier picks up to three wines you can afford, each with a reason grounded in what you have rated."
        >
          {sessions.length ? <View style={styles.previewRecent}>{recent}</View> : null}
          <Text style={styles.sampleHeading}>Read from the list</Text>
          {SAMPLE_ENTRIES.map((e) => (
            <View key={e.entry_id} style={styles.sampleRow}>
              <View style={styles.sampleRowText}>
                <Text style={styles.sampleWine} numberOfLines={1}>{e.wine_name} {e.vintage}</Text>
                <Text style={styles.sampleProducer} numberOfLines={1}>{e.producer} · {e.serving}</Text>
              </View>
              <Text style={styles.samplePrice}>{formatPrice(e.price_minor, e.currency)}</Text>
            </View>
          ))}
          <Text style={[styles.sampleHeading, styles.sampleHeadingSpaced]}>Your picks, $20 a glass, roast chicken</Text>
          <PickCard pick={SAMPLE_PICK} entry={SAMPLE_ENTRIES[0]} />
        </ProFeaturePreview>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <ScreenHeader title="Photograph a wine list" onBack={goBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <StepIndicator
            current={step}
            maxReached={readOnly ? -1 : maxStep}
            disabled={!!busy}
            onSelect={goTo}
          />

          {step === 'capture' ? (
            <View>
              {recent}
              <Text style={styles.title}>Photograph the list</Text>
              <Text style={styles.body}>
                Include names, prices and the glass and bottle columns. Up to {MAX_PHOTOS} photos; crop a long list to the section you care about.
              </Text>

              {photos.length ? (
                <View style={styles.thumbRow}>
                  {photos.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                      <Image source={{ uri }} style={styles.thumb} accessibilityLabel={`List photo ${i + 1}`} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removePhoto(i)}
                        disabled={!!busy}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${i + 1}`}
                      >
                        <Ionicons name="close" size={14} color={colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.ctaRow}>
                <Button
                  title="Take photo"
                  icon="camera"
                  variant="primary"
                  style={styles.ctaHalf}
                  disabled={photos.length >= MAX_PHOTOS || !!busy}
                  onPress={() => addPhoto('camera')}
                />
                <Button
                  title="Choose from library"
                  icon="image-outline"
                  variant="outline"
                  style={styles.ctaHalf}
                  disabled={photos.length >= MAX_PHOTOS || !!busy}
                  onPress={() => addPhoto('library')}
                />
              </View>

              {busy === 'scan' ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator color={colors.primary.ink} />
                  <Text style={styles.busyText}>Reading your list…</Text>
                </View>
              ) : (
                <Button
                  title="Read the list"
                  icon="scan"
                  variant="primary"
                  style={styles.ctaFull}
                  disabled={!photos.length}
                  onPress={runScan}
                  accessibilityLabel="Read the list"
                />
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {emptyScan ? (
                <View style={styles.ctaRow}>
                  <Button title="Retake" variant="outline" style={styles.ctaHalf} onPress={() => addPhoto('camera')} />
                  <Button title="Type a few options" variant="outline" style={styles.ctaHalf} onPress={typeInstead} />
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 'check' ? (
            <View>
              <Text style={styles.title}>Check the list</Text>
              <Text style={styles.body}>
                Fix anything we misread. A highlighted field is one we were not sure about. A blank price stays unknown and will not be picked against a budget.
              </Text>
              {scanNotes ? <Text style={styles.notes}>{scanNotes}</Text> : null}

              {drafts.map((d, i) => (
                <EntryRow
                  key={d.entry_id}
                  draft={d}
                  currency={currency}
                  onChange={(patch) => updateDraft(i, patch)}
                  onRemove={() => removeDraft(i)}
                />
              ))}

              <Button title="Add a wine" icon="add" variant="ghost" onPress={addDraft} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.ctaRow}>
                <Button title="Back" variant="secondary" style={styles.ctaThird} onPress={() => goTo('capture')} />
                <Button title="Continue" variant="primary" style={styles.ctaGrow} onPress={confirmList} />
              </View>
            </View>
          ) : null}

          {step === 'preferences' ? (
            <View>
              <Text style={styles.title}>What are you after?</Text>

              <Text style={styles.fieldLabel}>Budget per glass or bottle ({currency})</Text>
              <TextInput
                style={styles.input}
                value={preferences.budgetText}
                onChangeText={(t) => {
                  setNoneInBudget(false);
                  setPreferences((p) => ({ ...p, budgetText: t }));
                }}
                keyboardType="decimal-pad"
                placeholder="Leave blank for no limit"
                placeholderTextColor={colors.neutral.placeholder}
                accessibilityLabel="Budget"
              />

              <Text style={styles.fieldLabel}>Serving</Text>
              <View style={styles.chipRow}>
                {SERVING_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    selected={preferences.serving === o.key}
                    onPress={() => {
                      setNoneInBudget(false);
                      setPreferences((p) => ({ ...p, serving: o.key }));
                    }}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>What are you eating? (optional)</Text>
              <TextInput
                style={styles.input}
                value={preferences.meal}
                onChangeText={(t) => setPreferences((p) => ({ ...p, meal: t }))}
                placeholder="Roast chicken, oysters, nothing yet"
                placeholderTextColor={colors.neutral.placeholder}
                accessibilityLabel="What are you eating"
              />

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchTitle}>Use my ratings</Text>
                  <Text style={styles.switchHint}>Lean on the wines you rated in your journal. Off is better when choosing for guests.</Text>
                </View>
                <Switch
                  value={preferences.useRatings}
                  onValueChange={(v) => setPreferences((p) => ({ ...p, useRatings: v }))}
                  trackColor={{ true: colors.primary.base, false: colors.neutral.border }}
                  accessibilityLabel="Use my ratings"
                />
              </View>

              {noneInBudget ? (
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={20} color={colors.accent.ink} />
                  <Text style={styles.emptyText}>
                    No wines within that budget. Change the budget or check a price. We will not quietly go over it.
                  </Text>
                  <Button title="Check the list" variant="ghost" onPress={() => goTo('check')} />
                </View>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {busy === 'pick' ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator color={colors.primary.ink} />
                  <Text style={styles.busyText}>Choosing your picks…</Text>
                </View>
              ) : (
                <View style={styles.ctaRow}>
                  <Button title="Back" variant="secondary" style={styles.ctaThird} onPress={() => goTo('check')} />
                  <Button title="Find my picks" icon="sparkles" variant="primary" style={styles.ctaGrow} onPress={findPicks} />
                </View>
              )}
            </View>
          ) : null}

          {step === 'picks' ? (
            <View>
              <Text style={styles.title}>{readOnly ? 'Your saved picks' : 'Your picks'}</Text>
              <Text style={styles.body}>
                {budgetMinor != null
                  ? `Within ${formatPrice(budgetMinor, currency)}${preferences.serving !== 'any' ? ` per ${preferences.serving}` : ''}.`
                  : 'No budget set.'}
                {!usedRatings ? ' Based on your preferences only, not your ratings.' : ''}
              </Text>

              {picks.length ? (
                picks.map((p) => (
                  <PickCard
                    key={p.entry_id}
                    pick={p}
                    entry={entryById(p.entry_id)}
                    onLog={() => logWine(entryById(p.entry_id))}
                  />
                ))
              ) : (
                <Text style={styles.notes}>The sommelier did not find anything to recommend from that shortlist.</Text>
              )}
              {pickNote ? <Text style={styles.notes}>{pickNote}</Text> : null}

              <View style={styles.ctaRow}>
                <Button
                  title={savedId ? 'Saved' : 'Save'}
                  icon={savedId ? 'checkmark' : 'bookmark-outline'}
                  variant="outline"
                  style={styles.ctaHalf}
                  disabled={!!savedId || !picks.length || busy === 'save'}
                  loading={busy === 'save'}
                  onPress={savePicks}
                />
                <Button
                  title="Ask about these"
                  icon="chatbubble-ellipses-outline"
                  variant="primary"
                  style={styles.ctaHalf}
                  disabled={!picks.length}
                  onPress={askAboutPicks}
                />
              </View>
              {readOnly ? (
                <Button title="Start a new list" variant="ghost" onPress={resetAll} />
              ) : (
                <Button title="Change preferences" variant="ghost" onPress={() => goTo('preferences')} />
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

function StepIndicator({ current, maxReached, disabled, onSelect }) {
  const { styles } = useScreenTheme();
  const currentIndex = stepIndex(current);
  return (
    <View style={styles.steps} accessibilityRole="tablist">
      {STEPS.map((s, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        const canTap = !disabled && i <= maxReached && !active;
        return (
          <TouchableOpacity
            key={s.key}
            style={styles.step}
            disabled={!canTap}
            onPress={() => onSelect(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Step ${i + 1}, ${s.label}`}
          >
            <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
              <Text style={[styles.stepNum, (active || done) && styles.stepNumActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EntryRow({ draft, currency, onChange, onRemove }) {
  const { colors, styles } = useScreenTheme();
  const unsure = (field) => draft.uncertain_fields?.includes(field);
  return (
    <View style={styles.row}>
      <View style={styles.rowLine}>
        <TextInput
          style={[styles.input, styles.inputGrow, unsure('wine_name') && styles.inputUnsure]}
          value={draft.wine_name}
          onChangeText={(t) => onChange({ wine_name: t })}
          placeholder="Wine"
          placeholderTextColor={colors.neutral.placeholder}
          accessibilityLabel="Wine name"
        />
        <TouchableOpacity
          onPress={onRemove}
          style={styles.rowRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${draft.wine_name || 'this wine'}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.neutral.inkTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.rowLine}>
        <TextInput
          style={[styles.input, styles.inputGrow, unsure('producer') && styles.inputUnsure]}
          value={draft.producer}
          onChangeText={(t) => onChange({ producer: t })}
          placeholder="Producer"
          placeholderTextColor={colors.neutral.placeholder}
          accessibilityLabel="Producer"
        />
        <TextInput
          style={[styles.input, styles.inputYear, unsure('vintage') && styles.inputUnsure]}
          value={draft.vintageText}
          onChangeText={(t) => onChange({ vintageText: t })}
          placeholder="Year"
          placeholderTextColor={colors.neutral.placeholder}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Vintage"
        />
      </View>
      <View style={styles.rowLine}>
        <View style={[styles.chipRow, styles.chipRowGrow]}>
          {ROW_SERVINGS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={draft.serving === o.key}
              onPress={() => onChange({ serving: draft.serving === o.key ? null : o.key })}
            />
          ))}
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.priceCurrency}>{formatPrice(100, currency).replace(/[0-9.]+/, '').trim()}</Text>
          <TextInput
            style={[styles.input, styles.inputPrice, unsure('price_minor') && styles.inputUnsure]}
            value={draft.priceText}
            onChangeText={(t) => onChange({ priceText: t })}
            placeholder="Price"
            placeholderTextColor={colors.neutral.placeholder}
            keyboardType="decimal-pad"
            accessibilityLabel={`Price for ${draft.wine_name || 'this wine'}`}
          />
        </View>
      </View>
      {draft.uncertain_fields?.length ? (
        <Text style={styles.unsureHint}>Please check: {draft.uncertain_fields.map((f) => f.replace('_minor', '').replace('_', ' ')).join(', ')}</Text>
      ) : null}
    </View>
  );
}

function PickCard({ pick, entry, onLog }) {
  const { colors, styles } = useScreenTheme();
  const label = pick.label ? PICK_LABELS[pick.label] : null;
  return (
    <View style={styles.pick}>
      {label ? <Text style={styles.pickLabel}>{label.toUpperCase()}</Text> : null}
      <View style={styles.pickHead}>
        <Text style={styles.pickName}>{describeEntry(entry)}</Text>
        <Text style={styles.pickPrice}>
          {formatPrice(entry?.price_minor, entry?.currency)}
          {entry?.serving ? ` / ${entry.serving}` : ''}
        </Text>
      </View>
      <Text style={styles.pickReason}>{pick.reason}</Text>
      {pick.evidence?.length
        ? pick.evidence.map((line, i) => (
            <View key={i} style={styles.evidenceLine}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.accent.ink} />
              <Text style={styles.evidenceText}>{line}</Text>
            </View>
          ))
        : null}
      {onLog ? (
        <Button
          title="Log this wine"
          icon="create-outline"
          variant="ghost"
          style={styles.pickLog}
          onPress={onLog}
          accessibilityLabel={`Log ${describeEntry(entry)}`}
        />
      ) : null}
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.neutral.bg },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

    title: { ...typography.heading.h2, color: colors.neutral.ink, marginBottom: spacing.xs },
    body: { ...typography.body.regular, color: colors.neutral.inkSecondary, marginBottom: spacing.md },
    notes: { ...typography.body.small, color: colors.neutral.inkTertiary, marginBottom: spacing.md },
    sectionLabel: { ...typography.body.caption, color: colors.accent.ink, letterSpacing: 0.8, marginBottom: spacing.xs },
    fieldLabel: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
    error: { ...typography.body.small, color: colors.status.error, marginTop: spacing.sm },

    steps: { flexDirection: 'row', marginBottom: spacing.lg },
    step: { flex: 1, alignItems: 'center' },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      backgroundColor: colors.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    stepDotActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
    stepDotDone: { backgroundColor: colors.primary.soft, borderColor: colors.primary.soft },
    stepNum: { fontSize: 12, fontWeight: '700', color: colors.neutral.inkTertiary },
    stepNumActive: { color: colors.onPrimary },
    stepLabel: { fontSize: 11, color: colors.neutral.inkTertiary },
    stepLabelActive: { color: colors.primary.ink, fontWeight: '700' },

    recent: { marginBottom: spacing.lg },
    previewRecent: { marginBottom: spacing.md },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral.divider,
    },
    recentText: { flex: 1 },
    recentTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    recentMeta: { ...typography.body.caption, color: colors.neutral.inkTertiary, textTransform: 'none' },

    thumbRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    thumbWrap: { width: 84, height: 84, borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.neutral.border },
    thumb: { width: '100%', height: '100%' },
    thumbRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.overlay.dark,
      alignItems: 'center',
      justifyContent: 'center',
    },

    ctaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    ctaHalf: { flex: 1 },
    ctaThird: { flex: 1 },
    ctaGrow: { flex: 2 },
    ctaFull: { marginTop: spacing.md },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' },
    busyText: { ...typography.body.regular, color: colors.neutral.inkSecondary },

    input: {
      ...typography.body.regular,
      color: colors.neutral.ink,
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      minHeight: 40,
    },
    inputGrow: { flex: 1 },
    inputYear: { width: 76 },
    inputPrice: { width: 84 },
    inputUnsure: { borderColor: colors.accent.strong, backgroundColor: colors.accent.surface },
    row: {
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    rowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowRemove: { padding: spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chipRowGrow: { flex: 1 },
    priceWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    priceCurrency: { ...typography.body.small, color: colors.neutral.inkTertiary },
    unsureHint: { ...typography.body.caption, color: colors.accent.ink, textTransform: 'none' },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    switchText: { flex: 1 },
    switchTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    switchHint: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accent.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },
    emptyText: { ...typography.body.regular, color: colors.neutral.ink, textAlign: 'center' },

    pick: {
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    pickLabel: { ...typography.body.caption, color: colors.accent.ink, letterSpacing: 0.8, marginBottom: spacing.xs },
    pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
    pickName: { ...typography.heading.h3, color: colors.neutral.ink, flex: 1 },
    pickPrice: { ...typography.body.regular, color: colors.primary.ink, fontWeight: '700' },
    pickReason: { ...typography.body.regular, color: colors.neutral.inkSecondary, marginTop: spacing.xs },
    evidenceLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.xs },
    evidenceText: { ...typography.body.small, color: colors.neutral.inkSecondary, flex: 1 },
    pickLog: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.xs },

    sampleHeading: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginBottom: spacing.xs },
    sampleHeadingSpaced: { marginTop: spacing.md },
    sampleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.neutral.divider },
    sampleRowText: { flex: 1 },
    sampleWine: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    sampleProducer: { ...typography.body.small, color: colors.neutral.inkTertiary },
    samplePrice: { ...typography.body.regular, color: colors.primary.ink, fontWeight: '700' },
  });
  return { colors, styles };
});
