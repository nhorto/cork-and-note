// components/WineryGoogleCard.js — live Google details on a winery page (Pro).
// Epic #203 Phase 2; plan: docs/research/winery-enrichment-google-places.md §2.5.
//
// Behavior by tier:
//   Free  → one quiet teaser row that opens the paywall (this feature is part
//           of the Pro price story, so it should be *visible*, not hidden).
//   Pro   → resolve a google_place_id (stored on the winery, or matched once
//           via the free IDs-Only search when we have coordinates to bias by,
//           then persisted), then live-fetch rating / open-now / hours /
//           website / phone. Google policy: none of that may be stored, so
//           it's fetched per page-open (session-memoized in lib/places.js).
//
// Degrades to NOTHING on any failure (offline, quota cap hit, no match) —
// the user's own visits are the page's real content; Google is garnish.
// Attribution: Google requires attribution alongside Places data and a link
// out to the place; the "About this winery — Google" label + "View on
// Google Maps" row satisfy that (official logo asset is a noted follow-up).
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePro } from '../hooks/usePro';
import { placesService } from '../lib/places';
import { createThemedStyles } from '../styles/ThemeProvider';


// directoryId (optional): the winery_directory row this page was opened from
// (only known right after a discovery pin / Near You promotion). Passed to the
// details call so the server can write Google's businessStatus back to the
// exact directory row (#225).
export default function WineryGoogleCard({ winery, directoryId = null, onPlaceIdSaved }) {
  const { colors, styles } = useScreenTheme();


  const { isPro, presentPaywall } = usePro();
  const [details, setDetails] = useState(null);
  const [hoursOpen, setHoursOpen] = useState(false);

  useEffect(() => {
    if (!isPro || !winery?.id) return;
    let active = true;

    (async () => {
      let placeId = winery.google_place_id ?? null;

      // One-time lazy match (free IDs-Only search). Only auto-attach when we
      // have coordinates to bias by — a name-only match across the whole
      // world is too likely to grab the wrong "Willow Creek".
      if (!placeId && winery.latitude != null && winery.longitude != null) {
        const match = await placesService.matchWinery({
          name: winery.name,
          latitude: winery.latitude,
          longitude: winery.longitude,
        });
        if (!active) return;
        placeId = match.success ? match.candidates?.[0]?.place_id ?? null : null;
        if (placeId) {
          // Place IDs are the one Google datum we may store — persist so the
          // next open skips the match entirely.
          placesService.saveWineryPlaceId(winery.id, placeId);
          onPlaceIdSaved?.(placeId);
        }
      }
      if (!placeId) return;

      const res = await placesService.getDetails(placeId, { directoryId });
      if (active && res.success) setDetails(res.details);
    })();

    return () => {
      active = false;
    };
  }, [isPro, winery?.id, winery?.google_place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free tier: the teaser IS the feature's storefront.
  if (!isPro) {
    return (
      <TouchableOpacity
        style={styles.teaser}
        activeOpacity={0.85}
        onPress={() => presentPaywall('places')}
        accessibilityRole="button"
        accessibilityLabel="Winery ratings and hours — Pro feature"
      >
        <Ionicons name="star" size={18} color={colors.accent.base} />
        <Text style={styles.teaserText}>Ratings, hours & website</Text>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.neutral.placeholder} />
      </TouchableOpacity>
    );
  }

  if (!details) return null;

  const hasRating = typeof details.rating === 'number';
  const hasHours = Array.isArray(details.weekday_hours) && details.weekday_hours.length > 0;
  // businessStatus (#225): a permanent closure is a fact about the place, not
  // an hours state — it gets its own badge (error red) and replaces the
  // hours-based Open/Closed pill, which is meaningless for a closed business.
  const permanentlyClosed = details.business_status === 'CLOSED_PERMANENTLY';
  const temporarilyClosed = details.business_status === 'CLOSED_TEMPORARILY';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>ABOUT THIS WINERY · GOOGLE</Text>

      {(permanentlyClosed || temporarilyClosed) && (
        <View style={styles.statusRow}>
          <View style={permanentlyClosed ? styles.permanentlyClosedBadge : styles.temporarilyClosedBadge}>
            <Ionicons
              name="alert-circle"
              size={14}
              color={permanentlyClosed ? colors.neutral.bg : colors.neutral.inkSecondary}
            />
            <Text
              style={
                permanentlyClosed
                  ? styles.permanentlyClosedText
                  : styles.temporarilyClosedText
              }
            >
              {permanentlyClosed ? 'Permanently closed' : 'Temporarily closed'}
            </Text>
          </View>
        </View>
      )}

      {(hasRating || (details.open_now != null && !permanentlyClosed)) && (
        <View style={styles.topRow}>
          {hasRating && (
            <View style={styles.ratingWrap}>
              <Ionicons name="star" size={16} color={colors.accent.base} />
              <Text style={styles.rating}>{details.rating.toFixed(1)}</Text>
              {details.rating_count != null && (
                <Text style={styles.ratingCount}>({details.rating_count})</Text>
              )}
            </View>
          )}
          {details.open_now != null && !permanentlyClosed && (
            <View style={[styles.openPill, !details.open_now && styles.closedPill]}>
              <Text style={[styles.openPillText, !details.open_now && styles.closedPillText]}>
                {details.open_now ? 'Open now' : 'Closed'}
              </Text>
            </View>
          )}
        </View>
      )}

      {hasHours && (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() => setHoursOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={hoursOpen ? 'Hide hours' : 'Show hours'}
        >
          <Ionicons name="time-outline" size={16} color={colors.neutral.inkTertiary} />
          <Text style={styles.rowText}>Hours</Text>
          <Ionicons
            name={hoursOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.neutral.placeholder}
          />
        </TouchableOpacity>
      )}
      {hoursOpen &&
        details.weekday_hours.map((line) => (
          <Text key={line} style={styles.hoursLine}>
            {line}
          </Text>
        ))}

      {details.website && (
        <LinkRow icon="globe-outline" label="Website" onPress={() => Linking.openURL(details.website)} />
      )}
      {details.phone && (
        <LinkRow icon="call-outline" label={details.phone} onPress={() => Linking.openURL(`tel:${details.phone}`)} />
      )}
      {details.google_maps_uri && (
        <LinkRow
          icon="logo-google"
          label="View on Google Maps"
          onPress={() => Linking.openURL(details.google_maps_uri)}
        />
      )}
    </View>
  );
}

function LinkRow({ icon, label, onPress }) {
  const { colors, styles } = useScreenTheme();

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={colors.neutral.inkTertiary} />
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.neutral.placeholder} />
    </TouchableOpacity>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  // Free-tier teaser
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  teaserText: {
    ...typography.body.small,
    color: colors.neutral.ink,
    fontWeight: '600',
    flex: 1,
  },
  proBadge: {
    backgroundColor: colors.accent.base,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.onAccent,
  },

  // Pro card
  card: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  label: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '700',
  },
  ratingCount: { ...typography.body.small, color: colors.neutral.inkTertiary },
  openPill: {
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  openPillText: { ...typography.body.small, color: colors.onStatus, fontWeight: '600' },
  closedPill: { backgroundColor: colors.neutral.divider },
  closedPillText: { color: colors.neutral.inkSecondary },

  // businessStatus badges (#225) — deliberately distinct from the hours pill.
  statusRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  permanentlyClosedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  permanentlyClosedText: {
    ...typography.body.small,
    color: colors.neutral.bg,
    fontWeight: '700',
  },
  temporarilyClosedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.divider,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  temporarilyClosedText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  rowText: { ...typography.body.small, color: colors.neutral.ink, flex: 1 },
  hoursLine: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
    paddingLeft: spacing.lg + spacing.xs,
    paddingBottom: spacing.xs,
  },
});
return { colors, styles };
});
