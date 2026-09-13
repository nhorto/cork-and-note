// components/AchievementsCard.js — the Profile tab's way into the collection (#296).
//
// Level, the three badges earned most recently, and a count. It hides itself
// entirely when achievements fail to load, because a broken garnish should not
// leave a hole in the Profile screen.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AchievementBadge from './AchievementBadge';
import { getAchievements } from '../lib/achievements';
import { badgeByKey } from '../lib/achievements/catalog';
import { createThemedStyles } from '../styles/ThemeProvider';


export default function AchievementsCard() {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();
  const [view, setView] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await getAchievements();
          if (!active || !res?.success) return;
          const rows = [...(res.earnedRows || [])].sort((a, b) =>
            String(b.earned_at || '').localeCompare(String(a.earned_at || ''))
          );
          setView({
            level: res.result.level,
            points: res.result.points,
            earned: rows.length,
            total: totalBadges(res.result),
            recent: rows.slice(0, 3),
          });
        } catch {
          // leave the card hidden
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!view) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push('/profile/achievements')}
      accessibilityRole="button"
      accessibilityLabel="Open your achievements"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {`Level ${view.level.level} · ${view.level.title}`}
          </Text>
          <Text style={styles.sub}>
            {`${view.points} pts · ${view.earned} of ${view.total} badges`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.neutral.inkTertiary} />
      </View>

      {view.recent.length > 0 ? (
        <View style={styles.row}>
          {view.recent.map((row) => (
            <AchievementBadge
              key={row.id ?? `${row.badge_key}:${row.tier ?? ''}`}
              icon={badgeByKey(row.badge_key)?.icon || 'fruit-grapes'}
              tier={row.tier || 'earned'}
              size={40}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.sub}>Log a wine to earn your first badge.</Text>
      )}
    </TouchableOpacity>
  );
}

function totalBadges(result) {
  return (
    (result.families?.length || 0) * 4 +
    (result.allGrapes?.length || 0) * 3 +
    (result.oneOffs?.length || 0)
  );
}


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.divider,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  title: { ...typography.heading.h3, color: colors.neutral.ink, fontFamily: SERIF },
  sub: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
return { colors, styles };
});
