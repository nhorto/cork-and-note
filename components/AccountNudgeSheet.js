// components/AccountNudgeSheet.js — shown ONCE, after a guest's first saved
// tasting (epic #316, owner decision 2026-09-21: the nudge lands right after
// they have made something worth keeping, never on launch).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function AccountNudgeSheet({ visible, onClose }) {
  const { colors, styles } = useScreenTheme();
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Not now" />
        <View style={styles.sheet}>
          <View style={styles.icon}>
            <Ionicons name="wine" size={26} color={colors.primary.ink} />
          </View>
          <Text style={styles.title}>Saved to this phone</Text>
          <Text style={styles.body}>
            Create a free account and your journal follows you to any phone. It
            takes a minute, and nothing you have logged is lost.
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => { onClose(); router.push('/register'); }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button">
            <Text style={styles.secondaryText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
const { borderRadius, colors, spacing, typography } = theme;
const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay.dark },
  sheet: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 22,
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  secondary: { paddingVertical: 12 },
  secondaryText: { color: colors.neutral.inkSecondary, fontSize: 15, fontWeight: '600' },
});
return { colors, styles };
});
