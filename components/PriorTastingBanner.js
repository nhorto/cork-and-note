// components/PriorTastingBanner.js — "you've logged this before" heads-up (#93).
//
// Sits inside the wine form, just under the identity fields (winemaker / name /
// varietal / year), because it IS identity context.
//
// Two deliberate design constraints, both from docs/research/duplicate-tasting-awareness.md:
//
//   1. It NEVER blocks the save. Re-tasting a wine is normal, desirable
//      behaviour — often the point of the app — so this is a quiet, dismissible
//      banner, not a modal or a save-time "are you sure?".
//
//   2. The previous RATING is behind an explicit tap. Showing an old 7.5 above
//      an untouched rating slider anchors the new score, which quietly corrupts
//      the honest independent reaction the app exists to capture. Identity and
//      date are free; the score and notes cost one tap.
//
// Copy varies by confidence tier so we never overclaim — see TIER in
// lib/cellarMatch.js.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TIER } from '../lib/cellarMatch';
import { wineDisplayName } from '../lib/wineDisplay';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const formatDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const ratingText = (w) => {
  const r = Number(w?.overall_rating ?? w?.overallRating);
  return Number.isFinite(r) && r > 0 ? r.toFixed(1) : null;
};

// Headline per tier. `variant` is 'session' when the duplicate is another wine
// on the CURRENT unsaved visit — a much stronger signal (that one probably IS a
// mistake), so it gets firmer, more direct wording.
function headline(result, variant) {
  const { tier, count, otherVintage, mostRecent } = result;
  if (variant === 'session') {
    return "You've already added this wine to this visit";
  }
  const when = formatDate(mostRecent?.visitDate);
  if (tier === TIER.RELATED) {
    return otherVintage ? `You've tasted the ${otherVintage}` : "You've tasted this in another vintage";
  }
  if (count > 1) {
    return `You've logged this ${count} times${when ? ` — most recently ${when}` : ''}`;
  }
  // CERTAIN states it plainly; LIKELY hedges, because a vintage is missing on
  // one side and we genuinely can't be sure it's the same bottling.
  if (tier === TIER.LIKELY) {
    return when ? `You may have logged this before — ${when}` : 'You may have logged this before';
  }
  return when ? `You logged this on ${when}` : 'You logged this before';
}

export default function PriorTastingBanner({ result, variant = 'prior', onDismiss, onOpen }) {
  const [showNote, setShowNote] = useState(false);
  if (!result?.mostRecent) return null;

  const wine = result.mostRecent;
  const rating = ratingText(wine);
  const notes = (wine.additional_notes || wine.additionalNotes || '').trim();
  const meta = [wine.placeName, variant === 'prior' ? null : formatDate(wine.visitDate)]
    .filter(Boolean)
    .join(' · ');
  const canReveal = Boolean(rating || notes || onOpen);

  return (
    <View style={[styles.banner, variant === 'session' && styles.bannerSession]}>
      <View style={styles.head}>
        <Ionicons
          name={variant === 'session' ? 'alert-circle' : 'wine'}
          size={18}
          color={colors.primary.burgundy}
        />
        <View style={styles.headBody}>
          <Text style={styles.headline}>{headline(result, variant)}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[wineDisplayName(wine), meta].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {onDismiss ? (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={16} color={colors.neutral.pewter} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Opt-in reveal — see the anchoring note in the header. */}
      {canReveal && !showNote ? (
        <TouchableOpacity onPress={() => setShowNote(true)} accessibilityRole="button">
          <Text style={styles.reveal}>See my previous note ›</Text>
        </TouchableOpacity>
      ) : null}

      {showNote ? (
        <View style={styles.note}>
          {rating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={colors.gold.rich} />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          ) : null}
          {notes ? <Text style={styles.noteText}>{notes}</Text> : null}
          {!rating && !notes ? (
            <Text style={styles.noteEmpty}>No rating or notes saved for that tasting.</Text>
          ) : null}
          {onOpen ? (
            <TouchableOpacity onPress={() => onOpen(wine)} accessibilityRole="button">
              <Text style={styles.reveal}>Open that tasting ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  bannerSession: {
    backgroundColor: colors.neutral.parchment,
    borderColor: colors.primary.burgundy,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headBody: { flex: 1 },
  headline: {
    ...typography.body.small,
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  // NOT typography.body.caption — that's a LABEL style (uppercase + letterspaced,
  // as used for "WINEMAKER" / "YEAR"). Running a wine name through it renders
  // "BOURBON BARREL AGED CAB", which is unreadable and unlike how the name shows
  // everywhere else.
  sub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },
  reveal: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gold.muted,
    gap: spacing.xs,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: {
    ...typography.body.small,
    color: colors.neutral.charcoal,
    fontWeight: '600',
  },
  noteText: { ...typography.body.small, color: colors.neutral.graphite, lineHeight: 19 },
  noteEmpty: { ...typography.body.small, color: colors.neutral.pewter, fontStyle: 'italic' },
});
