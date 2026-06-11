// components/TonightsPickCard.js — "Tonight's pick" hero (Epic #6 · R1 · #51).
// Points the AI sommelier at the user's own cellar: one inventory-grounded
// recommendation with a one-line *why*, flavor highlights, and two alternatives,
// driven by tap-first occasion / cuisine / mood pickers + optional free text.
//
// Self-contained: fetches its own cellar context and talks to the AI via
// lib/cellarSommelier.js. Drop it on Home (or anywhere) with no required props.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  cellarSommelier,
  CUISINES,
  MOODS,
  OCCASIONS,
} from '../lib/cellarSommelier';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

// Persist the user's collapse choice so the card stays how they left it.
const COLLAPSE_KEY = 'tonightsPick.collapsed';

// A horizontal row of single-select pill choices.
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

export default function TonightsPickCard({ onRequireCellar }) {
  const router = useRouter();

  const [bottles, setBottles] = useState(null); // null = not loaded yet
  const [loadingCellar, setLoadingCellar] = useState(true);

  const [occasion, setOccasion] = useState(null);
  const [cuisine, setCuisine] = useState(null);
  const [mood, setMood] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [showPickers, setShowPickers] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [thinking, setThinking] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [aside, setAside] = useState(''); // the model's friendly sentence
  const [error, setError] = useState(null);

  // Load the cellar once so we can show the right empty/CTA state.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingCellar(true);
      const res = await cellarSommelier.getCellarBottles();
      if (!active) return;
      setBottles(res.success ? res.bottles : []);
      setLoadingCellar(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Restore the saved collapse preference once on mount (fails soft → expanded).
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(COLLAPSE_KEY)
      .then((v) => {
        if (active && v != null) setCollapsed(v === '1');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      AsyncStorage.setItem(COLLAPSE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const hasCellar = Array.isArray(bottles) && bottles.length > 0;

  const askSommelier = useCallback(async () => {
    if (!hasCellar) return;
    setThinking(true);
    setError(null);
    try {
      const res = await cellarSommelier.getTonightsPick(bottles, {
        occasion,
        cuisine,
        mood,
        freeText,
      });
      if (res.success) {
        setRecommendation(res.recommendation);
        setAside(res.raw || '');
      } else {
        setRecommendation(null);
        setError(
          res.error || "The sommelier couldn't decide. Please try again."
        );
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setThinking(false);
    }
  }, [bottles, hasCellar, occasion, cuisine, mood, freeText]);

  // ── Loading the cellar ───────────────────────────────────
  if (loadingCellar) {
    return (
      <View style={[styles.card, styles.centeredCard]}>
        <ActivityIndicator color={colors.gold.rich} />
      </View>
    );
  }

  // ── Empty cellar: prompt to add bottles ──────────────────
  if (!hasCellar) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="sparkles" size={18} color={colors.gold.rich} />
          <Text style={styles.eyebrow}>TONIGHT&apos;S PICK</Text>
        </View>
        <Text style={styles.emptyTitle}>Let the sommelier pick from your cellar</Text>
        <Text style={styles.emptyBody}>
          Add a few bottles you own and your sommelier will recommend exactly
          what to open tonight — with the reasoning and a couple of alternatives.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={() =>
            onRequireCellar ? onRequireCellar() : router.push('/cellar/add')
          }
        >
          <Ionicons name="add" size={18} color={colors.neutral.cream} />
          <Text style={styles.primaryBtnText}>Add a bottle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Populated cellar ─────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Header — tap anywhere to collapse / expand; the chevron shows state. */}
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={toggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? "Expand Tonight's Pick" : "Collapse Tonight's Pick"}
      >
        <Ionicons name="sparkles" size={18} color={colors.gold.rich} />
        <Text style={styles.eyebrow}>TONIGHT&apos;S PICK</Text>
        {collapsed ? (
          <Text style={styles.collapsedTeaser} numberOfLines={1}>
            What should I drink tonight?
          </Text>
        ) : null}
        <View style={styles.flexSpacer} />
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={colors.primary.burgundy}
        />
      </TouchableOpacity>

      {!collapsed && (
        <>
      <Text style={styles.title}>What should I drink tonight?</Text>
      <Text style={styles.subtitle}>
        From the {bottles.length} lot{bottles.length === 1 ? '' : 's'} in your cellar.
      </Text>

      {/* Discoverable context control (replaces the easy-to-miss corner "Tune"). */}
      <TouchableOpacity
        style={styles.tuneBtn}
        activeOpacity={0.8}
        onPress={() => setShowPickers((s) => !s)}
      >
        <Ionicons name="options-outline" size={16} color={colors.primary.burgundy} />
        <View style={styles.tuneBtnTextWrap}>
          <Text style={styles.tuneBtnText}>
            {showPickers ? 'Hide options' : 'Tune your pick'}
          </Text>
          {!showPickers ? (
            <Text style={styles.tuneBtnHint}>Set the occasion, food &amp; mood</Text>
          ) : null}
        </View>
        <Ionicons
          name={showPickers ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.primary.burgundy}
        />
      </TouchableOpacity>

      {/* Tap-first pickers */}
      {showPickers && (
        <View style={styles.pickers}>
          <PickerRow
            label="Occasion"
            options={OCCASIONS}
            value={occasion}
            onChange={setOccasion}
          />
          <PickerRow
            label="Food"
            options={CUISINES}
            value={cuisine}
            onChange={setCuisine}
          />
          <PickerRow
            label="Mood"
            options={MOODS}
            value={mood}
            onChange={setMood}
          />
          <TextInput
            style={styles.freeText}
            placeholder="Optional: e.g. something for grilled salmon"
            placeholderTextColor={colors.neutral.silver}
            value={freeText}
            onChangeText={setFreeText}
            returnKeyType="done"
            onSubmitEditing={askSommelier}
          />
        </View>
      )}

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.primaryBtn, thinking && styles.primaryBtnDisabled]}
        activeOpacity={0.9}
        onPress={askSommelier}
        disabled={thinking}
      >
        {thinking ? (
          <ActivityIndicator color={colors.neutral.cream} size="small" />
        ) : (
          <Ionicons name="wine" size={18} color={colors.neutral.cream} />
        )}
        <Text style={styles.primaryBtnText}>
          {thinking
            ? 'Choosing…'
            : recommendation
            ? 'Pick again'
            : 'Pick my bottle'}
        </Text>
      </TouchableOpacity>

      {/* Error */}
      {error && !thinking && <Text style={styles.errorText}>{error}</Text>}

      {/* Recommendation */}
      {recommendation && !thinking && (
        <View style={styles.result}>
          <View style={styles.resultDivider} />

          {/* The sommelier's friendly lead-in (conversational text) */}
          {aside ? <Text style={styles.aside}>{aside}</Text> : null}

          {/* The hero pick */}
          <TouchableOpacity
            activeOpacity={recommendation.pick.bottleId ? 0.85 : 1}
            disabled={!recommendation.pick.bottleId}
            onPress={() =>
              recommendation.pick.bottleId &&
              router.push(`/cellar/${recommendation.pick.bottleId}`)
            }
          >
            <Text style={styles.pickLabel}>OPEN THIS</Text>
            <Text style={styles.pickName}>
              {recommendation.pick.name}
              {recommendation.pick.vintage
                ? ` ${recommendation.pick.vintage}`
                : ''}
            </Text>
            {recommendation.pick.producer ? (
              <Text style={styles.pickProducer}>
                {recommendation.pick.producer}
              </Text>
            ) : null}
            {recommendation.pick.why ? (
              <Text style={styles.pickWhy}>{recommendation.pick.why}</Text>
            ) : null}

            {recommendation.pick.flavorHighlights?.length > 0 && (
              <View style={styles.flavorWrap}>
                {recommendation.pick.flavorHighlights.map((f) => (
                  <View key={f} style={styles.flavorChip}>
                    <Text style={styles.flavorChipText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {recommendation.pick.bottleId ? (
              <View style={styles.viewBottleRow}>
                <Text style={styles.viewBottleText}>View bottle</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.primary.burgundy}
                />
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Alternatives */}
          {recommendation.alternatives?.length > 0 && (
            <View style={styles.altSection}>
              <Text style={styles.altHeader}>OR INSTEAD</Text>
              {recommendation.alternatives.map((alt, i) => (
                <TouchableOpacity
                  key={`${alt.name}-${i}`}
                  style={styles.altRow}
                  activeOpacity={alt.bottleId ? 0.85 : 1}
                  disabled={!alt.bottleId}
                  onPress={() =>
                    alt.bottleId && router.push(`/cellar/${alt.bottleId}`)
                  }
                >
                  <Ionicons
                    name="wine-outline"
                    size={16}
                    color={colors.primary.burgundy}
                    style={styles.altIcon}
                  />
                  <View style={styles.altMeta}>
                    <Text style={styles.altName}>
                      {alt.name}
                      {alt.vintage ? ` ${alt.vintage}` : ''}
                    </Text>
                    {alt.why ? (
                      <Text style={styles.altWhy}>{alt.why}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer}>
            Advice from your cellar — pick what feels right.
          </Text>
        </View>
      )}
        </>
      )}
    </View>
  );
}

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    padding: spacing.md,
    ...shadows.soft,
  },
  centeredCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
  },
  flexSpacer: { flex: 1 },
  collapsedTeaser: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginLeft: spacing.sm,
    flexShrink: 1,
  },

  // Discoverable "Tune your pick" control (replaces the corner "Tune" link).
  tuneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  tuneBtnTextWrap: { flex: 1 },
  tuneBtnText: {
    ...typography.body.regular,
    color: colors.primary.burgundy,
    fontWeight: '600',
  },
  tuneBtnHint: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },

  title: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: SERIF,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
  },

  // Pickers
  pickers: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pickerRow: {
    gap: spacing.xs,
  },
  pickerLabel: {
    ...typography.body.caption,
    color: colors.neutral.pewter,
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
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.cream,
    marginRight: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.primary.burgundy,
    borderColor: colors.primary.burgundy,
  },
  pillText: {
    ...typography.body.small,
    color: colors.neutral.graphite,
  },
  pillTextActive: {
    color: colors.neutral.cream,
    fontWeight: '600',
  },
  freeText: {
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    marginTop: spacing.xs,
  },

  // CTA
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    ...typography.heading.h3,
    color: colors.neutral.cream,
    fontFamily: SERIF,
  },

  errorText: {
    ...typography.body.small,
    color: colors.status.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Result
  result: {
    marginTop: spacing.md,
  },
  resultDivider: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginBottom: spacing.md,
  },
  aside: {
    ...typography.body.small,
    color: colors.neutral.graphite,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  pickLabel: {
    ...typography.body.caption,
    color: colors.gold.shimmer,
  },
  pickName: {
    ...typography.heading.h2,
    color: colors.primary.burgundy,
    fontFamily: SERIF,
    marginTop: 2,
  },
  pickProducer: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
  },
  pickWhy: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  flavorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flavorChip: {
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.round,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  flavorChipText: {
    ...typography.body.small,
    color: colors.gold.shimmer,
    fontSize: 12,
  },

  viewBottleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
  },
  viewBottleText: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '600',
  },

  // Alternatives
  altSection: {
    marginTop: spacing.lg,
  },
  altHeader: {
    ...typography.body.caption,
    color: colors.neutral.pewter,
    marginBottom: spacing.sm,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
  },
  altIcon: {
    marginTop: 2,
  },
  altMeta: {
    flex: 1,
  },
  altName: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  altWhy: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 1,
    lineHeight: 18,
  },

  disclaimer: {
    ...typography.body.small,
    color: colors.neutral.silver,
    fontStyle: 'italic',
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Empty state
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: SERIF,
    marginTop: spacing.sm,
  },
  emptyBody: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
});
