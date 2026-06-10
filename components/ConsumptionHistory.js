// components/ConsumptionHistory.js — consumption history for a cellar lot (R5 / #55)
// Renders the dated audit trail of a bottle: each row shows date · reason · qty ·
// note, and links to the logged tasting when one exists (cellar_consumptions.wine_id).
// Replaces the bare "Times opened: N" on the bottle detail screen.
//
// Reasons map to the cellar_status enum. The Coravin "tasted, keep the bottle"
// sample is recorded with reason === KEEP_BOTTLE_REASON ('in_cellar') — see
// lib/cellar.js — and is presented as "Tasted (kept)" with no draw-down implied.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KEEP_BOTTLE_REASON } from '../lib/cellar';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

// Human label + icon per reason (enum value → presentation).
const REASON_META = {
  [KEEP_BOTTLE_REASON]: { label: 'Tasted (kept)', icon: 'wine-outline' },
  consumed: { label: 'Drank', icon: 'wine' },
  gifted: { label: 'Gifted', icon: 'gift-outline' },
  sold: { label: 'Sold', icon: 'pricetag-outline' },
  spoiled: { label: 'Spoiled', icon: 'sad-outline' },
};

function reasonMeta(reason) {
  return REASON_META[reason] || { label: reason || 'Removed', icon: 'ellipse-outline' };
}

// "2026-06-09" → "Jun 9, 2026" without pulling in a date lib.
function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ConsumptionHistory({ consumptions }) {
  const router = useRouter();

  const rows = (consumptions || [])
    .slice()
    .sort((a, b) => {
      // Newest first — by consumed_date, then created_at as a tiebreaker.
      const dateDiff = String(b.consumed_date || '').localeCompare(String(a.consumed_date || ''));
      if (dateDiff !== 0) return dateDiff;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>HISTORY</Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No history yet. Opening or tasting a bottle records it here.
        </Text>
      ) : (
        rows.map((row, i) => {
          const meta = reasonMeta(row.reason);
          const isSample = row.reason === KEEP_BOTTLE_REASON;
          const hasTasting = !!row.wine_id;
          return (
            <View key={row.id || i} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <View style={styles.iconWrap}>
                <Ionicons name={meta.icon} size={18} color={colors.primary.burgundy} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.reason}>{meta.label}</Text>
                  {!isSample && row.quantity ? (
                    <Text style={styles.qty}>
                      ×{row.quantity}
                    </Text>
                  ) : null}
                  <Text style={styles.date}>{formatDate(row.consumed_date)}</Text>
                </View>

                {row.note ? <Text style={styles.note}>{row.note}</Text> : null}

                {hasTasting ? (
                  <TouchableOpacity
                    style={styles.tastingLink}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/wine/${row.wine_id}`)}
                  >
                    <Ionicons name="reader-outline" size={13} color={colors.gold.shimmer} />
                    <Text style={styles.tastingLinkText}>View tasting note</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.gold.shimmer} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  heading: { ...typography.body.caption, color: colors.gold.shimmer, marginBottom: spacing.sm },
  empty: { ...typography.body.small, color: colors.neutral.pewter, lineHeight: 19 },

  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutral.linen },
  iconWrap: { width: 24, alignItems: 'center', paddingTop: 1 },
  rowBody: { flex: 1 },

  rowTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  reason: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  qty: { ...typography.body.small, color: colors.neutral.graphite },
  date: { ...typography.body.small, color: colors.neutral.pewter, marginLeft: 'auto' },

  note: { ...typography.body.small, color: colors.neutral.graphite, marginTop: 2, lineHeight: 19 },

  tastingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  tastingLinkText: { ...typography.body.small, color: colors.gold.shimmer, fontWeight: '600' },
});
