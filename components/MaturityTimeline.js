// components/MaturityTimeline.js — readable maturity timeline (Epic #6 · R4 · #54)
//
// A horizontal open → peak → decline bar for a bottle's drink window, with a
// "now" marker and a plain-language caption ("Peak now", "3 years to peak",
// "Past peak"). The window comes from drink_from / drink_by (years); "peak" is a
// heuristic (~2/3 into the window) — there is NO peak column, nothing is stored.
//
// Degrades gracefully: with no window set it shows a gentle prompt that links to
// the editor (via onAddWindow) so the user can add — or AI-seed — a window.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { drinkWindowMeta, drinkWindowStatus, peakYear } from '../lib/cellar';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

// Clamp a 0–1 fraction so the marker never escapes the track.
const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Build the caption describing where "now" sits relative to peak / window.
function buildCaption(now, from, by, peak) {
  if (now < from) {
    const yrs = from - now;
    return `Opens in ${yrs} year${yrs === 1 ? '' : 's'} (${from})`;
  }
  if (now > by) {
    const yrs = now - by;
    return `Past peak — window closed ${yrs} year${yrs === 1 ? '' : 's'} ago (${by})`;
  }
  if (peak != null) {
    if (now < peak) {
      const yrs = peak - now;
      return `${yrs} year${yrs === 1 ? '' : 's'} to peak (~${peak})`;
    }
    if (now === peak) return `Peak now (~${peak})`;
    // Past peak but still inside the window → in its drink-soon stretch.
    return `Just past peak — drink soon (window ends ${by})`;
  }
  return `In its drinking window (${from}–${by})`;
}

export default function MaturityTimeline({ drinkFrom, drinkBy, onAddWindow }) {
  const from = drinkFrom != null && drinkFrom !== '' ? Number(drinkFrom) : null;
  const by = drinkBy != null && drinkBy !== '' ? Number(drinkBy) : null;
  const hasWindow = Number.isFinite(from) && Number.isFinite(by) && by >= from;

  // ── No window set → prompt to add / AI-seed one ──────────────────────────
  if (!hasWindow) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>MATURITY</Text>
        <View style={styles.emptyRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.neutral.pewter} />
          <Text style={styles.emptyText}>
            No drink window set yet.
            {onAddWindow ? ' Add one — or let the sommelier suggest it.' : ''}
          </Text>
        </View>
        {onAddWindow ? (
          <Text style={styles.addLink} onPress={onAddWindow}>
            Add a window
          </Text>
        ) : null}
      </View>
    );
  }

  const now = new Date().getFullYear();
  const peak = peakYear(from, by);
  const span = Math.max(1, by - from);
  // Fraction positions along the track.
  const peakPct = peak != null ? clamp01((peak - from) / span) : null;
  const nowPct = clamp01((now - from) / span);
  const nowInWindow = now >= from && now <= by;

  const status = drinkWindowStatus(from, by, now);
  const meta = drinkWindowMeta(status);
  const caption = buildCaption(now, from, by, peak);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>MATURITY</Text>
        <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.statusBadgeText}>{meta.label}</Text>
        </View>
      </View>

      {/* Track: open → peak → decline */}
      <View style={styles.track}>
        {/* Filled portion up to peak = "maturing", after peak = "declining" */}
        {peakPct != null && (
          <>
            <View style={[styles.fill, styles.fillRise, { width: `${peakPct * 100}%` }]} />
            <View
              style={[
                styles.fill,
                styles.fillFall,
                { left: `${peakPct * 100}%`, width: `${(1 - peakPct) * 100}%` },
              ]}
            />
            {/* Peak marker */}
            <View style={[styles.peakMark, { left: `${peakPct * 100}%` }]} />
          </>
        )}

        {/* "Now" marker — only drawn when within the window so it reads cleanly. */}
        {nowInWindow && (
          <View style={[styles.nowMark, { left: `${nowPct * 100}%` }]}>
            <View style={styles.nowDot} />
          </View>
        )}
      </View>

      {/* Year scale */}
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>{from}</Text>
        {peak != null ? <Text style={styles.scaleTextPeak}>peak ~{peak}</Text> : null}
        <Text style={styles.scaleText}>{by}</Text>
      </View>

      <Text style={styles.caption}>{caption}</Text>
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
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.body.caption, color: colors.gold.shimmer },

  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: { ...typography.body.caption, color: colors.neutral.cream, fontSize: 10 },

  // Track
  track: {
    height: 10,
    borderRadius: borderRadius.round,
    backgroundColor: colors.neutral.linen,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: 10,
  },
  fillRise: {
    left: 0,
    backgroundColor: colors.status.visited,
    borderTopLeftRadius: borderRadius.round,
    borderBottomLeftRadius: borderRadius.round,
  },
  fillFall: {
    backgroundColor: colors.gold.shimmer,
    borderTopRightRadius: borderRadius.round,
    borderBottomRightRadius: borderRadius.round,
  },
  peakMark: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 16,
    marginLeft: -1,
    backgroundColor: colors.neutral.charcoal,
  },
  nowMark: {
    position: 'absolute',
    top: -5,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.neutral.cream,
    borderWidth: 2,
    borderColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.burgundy,
  },

  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  scaleText: { ...typography.body.small, color: colors.neutral.pewter },
  scaleTextPeak: { ...typography.body.small, color: colors.neutral.graphite, fontWeight: '600' },

  caption: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    marginTop: spacing.sm,
    fontWeight: '500',
  },

  // Empty state
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyText: { ...typography.body.small, color: colors.neutral.pewter, flex: 1, lineHeight: 18 },
  addLink: {
    ...typography.body.small,
    color: colors.primary.burgundy,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
