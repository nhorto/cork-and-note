// app/profile/achievements.js — the collection (#296).
//
// One screen for the whole Wine Journey: where you stand (level and points),
// the six tiered families with their progress, the grape shelf, the five
// one-off shelves with every locked badge's rule spelled out, and the history
// of what you earned when. Locked badges are shown on purpose: the rule is the
// invitation, and hiding them would make the collection look finished.
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AchievementBadge from '../../components/AchievementBadge';
import ScreenHeader from '../../components/ScreenHeader';
import { getAchievements, getUnseen, markSeen } from '../../lib/achievements';
import { GRAPE_TIER_LABEL, SHELVES, TIER_LABEL, badgeByKey } from '../../lib/achievements/catalog';
import { createThemedStyles } from '../../styles/ThemeProvider';


export default function AchievementsScreen() {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState(null); // { result, earnedRows }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setLoading(true);
          const res = await getAchievements();
          if (!active) return;
          if (!res?.success) {
            setFailed(true);
            return;
          }
          setFailed(false);
          setData({ result: res.result, earnedRows: res.earnedRows || [] });

          // Opening the collection counts as seeing what is in it, so the Home
          // and Profile surfaces stop nudging about the same badges.
          const unseen = await getUnseen();
          if (unseen?.rows?.length) markSeen(unseen.rows);
        } catch {
          if (active) setFailed(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const result = data?.result;
  const level = result?.level;
  const earnedRows = data?.earnedRows || [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Achievements" />

      {loading && !result ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.ink} />
        </View>
      ) : failed ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            We could not load your badges just now. Pull back and try again in a moment.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Where you stand */}
          <View style={styles.levelCard}>
            <AchievementBadge icon="bottle-wine-outline" tier="earned" size={64} />
            <View style={styles.levelText}>
              <Text style={styles.levelTitle}>{`Level ${level?.level} · ${level?.title}`}</Text>
              <Text style={styles.levelPoints}>{`${result.points} pts`}</Text>
              {level?.next ? (
                <>
                  <ProgressBar
                    value={progressBetween(result.points, level.points, level.next.points)}
                  />
                  <Text style={styles.levelNext}>
                    {`${level.next.points - result.points} to ${level.next.title}`}
                  </Text>
                </>
              ) : (
                <Text style={styles.levelNext}>Top level</Text>
              )}
            </View>
          </View>

          {earnedRows.length === 0 && result.newlyEarned.length === 0 ? (
            <Text style={styles.empty}>Log your first wine to earn your first badge.</Text>
          ) : null}

          {/* Families */}
          <SectionLabel text="FAMILIES" />
          {result.families.map((family) => (
            <View key={family.key} style={styles.familyRow}>
              <AchievementBadge
                icon={family.icon}
                tier={family.tier}
                size={48}
                locked={!family.tier}
              />
              <View style={styles.familyText}>
                <Text style={styles.familyName}>
                  {family.tierLabel ? `${family.name} · ${family.tierLabel}` : family.name}
                </Text>
                <Text style={styles.familyProgress}>
                  {family.nextThreshold
                    ? `${family.count} of ${family.nextThreshold} toward ${TIER_LABEL[family.nextTier]}`
                    : `${family.count} ${family.unit}, top tier`}
                </Text>
                <ProgressBar value={family.progress} />
                <Text style={styles.rule}>{family.rule}</Text>
              </View>
            </View>
          ))}

          {/* Grapes */}
          <SectionLabel text="GRAPES" />
          <Text style={styles.caption}>
            {`${result.allGrapes.filter((g) => g.tier).length} of ${result.allGrapes.length} at Fan or better`}
          </Text>
          <View style={styles.grid}>
            {result.allGrapes.map((grape) => (
              <View key={grape.key} style={styles.gridCell}>
                <AchievementBadge
                  icon="fruit-grapes"
                  tier={grape.tier}
                  size={48}
                  locked={!grape.tier}
                  label={grape.grape}
                />
                <Text style={styles.gridSub}>
                  {grape.tier
                    ? GRAPE_TIER_LABEL[grape.tier]
                    : `${grape.count} of ${grape.nextThreshold}`}
                </Text>
              </View>
            ))}
          </View>

          {/* Collection shelves */}
          <SectionLabel text="COLLECTION" />
          {SHELVES.map((shelf) => {
            const badges = result.oneOffs.filter((b) => b.shelf === shelf.key);
            if (badges.length === 0) return null;
            return (
              <View key={shelf.key} style={styles.shelf}>
                <Text style={styles.shelfName}>{shelf.name}</Text>
                {badges.map((badge) => (
                  <View key={badge.key} style={styles.oneOffRow}>
                    <AchievementBadge
                      icon={badge.icon}
                      tier={badge.earned ? 'earned' : null}
                      size={40}
                      locked={!badge.earned}
                    />
                    <View style={styles.familyText}>
                      <Text style={styles.familyName}>{badge.name}</Text>
                      <Text style={styles.rule}>
                        {badge.earned ? `Earned · ${badge.points} pts` : badge.rule}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}

          {/* History */}
          {earnedRows.length > 0 ? (
            <>
              <SectionLabel text="HISTORY" />
              <History rows={earnedRows} styles={styles} />
            </>
          ) : null}

          <Text
            style={styles.footerLink}
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            Back to profile
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// Earned rows newest first, with the whole pre-feature backfill collected under
// one heading so it does not read as twenty things earned on one afternoon.
function History({ rows, styles }) {
  const live = rows.filter((r) => r.source !== 'backfill');
  const backfilled = rows.filter((r) => r.source === 'backfill');
  const sorted = [...live].sort((a, b) =>
    String(b.earned_at || '').localeCompare(String(a.earned_at || ''))
  );

  return (
    <View>
      {sorted.map((row) => (
        <View key={row.id ?? `${row.badge_key}:${row.tier ?? ''}`} style={styles.historyRow}>
          <Text style={styles.historyName}>{labelFor(row)}</Text>
          <Text style={styles.historyDate}>{formatDate(row.earned_at)}</Text>
        </View>
      ))}
      {backfilled.length > 0 ? (
        <>
          <Text style={styles.shelfName}>Recognized from your journal</Text>
          {backfilled.map((row) => (
            <View key={row.id ?? `${row.badge_key}:${row.tier ?? ''}`} style={styles.historyRow}>
              <Text style={styles.historyName}>{labelFor(row)}</Text>
              <Text style={styles.historyDate}>{`${row.points} pts`}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// A stored row only knows its key and tier, so the display name is read back
// out of the catalog rather than duplicated into the database. A key the
// catalog no longer knows falls back to something readable instead of blank.
function labelFor(row) {
  const key = String(row.badge_key || '');
  const base = badgeByKey(key)?.name
    || (key.startsWith('grape:') ? key.slice('grape:'.length) : key);
  const tier = row.tier ? (TIER_LABEL[row.tier] || GRAPE_TIER_LABEL[row.tier] || row.tier) : null;
  return tier ? `${base} · ${tier}` : base;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function progressBetween(points, floor, ceiling) {
  if (ceiling <= floor) return 1;
  return Math.max(0, Math.min(1, (points - floor) / (ceiling - floor)));
}

function SectionLabel({ text }) {
  const { styles } = useScreenTheme();
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function ProgressBar({ value }) {
  const { styles } = useScreenTheme();
  const pct = `${Math.round(Math.max(0, Math.min(1, value || 0)) * 100)}%`;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: pct }]} />
    </View>
  );
}


const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.divider,
    padding: spacing.md,
  },
  levelText: { flex: 1 },
  levelTitle: { ...typography.heading.h3, color: colors.neutral.ink, fontFamily: SERIF },
  levelPoints: { ...typography.body.small, color: colors.accent.ink, marginTop: 2 },
  levelNext: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: spacing.xs },

  empty: { ...typography.body.regular, color: colors.neutral.inkSecondary, marginTop: spacing.lg },
  emptyText: { ...typography.body.regular, color: colors.neutral.inkSecondary, textAlign: 'center' },

  sectionLabel: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  caption: { ...typography.body.small, color: colors.neutral.inkSecondary, marginBottom: spacing.sm },

  familyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  familyText: { flex: 1 },
  familyName: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
  familyProgress: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
  rule: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },

  track: {
    height: 6,
    borderRadius: borderRadius.round,
    backgroundColor: colors.neutral.divider,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: borderRadius.round, backgroundColor: colors.primary.base },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '33.33%', alignItems: 'center', marginBottom: spacing.md },
  gridSub: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },

  shelf: { marginBottom: spacing.md },
  shelfName: {
    ...typography.body.regular,
    color: colors.primary.ink,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  oneOffRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },

  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  historyName: { ...typography.body.regular, color: colors.neutral.ink, flex: 1 },
  historyDate: { ...typography.body.small, color: colors.neutral.inkTertiary },

  footerLink: {
    ...typography.body.regular,
    color: colors.primary.ink,
    fontWeight: '600',
    marginTop: spacing.xl,
  },
});
return { colors, styles };
});
