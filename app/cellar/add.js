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
import { cellarService } from '../../lib/cellar';
import { getEntrySuggestions } from '../../lib/cellarEntry';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function AddBottleScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Autocomplete data — loaded once; failures degrade gracefully to free-text entry.
  const [producerOptions, setProducerOptions] = useState([]);
  const [wineOptions, setWineOptions] = useState([]);

  // Prefill + remount control for "add another like the last one".
  const [prefill, setPrefill] = useState(null);
  const [formKey, setFormKey] = useState(0);
  // A short confirmation after the previous save, so a quick second add feels acknowledged.
  const [justAdded, setJustAdded] = useState(null);

  useEffect(() => {
    let active = true;
    getEntrySuggestions().then(({ producers, wines }) => {
      if (!active) return;
      setProducerOptions(producers);
      setWineOptions(wines);
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
    store: payload.store,
    purchase_date: payload.purchase_date,
    purchase_price: payload.purchase_price,
    drink_from: payload.drink_from,
    drink_by: payload.drink_by,
    quantity: 1,
  });

  const handleSubmit = async (payload) => {
    setSaving(true);
    const res = await cellarService.addBottle(payload);
    setSaving(false);

    if (!res.success) {
      Alert.alert('Could not save', res.error || 'Something went wrong. Please try again.');
      return;
    }

    // Offer "add another like the last one" for case / repeat purchases.
    Alert.alert(
      'Added to cellar',
      `${payload.wine_name} saved. Add another like it?`,
      [
        { text: 'Done', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Add another',
          onPress: () => {
            setPrefill(nextLikeLast(payload));
            setJustAdded(payload.wine_name);
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

          <CellarBottleForm
            key={formKey}
            initialValues={prefill || undefined}
            defaultPurchaseToday={!prefill}
            producerOptions={producerOptions}
            wineOptions={wineOptions}
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
