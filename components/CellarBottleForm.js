// components/CellarBottleForm.js - Add/Edit form for a cellar lot (Epic #6)
// Controlled form shared by app/cellar/add.js and the edit mode of app/cellar/[id].js.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const BOTTLE_SIZES = ['375ml', '750ml', '1.5L', '3L'];

// Map a raw form state object to the column shape the cellar service expects.
export function toBottlePayload(form) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
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

function initialState(initial = {}) {
  const s = (v) => (v == null ? '' : String(v));
  return {
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
    purchase_date: s(initial.purchase_date),
    purchase_price: s(initial.purchase_price),
    drink_from: s(initial.drink_from),
    drink_by: s(initial.drink_by),
    rating: s(initial.rating),
    notes: s(initial.notes),
  };
}

export default function CellarBottleForm({ initialValues, onSubmit, submitLabel = 'Save', saving }) {
  const [form, setForm] = useState(() => initialState(initialValues));
  const [error, setError] = useState(null);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const qty = parseInt(form.quantity, 10) || 0;
  const step = (delta) => set('quantity')(String(Math.max(0, qty + delta)));

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
      <Field label="Wine name" required value={form.wine_name} onChangeText={set('wine_name')} placeholder="e.g. Barrel Oak Cabernet" />
      <Field label="Producer / winery" value={form.producer} onChangeText={set('producer')} placeholder="Who made it" />

      <Row>
        <Field flex label="Vintage" value={form.vintage} onChangeText={set('vintage')} placeholder="2019" keyboardType="number-pad" />
        <View style={styles.flex}>
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
      </Row>

      <Row>
        <Field flex label="Type" value={form.wine_type} onChangeText={set('wine_type')} placeholder="Red, White…" />
        <Field flex label="Varietal" value={form.varietal} onChangeText={set('varietal')} placeholder="Cabernet…" />
      </Row>
      <Field label="Region" value={form.region} onChangeText={set('region')} placeholder="Napa Valley…" />

      {/* Quantity stepper */}
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

      <Field label="Location / bin" value={form.location} onChangeText={set('location')} placeholder="Rack A, shelf 2…" />

      <Row>
        <Field flex label="Drink from" value={form.drink_from} onChangeText={set('drink_from')} placeholder="2024" keyboardType="number-pad" />
        <Field flex label="Drink by" value={form.drink_by} onChangeText={set('drink_by')} placeholder="2030" keyboardType="number-pad" />
      </Row>

      <Row>
        <Field flex label="Purchase date" value={form.purchase_date} onChangeText={set('purchase_date')} placeholder="YYYY-MM-DD" />
        <Field flex label="Price" value={form.purchase_price} onChangeText={set('purchase_price')} placeholder="45.00" keyboardType="decimal-pad" />
      </Row>
      <Field label="Store / source" value={form.store} onChangeText={set('store')} placeholder="Where you bought it" />
      <Field label="Your rating (0–5)" value={form.rating} onChangeText={set('rating')} placeholder="4.5" keyboardType="decimal-pad" />
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Anything to remember" multiline />

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
    marginBottom: spacing.md,
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
