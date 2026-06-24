// app/cellar/add.js - Add a bottle to the cellar (Epic #6 / #25)
//
// #53 "faster bottle entry": loads the user's known producers/wines once so the form's
// autocomplete can reuse them (prefill + winery_id linkage to dedupe), and after a save
// offers "Add another like the last one" — handy for case purchases — by remounting the
// form pre-filled with the entry just saved (quantity reset to 1).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CellarBottleForm from '../../components/CellarBottleForm';
import LabelScanner from '../../components/LabelScanner';
import { cellarService } from '../../lib/cellar';
import { getEntrySuggestions } from '../../lib/cellarEntry';
import { knownLocations } from '../../lib/cellarLocation';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function AddBottleScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Autocomplete data — loaded once; failures degrade gracefully to free-text entry.
  const [producerOptions, setProducerOptions] = useState([]);
  const [wineOptions, setWineOptions] = useState([]);
  // #62: distinct storage locations the user has already typed, as { name } items.
  const [locationOptions, setLocationOptions] = useState([]);

  // Prefill + remount control for "add another like the last one".
  const [prefill, setPrefill] = useState(null);
  const [formKey, setFormKey] = useState(0);
  // Whether the next form mount should default the purchase date to today. True
  // for a fresh form and for a label scan (which carries no purchase_date), but
  // false after "add another like the last" (which carries the prior date).
  const [purchaseToday, setPurchaseToday] = useState(true);
  // A short confirmation after the previous save, so a quick second add feels acknowledged.
  const [justAdded, setJustAdded] = useState(null);

  useEffect(() => {
    let active = true;
    getEntrySuggestions().then(({ producers, wines }) => {
      if (!active) return;
      setProducerOptions(producers);
      setWineOptions(wines);
    });
    // Distinct storage locations come from the user's own cellar (degrades to free text).
    cellarService
      .getCellar()
      .catch(() => ({ success: false }))
      .then((res) => {
        if (!active) return;
        const locs = knownLocations(res?.success ? res.bottles : []);
        setLocationOptions(locs.map((name) => ({ name })));
      });
    return () => {
      active = false;
    };
  }, []);

  // Turn a saved payload into prefill for the next bottle: keep identity/details, reset
  // the per-bottle bits (quantity back to 1; drop the rating/notes for the new bottle).
  const nextLikeLast = (payload) => ({
    winery_id: payload.winery_id ?? null,
    wine_name: payload.wine_name,
    producer: payload.producer,
    vintage: payload.vintage,
    wine_type: payload.wine_type,
    varietal: payload.varietal,
    region: payload.region,
    bottle_size: payload.bottle_size,
    location: payload.location,
    bin: payload.bin,
    store: payload.store,
    purchase_date: payload.purchase_date,
    purchase_price: payload.purchase_price,
    drink_from: payload.drink_from,
    drink_by: payload.drink_by,
    quantity: 1,
  });

  // #59 label-scan → prefill: the LabelScanner card above the form reads a wine
  // label with the AI and hands back a whitelisted, normalized set of fields
  // (wine_name / producer / vintage / wine_type / varietal / region — any may be
  // null). We merge those onto the current prefill (so a scan composes with an
  // "add another like the last" base) and bump formKey to remount the form with
  // them as initialValues — the SAME remount path "add another" uses. The form
  // is fully editable, so the user just confirms / tap-corrects any miss and
  // saves; we never dump scanned values anywhere the user can't review them.
  const handleScanned = (fields) => {
    if (!fields) return;
    setPrefill((prev) => {
      const base = prev || {};
      const merged = { ...base };
      // Only overwrite with non-null scanned values so a scan never blanks out
      // something the user already had from a prior "add another like it".
      for (const key of ['wine_name', 'producer', 'vintage', 'wine_type', 'varietal', 'region']) {
        if (fields[key] != null) merged[key] = fields[key];
      }
      return merged;
    });
    setJustAdded(null);
    setPurchaseToday(true); // a scan carries no purchase date — keep today's default
    setFormKey((k) => k + 1); // remount the form with the scanned prefill applied
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    const res = await cellarService.addBottle(payload);
    setSaving(false);

    if (!res.success) {
      Alert.alert('Could not save', res.error || 'Something went wrong. Please try again.');
      return;
    }

    // If we auto-linked the new bottle to an existing tasting (#140), say so.
    const linkedNote = res.linkedWine ? ' Linked to a matching tasting in your journal.' : '';

    // Offer "add another like the last one" for case / repeat purchases.
    Alert.alert(
      'Added to cellar',
      `${payload.wine_name} saved.${linkedNote} Add another like it?`,
      [
        { text: 'Done', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Add another',
          onPress: () => {
            setPrefill(nextLikeLast(payload));
            setJustAdded(payload.wine_name);
            setPurchaseToday(false); // carries the prior purchase date, don't override
            setFormKey((k) => k + 1); // remount the form with the new prefill
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary.burgundy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add a bottle</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.headerBorder} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {justAdded ? (
            <View style={styles.addedBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.status.visited} />
              <Text style={styles.addedText}>
                Added “{justAdded}”. Starting another like it — adjust and save.
              </Text>
            </View>
          ) : null}

          {/* #59: scan a wine label to prefill the form below. The form is
              always present, so this card is a pure accelerator — a failed or
              skipped scan just leaves manual entry untouched. */}
          <LabelScanner onScanned={handleScanned} />

          <CellarBottleForm
            key={formKey}
            initialValues={prefill || undefined}
            defaultPurchaseToday={purchaseToday}
            producerOptions={producerOptions}
            wineOptions={wineOptions}
            locationOptions={locationOptions}
            onSubmit={handleSubmit}
            submitLabel="Add to cellar"
            saving={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  flex: { flex: 1 },
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  addedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.parchment,
  },
  addedText: {
    ...typography.body.small,
    color: colors.neutral.graphite,
    flex: 1,
  },
});
