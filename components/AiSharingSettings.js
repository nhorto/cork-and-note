import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { getAiConsent, onAiConsentChange, requestAiConsent, setAiConsent } from '../lib/aiConsent';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function AiSharingSettings({ userId }) {
  const { colors, styles } = useScreenTheme();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setEnabled(false);
    getAiConsent(userId).then(value => { if (active) setEnabled(value === true); }).catch(() => {});
    const unsubscribe = onAiConsentChange((id, value) => { if (id === userId) setEnabled(value); });
    return () => { active = false; unsubscribe(); };
  }, [userId]);
  const toggle = async (value) => {
    setBusy(true);
    try {
      if (value) await requestAiConsent(userId, { promptAgain: true });
      else await setAiConsent(userId, false);
    } catch {
      Alert.alert('Could not save permission', 'Please try again.');
    } finally { setBusy(false); }
  };
  return <View style={styles.row}>
    <View style={styles.copy}>
      <Text style={styles.title}>AI sharing</Text>
      <Text style={styles.description}>Allow messages, scanned or attached photos, and relevant journal details to go to Anthropic for AI suggestions. Pro web searches share queries with its search provider. Turning this off stops new AI requests on this device; it does not remove previously shared data.</Text>
    </View>
    <Switch accessibilityLabel="Allow AI sharing" value={enabled} onValueChange={toggle} disabled={busy || !userId}
      trackColor={{ false: colors.neutral.border, true: colors.primary.base }} thumbColor={colors.onPrimary} />
  </View>;
}

const useScreenTheme = createThemedStyles(({ colors, spacing }) => ({ colors, styles: {
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  copy: { flex: 1 }, title: { fontSize: 16, fontWeight: '600', color: colors.neutral.ink },
  description: { fontSize: 13, lineHeight: 19, color: colors.neutral.inkSecondary, marginTop: spacing.xs },
} }));
