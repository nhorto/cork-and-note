// components/NearYouRow.js — winery discovery on Home, available on every plan.
// Reads our directory, without Google Places calls. Location permission is
// requested only when the user taps the enable card. Opening a winery leads
// to its free page, where live Google enrichment remains a separate Pro feature.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import { createThemedStyles } from '../styles/ThemeProvider';


const KM_TO_MI = 0.621371;

export default function NearYouRow() {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();

  // 'unknown' until checked; permission drives which card renders.
  const [permission, setPermission] = useState('unknown');
  const [wineries, setWineries] = useState(null);

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
  }, [loadNearby]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status === 'granted') loadNearby();
    } catch {
      setPermission('denied');
    }
  };

  // Tap-through opens a preview of the directory winery (#270); nothing is
  // saved until the user logs a visit or adds it to the wishlist. The page
  // swaps to your own winery if you already have one linked.
  const openWinery = (w) => {
    router.push(`/winery/dir-${w.id}`);
  };

  const header = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>NEAR YOU</Text>
    </View>
  );

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
          <Ionicons name="navigate-outline" size={18} color={colors.primary.ink} />
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




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.body.caption, color: colors.accent.ink },
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
return { colors, styles };
});
