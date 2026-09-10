// components/AgeGate.js
// One-time legal-drinking-age attestation, shown before anything else on a
// fresh install (app/_layout.js). The Terms and Privacy Policy both require
// legal drinking age, but until this gate nothing ever *asked* — prose in a
// document is not an attestation. Rendered as an opaque overlay above the
// navigator so it covers every screen for signed-in and signed-out users
// alike, without touching the auth/navigation guards.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function AgeGate({ onConfirm }) {
  const { colors, styles } = useScreenTheme();
  const [declined, setDeclined] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Ionicons name="wine" size={32} color={colors.primary.ink} />
        </View>

        {declined ? (
          <>
            <Text style={styles.title}>See you later</Text>
            <Text style={styles.subtitle}>
              Cork &amp; Note is a wine journal, so it&apos;s only for people of
              legal drinking age. Come back when you&apos;re of age.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setDeclined(false)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Before you come in</Text>
            <Text style={styles.subtitle}>
              Cork &amp; Note is a journal for wine tastings. Are you of legal
              drinking age where you live?
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Yes, I am</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setDeclined(true)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>No, not yet</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { borderRadius, colors, spacing, typography } = theme;

  const styles = StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.neutral.bg,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      maxWidth: 420,
      width: '100%',
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.neutral.surface,
      borderWidth: 2,
      borderColor: colors.accent.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading.h2,
      color: colors.neutral.ink,
      fontFamily: typography.fonts.serif,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body.regular,
      color: colors.neutral.inkSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    primaryButton: {
      backgroundColor: colors.primary.base,
      borderRadius: borderRadius.md,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      marginBottom: spacing.md,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    secondaryButton: {
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    secondaryButtonText: {
      ...typography.body.regular,
      color: colors.neutral.inkSecondary,
      fontWeight: '600',
    },
  });
  return { colors, styles };
});
