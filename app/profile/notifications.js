// app/profile/notifications.js — Cellar reminder settings (Epic #6, R7, issue #57)
//
// Restrained-by-design controls for the drink-soon / past-peak push reminders.
// Push defaults OFF: the in-app Home "Ready to Drink" strip (#54) is the default
// surface. This screen lets a wine lover opt in and tune *what* and *when*.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  checkAndReschedule,
  disablePush,
  enablePush,
  getPermissionStatus,
  getPrefs,
  sendTestNotification,
  setPrefs,
} from '../../lib/notifications';
import Chip from '../../components/Chip';
import ScreenHeader from '../../components/ScreenHeader';
import { createThemedStyles } from '../../styles/ThemeProvider';


// Early-evening delivery hour options (local time). Restrained to the window
// when a wine lover is actually deciding what to open.
const HOUR_OPTIONS = [
  { hour: 17, label: '5:00 PM' },
  { hour: 18, label: '6:00 PM' },
  { hour: 19, label: '7:00 PM' },
  { hour: 20, label: '8:00 PM' },
];

export default function NotificationsScreen() {
  const { colors, spacing, styles } = useScreenTheme();

  const [loading, setLoading] = useState(true);
  const [prefs, setLocalPrefs] = useState(null);
  const [permission, setPermission] = useState('undetermined');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, perm] = await Promise.all([getPrefs(), getPermissionStatus()]);
    setLocalPrefs(p);
    setPermission(perm);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unavailable = permission === 'unavailable';

  const handleMasterToggle = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      if (value) {
        const granted = await enablePush();
        const perm = await getPermissionStatus();
        setPermission(perm);
        setLocalPrefs(await getPrefs());
        if (!granted) {
          Alert.alert(
            'Notifications are off',
            'To get gentle cellar reminders, enable notifications for Cork & Note in your device Settings, then try again.',
          );
        }
      } else {
        await disablePush();
        setLocalPrefs(await getPrefs());
      }
    } finally {
      setBusy(false);
    }
  };

  // Persist a partial pref change and re-arm the next reminder.
  const updatePref = async (patch) => {
    const next = { ...prefs, ...patch };
    setLocalPrefs(next);
    await setPrefs(next);
    if (next.enabled) await checkAndReschedule();
  };

  const handleTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await sendTestNotification();
      if (!ok) {
        Alert.alert(
          'Could not send a test',
          'Enable notifications for Cork & Note in your device Settings to preview a reminder.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Cellar reminders" />

      {loading || !prefs ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary.ink} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Intro */}
          <View style={styles.introCard}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.accent.base}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={styles.introText}>
              A calm, occasional nudge when bottles enter their peak — batched into
              one early-evening reminder, never one per bottle. Your &ldquo;Ready to
              Drink&rdquo; strip on Home always shows this too.
            </Text>
          </View>

          {unavailable && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>
                Push notifications aren&apos;t available on this device or build.
                Your preferences are saved and will apply once notifications are
                supported.
              </Text>
            </View>
          )}

          {/* Master toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PUSH REMINDERS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Enable reminders</Text>
                  <Text style={styles.rowDescription}>
                    Off by default. We&apos;ll only ping you for genuine peak
                    milestones.
                  </Text>
                </View>
                <Switch
                  value={!!prefs.enabled}
                  onValueChange={handleMasterToggle}
                  disabled={busy || unavailable}
                  trackColor={{ false: colors.neutral.border, true: colors.primary.base }}
                  thumbColor={colors.onPrimary}
                />
              </View>
            </View>
          </View>

          {/* What to notify */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHAT TO NOTIFY</Text>
            <View style={styles.card}>
              <View style={[styles.row, styles.rowBorder]}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Entering peak</Text>
                  <Text style={styles.rowDescription}>
                    &ldquo;3 bottles just entered their peak.&rdquo;
                  </Text>
                </View>
                <Switch
                  value={!!prefs.notifyPeakEntry}
                  onValueChange={(v) => updatePref({ notifyPeakEntry: v })}
                  disabled={!prefs.enabled || busy || unavailable}
                  trackColor={{ false: colors.neutral.border, true: colors.primary.base }}
                  thumbColor={colors.onPrimary}
                />
              </View>
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Past peak</Text>
                  <Text style={styles.rowDescription}>
                    An occasional reminder when a bottle is slipping past its best.
                  </Text>
                </View>
                <Switch
                  value={!!prefs.notifyPastPeak}
                  onValueChange={(v) => updatePref({ notifyPastPeak: v })}
                  disabled={!prefs.enabled || busy || unavailable}
                  trackColor={{ false: colors.neutral.border, true: colors.primary.base }}
                  thumbColor={colors.onPrimary}
                />
              </View>
            </View>
          </View>

          {/* Delivery time */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DELIVERY TIME</Text>
            <Text style={styles.sectionHint}>
              Early evening, in your local time — when it&apos;s time to choose a
              bottle.
            </Text>
            <View style={styles.card}>
              <View style={styles.chipRow}>
                {HOUR_OPTIONS.map((opt) => {
                  const active = prefs.hour === opt.hour;
                  const disabled = !prefs.enabled || busy || unavailable;
                  return (
                    <Chip
                      key={opt.hour}
                      label={opt.label}
                      selected={active}
                      disabled={disabled}
                      onPress={() => updatePref({ hour: opt.hour, minute: 0 })}
                    />
                  );
                })}
              </View>
            </View>
          </View>

          {/* Test */}
          {!unavailable && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.testButton, (busy || !prefs.enabled) && styles.testButtonDisabled]}
                onPress={handleTest}
                disabled={busy || !prefs.enabled}
                activeOpacity={0.7}
              >
                <Ionicons name="paper-plane-outline" size={18} color={colors.primary.ink} />
                <Text style={styles.testButtonText}>Send a test reminder</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.footnote}>
            Restraint is the point: reminders are event-driven and batched, so you
            hear from us rarely — and only about wine worth opening.
          </Text>

          {Platform.OS === 'ios' && <View style={{ height: spacing.xl }} />}
        </ScrollView>
      )}
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  introCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  introText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
  },

  noticeCard: {
    backgroundColor: colors.accent.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: {
    ...typography.body.small,
    color: colors.neutral.inkSecondary,
  },

  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowTitle: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '500',
    marginBottom: 2,
  },
  rowDescription: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.base,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    ...typography.body.regular,
    color: colors.primary.ink,
    fontWeight: '500',
  },

  footnote: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
return { colors, spacing, styles };
});
