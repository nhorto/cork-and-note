// components/TripTimeline.js: the mapless itinerary for "Plan a wine day".
//
// Renders buildSchedule() output as a vertical timeline. The same component
// draws the free user's fictional sample (app/trips/new.js) and the real,
// editable day (app/trips/[id].js); the detail screen passes `renderStopExtras`
// to hang hours, buttons and visit-length chips under each stop.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { formatClock } from '../lib/tripSchedule';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function TripTimeline({
  schedule,
  stops = [],
  startLabel,
  endTime,
  renderStopExtras,
}) {
  const { colors, styles } = useScreenTheme();
  if (!schedule?.items) return null;

  return (
    <View>
      {schedule.items.map((item, position) => {
        if (item.kind === 'leave') {
          return (
            <Row key={`leave-${position}`} icon="home-outline" color={colors.neutral.inkSecondary} styles={styles}>
              <Text style={styles.rowTime}>{formatClock(item.time)}</Text>
              <Text style={styles.rowTitle}>Leave {startLabel || 'your starting place'}</Text>
            </Row>
          );
        }
        if (item.kind === 'drive') {
          return (
            <Row key={`drive-${position}`} icon="car-outline" color={colors.neutral.inkTertiary} styles={styles} muted>
              <Text style={styles.driveText}>
                {item.unknown
                  ? 'Drive time unknown'
                  : `Drive ${item.minutes} min${item.toIndex === null ? ' back' : ''}`}
              </Text>
            </Row>
          );
        }
        if (item.kind === 'stop') {
          const stop = stops[item.index];
          return (
            <Row key={`stop-${position}`} icon="wine-outline" color={colors.primary.ink} styles={styles} strong>
              <Text style={styles.rowTime}>
                {formatClock(item.arrive)} to {formatClock(item.depart)}
              </Text>
              <Text style={styles.stopTitle}>
                {item.index + 1}. {stop?.name || 'Winery'}
              </Text>
              {stop?.city || stop?.state ? (
                <Text style={styles.rowMeta}>{[stop.city, stop.state].filter(Boolean).join(', ')}</Text>
              ) : null}
              <Text style={styles.rowMeta}>Allow {item.visitMinutes} min</Text>
              {renderStopExtras ? renderStopExtras(item.index, item) : null}
            </Row>
          );
        }
        if (item.kind === 'lunch') {
          return (
            <Row key={`lunch-${position}`} icon="restaurant-outline" color={colors.accent.strong} styles={styles}>
              <Text style={styles.rowTime}>
                {formatClock(item.start)} to {formatClock(item.end)}
              </Text>
              <Text style={styles.rowTitle}>Lunch</Text>
            </Row>
          );
        }
        if (item.kind === 'finish') {
          const late = schedule.overrunMinutes > 0;
          return (
            <Row
              key={`finish-${position}`}
              icon={late ? 'alert-circle-outline' : 'flag-outline'}
              color={late ? colors.status.error : colors.status.success}
              styles={styles}
              last
            >
              <Text style={styles.rowTime}>{formatClock(item.time)}</Text>
              <Text style={styles.rowTitle}>
                {late ? 'This runs past your finish time' : 'Done for the day'}
              </Text>
              {late && endTime ? (
                <Text style={styles.rowMeta}>
                  You wanted to finish by {formatClock(endTime)}, about {schedule.overrunMinutes} min earlier.
                </Text>
              ) : null}
            </Row>
          );
        }
        return null;
      })}
    </View>
  );
}

function Row({ icon, color, styles, children, muted, strong, last }) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, strong && styles.dotStrong, { borderColor: color }]}>
          <Ionicons name={icon} size={strong ? 16 : 13} color={color} />
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={[styles.body, muted && styles.bodyMuted, last && styles.bodyLast]}>{children}</View>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing } = theme;
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { width: 36, alignItems: 'center' },
    dot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      backgroundColor: colors.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotStrong: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
    line: { flex: 1, width: 2, backgroundColor: colors.neutral.divider, marginVertical: 2 },
    body: { flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.lg },
    bodyMuted: { paddingBottom: spacing.md, justifyContent: 'center' },
    bodyLast: { paddingBottom: spacing.sm },
    rowTime: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginBottom: 2 },
    rowTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '500' },
    stopTitle: { ...typography.heading.h3, color: colors.neutral.ink },
    rowMeta: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: 2 },
    driveText: { ...typography.body.small, color: colors.neutral.inkTertiary, fontStyle: 'italic' },
  });
  return { colors, styles };
});
