// components/CompositionBars.js - lightweight insight visuals (Epic #6 · R6 · #56)
//
// Two tiny, dependency-free visual primitives for the cellar insights dashboard,
// built the same way the rest of the app draws data (plain View widths + theme
// colors — see components/MaturityTimeline.js). No chart library.
//
//   <CompositionBars rows={[{ key, label, count, pct }]} /> — a ranked list of
//     horizontal bars for a composition dimension (type / region / vintage…).
//   <TrendBars series={[{ key, label, count }]} max={n} /> — a row of vertical
//     mini-bars for the recent-months consumption trend.
//
// Both degrade gracefully (empty rows / all-zero series render a gentle line).
import { StyleSheet, Text, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

// A small, on-theme palette cycled across bars so a breakdown reads at a glance
// without shouting. Burgundy leads (the most-common bucket), then warm golds and
// muted neutrals — calm, not a rainbow.
const BAR_COLORS = [
  colors.primary.burgundy,
  colors.gold.rich,
  colors.primary.wine,
  colors.gold.shimmer,
  colors.status.wishlist,
  colors.neutral.silver,
];

// Round a 0–100 pct for display without ever showing a misleading "0%" for a
// non-empty bucket.
function pctLabel(pct) {
  if (pct <= 0) return '0%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

// Ranked horizontal bars. `max` caps how many rows show before the rest collapse
// into a single "+N more" line so a sprawling dimension stays glanceable.
export function CompositionBars({ rows, max = 5 }) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return <Text style={styles.emptyLine}>Nothing to show yet.</Text>;
  }

  const shown = list.slice(0, max);
  const restCount = list.length - shown.length;
  // Scale bar widths against the top bucket so the leader fills the track and the
  // rest read proportionally (more legible than raw pct for long-tailed data).
  const top = Math.max(1, ...shown.map((r) => r.count));

  return (
    <View>
      {shown.map((row, i) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={styles.rowCount}>
              {row.count} · {pctLabel(row.pct)}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(4, (row.count / top) * 100)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                },
              ]}
            />
          </View>
        </View>
      ))}
      {restCount > 0 ? (
        <Text style={styles.moreLine}>
          +{restCount} more {restCount === 1 ? 'category' : 'categories'}
        </Text>
      ) : null}
    </View>
  );
}

// Vertical mini-bars for the consumption trend. Heights scale to `max`; a zero
// month shows a faint baseline tick so the month still registers on the axis.
export function TrendBars({ series, max }) {
  const list = Array.isArray(series) ? series : [];
  if (list.length === 0) {
    return <Text style={styles.emptyLine}>No consumption history yet.</Text>;
  }
  const peak = Math.max(1, max || 0);

  return (
    <View style={styles.trend}>
      {list.map((point) => {
        const ratio = point.count / peak;
        return (
          <View key={point.key} style={styles.trendCol}>
            <Text style={styles.trendCount}>{point.count > 0 ? point.count : ''}</Text>
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBar,
                  point.count > 0
                    ? { height: `${Math.max(8, ratio * 100)}%` }
                    : styles.trendBarEmpty,
                ]}
              />
            </View>
            <Text style={styles.trendLabel} numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Composition bars
  row: { marginBottom: spacing.md },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  rowLabel: { ...typography.body.regular, color: colors.neutral.charcoal, flex: 1 },
  rowCount: { ...typography.body.small, color: colors.neutral.pewter },
  track: {
    height: 8,
    borderRadius: borderRadius.round,
    backgroundColor: colors.neutral.linen,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: borderRadius.round },
  moreLine: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  // Trend bars
  trend: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 120,
  },
  trendCol: { flex: 1, alignItems: 'center', height: '100%' },
  trendCount: {
    ...typography.body.small,
    color: colors.neutral.graphite,
    fontWeight: '600',
    marginBottom: spacing.xs,
    minHeight: 16,
  },
  trendBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  trendBar: {
    width: '70%',
    minHeight: 4,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
    backgroundColor: colors.primary.burgundy,
  },
  trendBarEmpty: {
    height: 3,
    backgroundColor: colors.neutral.stone,
    borderRadius: borderRadius.round,
  },
  trendLabel: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontSize: 11,
    marginTop: spacing.xs,
  },

  // Shared empty line
  emptyLine: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },
});

export default CompositionBars;
