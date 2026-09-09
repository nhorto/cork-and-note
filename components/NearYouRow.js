// components/NearYouRow.js — "Near You" winery discovery on Home (Pro).
// Epic #203 Phase 2, Home A "Passport" mockup. Discovery reads OUR
// winery_directory table (lib/wineryDirectory.js) — no Google API cost.
//
// Tier behavior:
//   Free → section with a PRO badge and one teaser card → paywall. Visible on
//          purpose: this row is part of the Pro price story.
//   Pro  → asks for foreground location ONLY when the user taps the enable
//          card (never automatically on Home mount), then shows the three
//          nearest wineries. Tapping one finds-or-creates the winery record
//          (the same row a logged visit would create — it appears as a
//          neutral pin on the map) and opens its page, where the Google
//          enrichment card takes over.
//
// Renders nothing when location is denied or no winery is within ~40 km —
// Home should never show an empty shell.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePro } from '../hooks/usePro';
import { wineriesService } from '../lib/wineries';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

const KM_TO_MI = 0.621371;

export default function NearYouRow() {
  const { isPro, presentPaywall } = usePro();
  const router = useRouter();

  // 'unknown' until checked; permission drives which card renders.
  const [permission, setPermission] = useState('unknown');
  const [wineries, setWineries] = useState(null);
  const [opening, setOpening] = useState(null); // directory id being opened

  const loadNearby = useCallback(async () => {
    try {
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!pos) return;
      const res = await wineryDirectoryService.getNearby({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        limitCount: 3,
      });
      if (res.success) setWineries(res.wineries);
    } catch {
      // location or query failed — the row simply stays hidden
    }
  }, []);

  useEffect(() => {
    if (!isPro) return;
    let active = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!active) return;
        setPermission(status);
        if (status === 'granted') loadNearby();
      } catch {
        if (active) setPermission('denied');
      }
    })();
    return () => {
      active = false;
    };
  }, [isPro, loadNearby]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status === 'granted') loadNearby();
    } catch {
      setPermission('denied');
    }
  };

  // Tap-through: find-or-create our winery record, then open its page (the
  // Google card there does the live enrichment).
  const openWinery = async (w) => {
    if (opening) return;
    setOpening(w.id);
    try {
      const res = await wineriesService.findOrCreateWinery({
        name: w.name,
        latitude: w.latitude,
        longitude: w.longitude,
        address: [w.city, w.state].filter(Boolean).join(', ') || null,
      });
      const id = res?.winery?.id;
      if (id != null) router.push(`/winery/${id}`);
    } finally {
      setOpening(null);
    }
  };

  const header = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>NEAR YOU</Text>
      {!isPro && (
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      )}
    </View>
  );

  if (!isPro) {
    return (
      <>
        {header}
        <TouchableOpacity
          style={styles.teaser}
          activeOpacity={0.85}
          onPress={() => presentPaywall('places')}
          accessibilityRole="button"
          accessibilityLabel="Wineries near you — Pro feature"
        >
          <Ionicons name="location" size={18} color={colors.accent.base} />
          <Text style={styles.teaserText}>Find wineries near you</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.neutral.placeholder} />
        </TouchableOpacity>
      </>
    );
  }

  if (permission === 'unknown') return null;

  if (permission !== 'granted') {
    // Never nag: one quiet enable card; a hard "denied" from the system
    // sheet leaves the row hidden until Settings changes it.
    if (permission === 'denied' && wineries === null) return null;
    return (
      <>
        {header}
        <TouchableOpacity
          style={styles.teaser}
          activeOpacity={0.85}
          onPress={requestLocation}
          accessibilityRole="button"
          accessibilityLabel="Show wineries near you"
        >
          <Ionicons name="navigate-outline" size={18} color={colors.primary.base} />
          <Text style={styles.teaserText}>Show wineries near you</Text>
          <Text style={styles.teaserSub}>Uses location only while open</Text>
        </TouchableOpacity>
      </>
    );
  }

  if (!wineries || wineries.length === 0) return null;

  return (
    <>
      {header}
      <View style={styles.row}>
        {wineries.map((w) => {
          const mi = w.distanceKm * KM_TO_MI;
          const distance = mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
          return (
            <TouchableOpacity
              key={w.id}
              style={styles.card}
              activeOpacity={0.85}
              disabled={opening != null}
              onPress={() => openWinery(w)}
              accessibilityRole="button"
              accessibilityLabel={`${w.name}, ${distance} away`}
            >
              <Text style={styles.cardName} numberOfLines={2}>
                {w.name}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {distance}
                {w.city ? ` · ${w.city}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.body.caption, color: colors.accent.ink },
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
    color: colors.neutral.ink,
  },
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
    minHeight: 44,
  },
  teaserText: {
    ...typography.body.small,
    color: colors.neutral.ink,
    fontWeight: '600',
    flex: 1,
  },
  teaserSub: { ...typography.body.caption, color: colors.neutral.inkTertiary },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minHeight: 64,
    justifyContent: 'space-between',
  },
  cardName: { ...typography.body.small, color: colors.neutral.ink, fontWeight: '700' },
  cardMeta: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: 2 },
});
