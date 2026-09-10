// components/TastingLinkCard.js — link a cellar bottle to a prior tasting (#140).
//
// Sits on the bottle detail screen. Three states:
//   • Linked    → shows the tasting (name · date · rating), taps through to the
//                 wine detail; offers Change / Unlink.
//   • Suggested → no link yet, but a confident fuzzy match exists (reuses
//                 matchTastingsToBottle) → one-tap "Link", or pick another.
//   • Unlinked  → no match; a quiet "Link to a tasting" opens the picker.
// Renders nothing when the user has no tastings to link and none is linked.
//
// All matching is pure + client-side over the already-loaded tasting list, so
// the card adds no network cost; linking/unlinking is delegated to the parent
// (cellarService.linkTasting) via onLink/onUnlink.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { matchTastingsToBottle } from '../lib/cellarMatch';
import { wineDisplayName } from '../lib/wineDisplay';
import { createThemedStyles } from '../styles/ThemeProvider';


const formatDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const ratingText = (w) => {
  const r = Number(w?.overall_rating);
  return Number.isFinite(r) && r > 0 ? r.toFixed(1) : null;
};

// One selectable tasting row (used in the picker and for the inline suggestion).
function TastingRow({ wine, badge, onPress, disabled }) {
  const { colors, styles } = useScreenTheme();

  const rating = ratingText(wine);
  const meta = [formatDate(wine.visitDate), wine.placeName].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {wineDisplayName(wine)}
        </Text>
        {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.matchTag}>
          <Text style={styles.matchTagText}>{badge}</Text>
        </View>
      ) : null}
      {rating ? (
        <View style={styles.rowRating}>
          <Ionicons name="star" size={12} color={colors.accent.base} />
          <Text style={styles.rowRatingText}>{rating}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.accent.strong} />
    </TouchableOpacity>
  );
}

export default function TastingLinkCard({ bottle, tastedWines = [], onLink, onUnlink, linking = false }) {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const linkedWine = useMemo(
    () => (bottle?.tasting_wine_id ? tastedWines.find((w) => w.id === bottle.tasting_wine_id) : null),
    [bottle?.tasting_wine_id, tastedWines]
  );

  // Confident same-wine candidates (best first); the top one drives the inline suggestion.
  const suggestions = useMemo(
    () => (bottle ? matchTastingsToBottle(bottle, tastedWines) : []),
    [bottle, tastedWines]
  );

  // The picker list: matches pinned on top, then the rest most-recent-first,
  // filtered by the search query (name / place).
  const pickerList = useMemo(() => {
    const matchIds = new Set(suggestions.map((w) => w.id));
    const rest = tastedWines
      .filter((w) => !matchIds.has(w.id))
      .sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || '')));
    const ordered = [...suggestions, ...rest].filter((w) => w.id !== bottle?.tasting_wine_id);
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((w) =>
      `${wineDisplayName(w)} ${w.winemaker || ''} ${w.placeName || ''}`.toLowerCase().includes(q)
    );
  }, [suggestions, tastedWines, query, bottle?.tasting_wine_id]);

  // Nothing to show: no link and no tastings to link to.
  if (!linkedWine && tastedWines.length === 0) return null;

  const openPicker = () => {
    setQuery('');
    setPickerOpen(true);
  };

  const handlePick = (wineId) => {
    setPickerOpen(false);
    onLink?.(wineId);
  };

  const topSuggestion = suggestions[0] || null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>FROM A TASTING</Text>

      {linkedWine ? (
        <>
          <TastingRow wine={linkedWine} onPress={() => router.push(`/wine/${linkedWine.id}`)} disabled={linking} />
          <View style={styles.linkedActions}>
            <TouchableOpacity onPress={openPicker} disabled={linking} hitSlop={6}>
              <Text style={styles.linkAction}>Change</Text>
            </TouchableOpacity>
            <Text style={styles.dot}>·</Text>
            <TouchableOpacity onPress={() => onUnlink?.()} disabled={linking} hitSlop={6}>
              <Text style={[styles.linkAction, styles.unlink]}>Unlink</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : topSuggestion ? (
        <>
          <Text style={styles.prompt}>You may have tasted this before — link it to that tasting?</Text>
          <TastingRow
            wine={topSuggestion}
            badge="Likely match"
            onPress={() => handlePick(topSuggestion.id)}
            disabled={linking}
          />
          <TouchableOpacity onPress={openPicker} disabled={linking} hitSlop={6} style={styles.chooseAnother}>
            <Text style={styles.linkAction}>Link a different tasting</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.linkBtn} onPress={openPicker} disabled={linking} activeOpacity={0.85}>
          <Ionicons name="link-outline" size={16} color={colors.primary.ink} />
          <Text style={styles.linkBtnText}>Link to a tasting</Text>
        </TouchableOpacity>
      )}

      {/* Picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Link a tasting</Text>
            <Text style={styles.sheetIntro}>Pick the tasting this bottle is from.</Text>

            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search your tastings…"
              placeholderTextColor={colors.neutral.placeholder}
              selectionColor={colors.primary.ink}
              autoCorrect={false}
            />

            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {pickerList.length === 0 ? (
                <Text style={styles.empty}>No matching tastings.</Text>
              ) : (
                pickerList.map((w) => {
                  const isMatch = suggestions.some((s) => s.id === w.id);
                  return (
                    <TastingRow
                      key={w.id}
                      wine={w}
                      badge={isMatch ? 'Likely match' : null}
                      onPress={() => handlePick(w.id)}
                    />
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setPickerOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardLabel: { ...typography.body.caption, color: colors.accent.ink, marginBottom: spacing.sm },
  prompt: { ...typography.body.small, color: colors.neutral.inkSecondary, marginBottom: spacing.sm, lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowBody: { flex: 1 },
  rowName: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  rowMeta: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 1 },
  rowRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowRatingText: { ...typography.body.small, color: colors.neutral.ink, fontWeight: '600' },

  matchTag: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  matchTagText: { ...typography.body.caption, color: colors.primary.ink },

  linkedActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  linkAction: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },
  unlink: { color: colors.status.error },
  dot: { color: colors.neutral.placeholder },
  chooseAnother: { marginTop: spacing.sm },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    backgroundColor: colors.accent.surface,
  },
  linkBtnText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },

  // Picker sheet
  backdrop: { flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  sheetTitle: { ...typography.heading.h2, color: colors.neutral.ink, fontFamily: SERIF, marginBottom: spacing.xs },
  sheetIntro: { ...typography.body.small, color: colors.neutral.inkSecondary, marginBottom: spacing.md },
  search: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body.regular,
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
  },
  pickerScroll: { flexGrow: 0 },
  empty: { ...typography.body.regular, color: colors.neutral.inkTertiary, textAlign: 'center', paddingVertical: spacing.xl },

  sheetCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary.base,
    alignItems: 'center',
  },
  sheetCancelText: { ...typography.body.regular, color: colors.primary.ink, fontWeight: '600' },
});
return { colors, styles };
});
