// components/CellarBottleForm.js - Add/Edit form for a cellar lot (Epic #6)
// Controlled form shared by app/cellar/add.js and the edit mode of app/cellar/[id].js.
//
// #53 "faster bottle entry": the top of the form is now just the few fields that matter
// (wine name + producer + vintage + quantity) with autocomplete that REUSES the wineries
// & wines already in the app — picking an existing one prefills type/varietal and links
// winery_id to dedupe. Everything else is tucked behind a "More details" expander, and the
// form ships with smart defaults (qty 1, 750ml, purchase date = today).
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { drinkWindowAI, hasEnoughForWindow } from '../lib/drinkWindow';
import theme from '../styles/theme';
import AutocompleteInput from './AutocompleteInput';

const { colors, typography, spacing, borderRadius } = theme;

const BOTTLE_SIZES = ['375ml', '750ml', '1.5L', '3L'];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Map a raw form state object to the column shape the cellar service expects.
export function toBottlePayload(form) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    winery_id: form.winery_id ?? null,
    wine_name: form.wine_name?.trim() || '',
    producer: form.producer?.trim() || null,
    vintage: form.vintage?.trim() || null,
    wine_type: form.wine_type?.trim() || null,
    varietal: form.varietal?.trim() || null,
    region: form.region?.trim() || null,
    quantity: Math.max(0, parseInt(form.quantity, 10) || 0),
    bottle_size: form.bottle_size || '750ml',
    location: form.location?.trim() || null,
    store: form.store?.trim() || null,
    purchase_date: form.purchase_date?.trim() || null,
    purchase_price: num(form.purchase_price),
    drink_from: form.drink_from ? parseInt(form.drink_from, 10) || null : null,
    drink_by: form.drink_by ? parseInt(form.drink_by, 10) || null : null,
    rating: num(form.rating),
    notes: form.notes?.trim() || null,
  };
}

function initialState(initial = {}, { defaultPurchaseToday = false } = {}) {
  const s = (v) => (v == null ? '' : String(v));
  // Smart default: prefill purchase date = today, but ONLY on the add screen (where the
  // caller opts in). Edit mode keeps an empty field empty so we never invent a date.
  const purchaseDate =
    initial.purchase_date != null
      ? s(initial.purchase_date)
      : defaultPurchaseToday
      ? todayISO()
      : '';
  return {
    winery_id: initial.winery_id ?? null,
    wine_name: s(initial.wine_name),
    producer: s(initial.producer),
    vintage: s(initial.vintage),
    wine_type: s(initial.wine_type),
    varietal: s(initial.varietal),
    region: s(initial.region),
    quantity: initial.quantity != null ? String(initial.quantity) : '1',
    bottle_size: initial.bottle_size || '750ml',
    location: s(initial.location),
    store: s(initial.store),
    purchase_date: purchaseDate,
    purchase_price: s(initial.purchase_price),
    drink_from: s(initial.drink_from),
    drink_by: s(initial.drink_by),
    rating: s(initial.rating),
    notes: s(initial.notes),
  };
}

// Whether any of the "More details" fields already hold a value — if so we open the
// section by default (e.g. when editing an existing bottle, or "add another like the last").
function hasDetails(state) {
  return Boolean(
    state.wine_type || state.varietal || state.region || state.location ||
    state.store || state.purchase_price || state.drink_from || state.drink_by ||
    state.rating || state.notes
  );
}

export default function CellarBottleForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  saving,
  // #53 autocomplete data (optional; only the add screen supplies these).
  producerOptions = [],
  wineOptions = [],
  // #53 smart default: prefill purchase date with today (add screen opts in).
  defaultPurchaseToday = false,
}) {
  const [form, setForm] = useState(() =>
    initialState(initialValues, { defaultPurchaseToday })
  );
  const [error, setError] = useState(null);
  const [showMore, setShowMore] = useState(() =>
    hasDetails(initialState(initialValues, { defaultPurchaseToday }))
  );
  // Track which fields came from a picked suggestion (drives the "Linked" hint).
  const [wineLinked, setWineLinked] = useState(false);
  const [producerLinked, setProducerLinked] = useState(Boolean(initialValues?.winery_id));

  // AI drink-window suggestion (R4 / #54). Fails soft: any error just clears the
  // loading state and the fields stay manually editable — never blocks the save.
  const [windowSuggesting, setWindowSuggesting] = useState(false);
  const [windowProposal, setWindowProposal] = useState(null); // { drink_from, drink_by, peak, rationale }
  const [windowError, setWindowError] = useState(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Ask the sommelier to propose a window from the current form fields.
  const suggestWindow = async () => {
    setWindowSuggesting(true);
    setWindowError(null);
    setWindowProposal(null);
    const res = await drinkWindowAI.suggest({
      wine_name: form.wine_name,
      producer: form.producer,
      vintage: form.vintage,
      wine_type: form.wine_type,
      varietal: form.varietal,
      region: form.region,
    });
    setWindowSuggesting(false);
    if (res.success) {
      setWindowProposal(res.window);
    } else {
      setWindowError('Could not suggest a window — enter it manually.');
    }
  };

  // Accept the proposal: fill the drink-from / drink-by fields.
  const acceptWindow = () => {
    if (!windowProposal) return;
    setForm((f) => ({
      ...f,
      drink_from: windowProposal.drink_from != null ? String(windowProposal.drink_from) : f.drink_from,
      drink_by: windowProposal.drink_by != null ? String(windowProposal.drink_by) : f.drink_by,
    }));
    setWindowProposal(null);
  };

  const qty = parseInt(form.quantity, 10) || 0;
  const step = (delta) => set('quantity')(String(Math.max(0, qty + delta)));

  // Free-typing a producer/wine breaks any prior linkage (it's a new/edited record now).
  const onProducerText = (value) => {
    setProducerLinked(false);
    setForm((f) => ({ ...f, producer: value, winery_id: null }));
  };
  const onWineText = (value) => {
    setWineLinked(false);
    setForm((f) => ({ ...f, wine_name: value }));
  };

  // Pick an existing producer → link winery_id (dedupe).
  const onPickProducer = (producer) => {
    setProducerLinked(true);
    setForm((f) => ({ ...f, producer: producer.name, winery_id: producer.id ?? null }));
  };

  // Pick an existing wine → prefill what we know, and link the producer/winery_id.
  const onPickWine = (wine) => {
    setWineLinked(true);
    setProducerLinked(Boolean(wine.winery_id));
    setForm((f) => ({
      ...f,
      wine_name: wine.name,
      producer: wine.producer || f.producer,
      winery_id: wine.winery_id ?? f.winery_id ?? null,
      wine_type: wine.wine_type || f.wine_type,
      varietal: wine.varietal || f.varietal,
    }));
    // Surface the prefilled details so the user can see what was filled in.
    if (wine.wine_type || wine.varietal) setShowMore(true);
  };

  const handleSubmit = () => {
    if (!form.wine_name.trim()) {
      setError('A wine name is required.');
      return;
    }
    setError(null);
    onSubmit(toBottlePayload(form));
  };

  return (
    <View>
      {/* ---- Essentials: name + producer + vintage + quantity ---- */}
      <AutocompleteInput
        label="Wine name"
        required
        value={form.wine_name}
        onChangeText={onWineText}
        onSelect={onPickWine}
        items={wineOptions}
        getLabel={(w) => w.name}
        getSubtitle={(w) => [w.producer, w.varietal].filter(Boolean).join(' · ') || undefined}
        placeholder="e.g. Barrel Oak Cabernet"
        linked={wineLinked}
      />

      <AutocompleteInput
        label="Producer / winery"
        value={form.producer}
        onChangeText={onProducerText}
        onSelect={onPickProducer}
        items={producerOptions}
        getLabel={(p) => p.name}
        placeholder="Who made it"
        linked={producerLinked}
      />

      <Row>
        <Field flex label="Vintage" value={form.vintage} onChangeText={set('vintage')} placeholder="2019" keyboardType="number-pad" />
        <View style={styles.flex}>
          <Text style={styles.label}>Quantity</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => step(-1)}>
              <Ionicons name="remove" size={20} color={colors.primary.burgundy} />
            </TouchableOpacity>
            <TextInput
              style={styles.stepValue}
              value={form.quantity}
              onChangeText={set('quantity')}
              keyboardType="number-pad"
              textAlign="center"
            />
            <TouchableOpacity style={styles.stepBtn} onPress={() => step(1)}>
              <Ionicons name="add" size={20} color={colors.primary.burgundy} />
            </TouchableOpacity>
          </View>
        </View>
      </Row>

      {/* ---- Progressive disclosure: everything else ---- */}
      <TouchableOpacity
        style={styles.moreToggle}
        onPress={() => setShowMore((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.moreToggleText}>More details</Text>
        <Ionicons
          name={showMore ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.primary.burgundy}
        />
      </TouchableOpacity>

      {showMore && (
        <View style={styles.moreSection}>
          <View style={styles.field}>
            <Text style={styles.label}>Bottle size</Text>
            <View style={styles.sizeRow}>
              {BOTTLE_SIZES.map((sz) => (
                <TouchableOpacity
                  key={sz}
                  style={[styles.sizeChip, form.bottle_size === sz && styles.sizeChipActive]}
                  onPress={() => set('bottle_size')(sz)}
                >
                  <Text style={[styles.sizeChipText, form.bottle_size === sz && styles.sizeChipTextActive]}>{sz}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Row>
            <Field flex label="Type" value={form.wine_type} onChangeText={set('wine_type')} placeholder="Red, White…" />
            <Field flex label="Varietal" value={form.varietal} onChangeText={set('varietal')} placeholder="Cabernet…" />
          </Row>
          <Field label="Region" value={form.region} onChangeText={set('region')} placeholder="Napa Valley…" />

          <Field label="Location / bin" value={form.location} onChangeText={set('location')} placeholder="Rack A, shelf 2…" />

          <Row>
            <Field flex label="Drink from" value={form.drink_from} onChangeText={set('drink_from')} placeholder="2024" keyboardType="number-pad" />
            <Field flex label="Drink by" value={form.drink_by} onChangeText={set('drink_by')} placeholder="2030" keyboardType="number-pad" />
          </Row>

          {/* AI-seeded drink window (R4 / #54): propose a window from grape /
              region / vintage; the user accepts (fills the fields) or edits. */}
          <TouchableOpacity
            style={[styles.suggestBtn, windowSuggesting && styles.submitDisabled]}
            onPress={suggestWindow}
            disabled={windowSuggesting || !hasEnoughForWindow(form)}
            activeOpacity={0.85}
          >
            {windowSuggesting ? (
              <ActivityIndicator size="small" color={colors.primary.burgundy} />
            ) : (
              <Ionicons name="sparkles" size={16} color={colors.primary.burgundy} />
            )}
            <Text style={styles.suggestBtnText}>
              {windowSuggesting ? 'Asking the sommelier…' : 'Suggest a window'}
            </Text>
          </TouchableOpacity>
          {!hasEnoughForWindow(form) && !windowSuggesting ? (
            <Text style={styles.suggestHint}>
              Add a grape, region, type, or vintage and the sommelier can propose a window.
            </Text>
          ) : null}
          {windowError ? <Text style={styles.suggestError}>{windowError}</Text> : null}

          {windowProposal ? (
            <View style={styles.proposalCard}>
              <Text style={styles.proposalRange}>
                Drink {windowProposal.drink_from}–{windowProposal.drink_by}
                {windowProposal.peak != null ? ` · peak ~${windowProposal.peak}` : ''}
              </Text>
              {windowProposal.rationale ? (
                <Text style={styles.proposalWhy}>{windowProposal.rationale}</Text>
              ) : null}
              <View style={styles.proposalActions}>
                <TouchableOpacity style={styles.proposalAccept} onPress={acceptWindow} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={16} color={colors.neutral.cream} />
                  <Text style={styles.proposalAcceptText}>Use it</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.proposalDismiss} onPress={() => setWindowProposal(null)} activeOpacity={0.85}>
                  <Text style={styles.proposalDismissText}>I&apos;ll edit manually</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.proposalNote}>An estimate from the grape, region & vintage — adjust as you like.</Text>
            </View>
          ) : null}

          <Row>
            <Field flex label="Purchase date" value={form.purchase_date} onChangeText={set('purchase_date')} placeholder="YYYY-MM-DD" />
            <Field flex label="Price" value={form.purchase_price} onChangeText={set('purchase_price')} placeholder="45.00" keyboardType="decimal-pad" />
          </Row>
          <Field label="Store / source" value={form.store} onChangeText={set('store')} placeholder="Where you bought it" />
          <Field label="Your rating (0–5)" value={form.rating} onChangeText={set('rating')} placeholder="4.5" keyboardType="decimal-pad" />
          <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Anything to remember" multiline />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submit, saving && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={saving}
        activeOpacity={0.9}
      >
        <Text style={styles.submitText}>{saving ? 'Saving…' : submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

function Field({ label, required, flex, multiline, style, ...props }) {
  return (
    <View style={[styles.field, flex && styles.flex, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={colors.neutral.silver}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md },
  label: { ...typography.body.caption, color: colors.neutral.pewter, marginBottom: spacing.xs },
  req: { color: colors.primary.wine },
  input: {
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },

  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
  },
  moreToggleText: {
    ...typography.body.regular,
    color: colors.primary.burgundy,
    fontWeight: '600',
  },
  moreSection: { marginBottom: spacing.sm },

  sizeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sizeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.cream,
  },
  sizeChipActive: { backgroundColor: colors.primary.burgundy, borderColor: colors.primary.burgundy },
  sizeChipText: { ...typography.body.small, color: colors.neutral.graphite },
  sizeChipTextActive: { color: colors.neutral.cream },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.cream,
  },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepValue: {
    width: 64,
    fontSize: 18,
    fontFamily: 'Georgia',
    color: colors.neutral.charcoal,
  },

  error: { ...typography.body.small, color: colors.status.error, marginBottom: spacing.md },

  // AI "Suggest a window"
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.gold.light,
    marginBottom: spacing.sm,
  },
  suggestBtnText: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600' },
  suggestHint: { ...typography.body.small, color: colors.neutral.pewter, marginBottom: spacing.md, marginTop: -spacing.xs },
  suggestError: { ...typography.body.small, color: colors.status.error, marginBottom: spacing.md },

  proposalCard: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  proposalRange: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  proposalWhy: { ...typography.body.small, color: colors.neutral.graphite, marginTop: spacing.xs, lineHeight: 18 },
  proposalActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  proposalAccept: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  proposalAcceptText: { ...typography.body.small, color: colors.neutral.cream, fontWeight: '600' },
  proposalDismiss: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  proposalDismissText: { ...typography.body.small, color: colors.primary.burgundy },
  proposalNote: { ...typography.body.small, color: colors.neutral.pewter, fontStyle: 'italic', marginTop: spacing.sm },

  submit: {
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.body.large, color: colors.neutral.cream, fontWeight: '600' },
});
