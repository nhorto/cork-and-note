// components/GuestAccountCard.js — the quiet reminder on Home that a guest's
// journal lives on this phone only (epic #316, App Review 5.1.1).
//
// Deliberately not a wall and not a modal: one dismissible card in the feed,
// with the tasting count once there is one, because "3 tastings" is a far
// better reason to make an account than a generic ask. Dismissal is
// remembered per install.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dismissGuestCard, isGuestCardDismissed } from '../lib/guest';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function GuestAccountCard({ tastings = 0 }) {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();
  // null until storage answers, so a dismissed card never flashes in.
  const [hidden, setHidden] = useState(null);

  useEffect(() => {
    let active = true;
    isGuestCardDismissed().then((v) => { if (active) setHidden(v); });
    return () => { active = false; };
  }, []);

  if (hidden !== false) return null;

  const body =
    tastings > 0
      ? `Your ${tastings === 1 ? 'tasting is' : `${tastings} tastings are`} saved on this phone only. Create a free account to keep them on any phone.`
      : 'Anything you log is saved on this phone only. Create a free account and your journal follows you to any phone.';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.primary.ink} />
        </View>
        <Text style={styles.body}>{body}</Text>
        <TouchableOpacity
          onPress={() => { setHidden(true); dismissGuestCard(); }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={colors.neutral.inkTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => router.push('/register')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => router.push('/login')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
const { borderRadius, colors, spacing } = theme;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accent.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icon: { paddingTop: 1 },
  body: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.neutral.ink },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primary: {
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  primaryText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  secondary: {
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  secondaryText: { color: colors.primary.ink, fontSize: 14, fontWeight: '600' },
});
return { colors, styles };
});
