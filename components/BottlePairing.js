// components/BottlePairing.js — per-bottle food pairing card (Epic #6 · R10 · #61).
//
// A first-class element on the bottle detail page: a "What should I serve with
// this?" CTA that points the AI sommelier at THIS bottle (the reverse of
// "tonight's pick") and renders specific, bottle-aware dish suggestions with
// reasoning. Per the research, pairing should live where the decision is made —
// so it sits on the bottle's own page, not in a separate utility.
//
// Self-contained: takes a single `bottle` and talks to the AI via
// lib/cellarPairing.js. Fails soft — on error it shows a gentle retry and never
// crashes the detail screen.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePro } from '../hooks/usePro';
import { OCCASIONS, SEASONS, cellarPairing } from '../lib/cellarPairing';
import theme from '../styles/theme';
import Button from './Button';

const { colors, typography, spacing, borderRadius } = theme;

// Map a pairing category onto an icon so the list scans quickly.
const CATEGORY_ICON = {
  main: 'restaurant-outline',
  starter: 'leaf-outline',
  cheese: 'nutrition-outline',
  vegetarian: 'flower-outline',
  dessert: 'ice-cream-outline',
  occasion: 'sparkles-outline',
};

// A horizontal row of single-select pill choices (tap again to clear).
function PickerRow({ label, options, value, onChange }) {
  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillScroll}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onChange(active ? null : opt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function BottlePairing({ bottle }) {
  const { gate } = usePro();
  const [occasion, setOccasion] = useState(null);
  const [season, setSeason] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [showTune, setShowTune] = useState(false);

  const [thinking, setThinking] = useState(false);
  const [pairing, setPairing] = useState(null);
  const [aside, setAside] = useState(''); // the model's friendly lead-in
  const [error, setError] = useState(null);

  const askSommelier = useCallback(async () => {
    if (!bottle) return;
    // These are sommelier calls too: they spend the same 5/month chat meter
    // server-side, so they get the same gate rather than a confusing refusal.
    if (!gate('chat')) return;
    setThinking(true);
    setError(null);
    try {
      const res = await cellarPairing.getPairings(bottle, {
        occasion,
        season,
        freeText,
      });
      if (res.success) {
        setPairing(res.pairing);
        setAside(res.raw || '');
      } else {
        setPairing(null);
        setError(res.error || "The sommelier couldn't decide. Please try again.");
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setThinking(false);
    }
  }, [bottle, occasion, season, freeText, gate]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="restaurant" size={18} color={colors.accent.base} />
        <Text style={styles.eyebrow}>FOOD PAIRING</Text>
        <View style={styles.flexSpacer} />
        <TouchableOpacity
          onPress={() => setShowTune((s) => !s)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.tuneLink}>{showTune ? 'Hide' : 'Tune'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>What should I serve with this?</Text>
      <Text style={styles.subtitle}>
        Specific dishes for this bottle, with the reasoning.
      </Text>

      {/* Optional tap-first refinements (collapsible) */}
      {showTune && (
        <View style={styles.tune}>
          <PickerRow
            label="Occasion"
            options={OCCASIONS}
            value={occasion}
            onChange={setOccasion}
          />
          <PickerRow
            label="Season"
            options={SEASONS}
            value={season}
            onChange={setSeason}
          />
          <TextInput
            style={styles.freeText}
            placeholder="Optional: e.g. cooking for vegetarians"
            placeholderTextColor={colors.neutral.placeholder}
            value={freeText}
            onChangeText={setFreeText}
            returnKeyType="done"
            onSubmitEditing={askSommelier}
          />
        </View>
      )}

      {/* Primary CTA */}
      <Button
        variant="primary"
        title={pairing ? 'Suggest again' : 'Suggest pairings'}
        icon="restaurant-outline"
        loading={thinking}
        onPress={askSommelier}
        style={{ marginTop: spacing.md }}
      />

      {/* Error (fail soft — gentle retry, never crash) */}
      {error && !thinking && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={askSommelier} hitSlop={8}>
            <Text style={styles.retryLink}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result */}
      {pairing && !thinking && (
        <View style={styles.result}>
          <View style={styles.resultDivider} />

          {aside ? <Text style={styles.aside}>{aside}</Text> : null}
          {pairing.intro ? <Text style={styles.intro}>{pairing.intro}</Text> : null}

          {pairing.pairings.map((p, i) => (
            <View key={`${p.dish}-${i}`} style={styles.pairRow}>
              <Ionicons
                name={CATEGORY_ICON[p.category] || 'restaurant-outline'}
                size={16}
                color={colors.primary.base}
                style={styles.pairIcon}
              />
              <View style={styles.pairMeta}>
                <Text style={styles.pairDish}>{p.dish}</Text>
                {p.why ? <Text style={styles.pairWhy}>{p.why}</Text> : null}
              </View>
            </View>
          ))}

          <Text style={styles.disclaimer}>
            Pairing ideas for this bottle — cook what sounds good.
          </Text>
        </View>
      )}
    </View>
  );
}

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.body.caption,
    color: colors.accent.ink,
  },
  flexSpacer: { flex: 1 },
  tuneLink: {
    ...typography.body.small,
    color: colors.primary.base,
    fontWeight: '600',
  },

  title: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 2,
  },

  // Tune (refinements)
  tune: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pickerRow: { gap: spacing.xs },
  pickerLabel: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
  },
  pillScroll: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  pill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.bg,
    marginRight: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  pillText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
  },
  pillTextActive: {
    color: colors.neutral.bg,
    fontWeight: '600',
  },
  freeText: {
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.ink,
    marginTop: spacing.xs,
  },

  // Error
  errorRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.body.small,
    color: colors.status.error,
    textAlign: 'center',
  },
  retryLink: {
    ...typography.body.small,
    color: colors.primary.base,
    fontWeight: '600',
  },

  // Result
  result: { marginTop: spacing.md },
  resultDivider: {
    height: 1,
    backgroundColor: colors.accent.border,
    marginBottom: spacing.md,
  },
  aside: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  intro: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },

  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  pairIcon: { marginTop: 2 },
  pairMeta: { flex: 1 },
  pairDish: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '600',
  },
  pairWhy: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 1,
    lineHeight: 18,
  },

  disclaimer: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
