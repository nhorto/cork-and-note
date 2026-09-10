// app/forgot-password.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles } from '../styles/ThemeProvider';
import { AuthContext } from './_layout';


export default function ForgotPasswordScreen() {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    // Basic validation
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      // Same normalisation as sign-up / login: the address has to match the one
      // stored on the account or the reset email goes nowhere.
      const { error } = await resetPassword(email.trim().toLowerCase());

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setResetSent(true);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 4 }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.neutral.ink} />
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        {resetSent ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color={colors.status.success} />
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              We’ve sent password reset instructions to {email}
            </Text>
            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.backToLoginText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/cork_and_note_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Forgot password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we’ll send you instructions to reset your password.
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color={colors.primary.ink} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                placeholderTextColor={colors.neutral.placeholder}
              />
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.resetButtonText}>Send reset link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { borderRadius, colors, spacing, typography } = theme;
const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  backButton: {
    // `top` comes from the safe-area inset inline — a hardcoded value lands
    // under the notch on some devices and stops receiving taps entirely.
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    // 44pt minimum touch target (launch plan §3.3)
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 100,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 150,
    height: 150,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '600',
    color: colors.neutral.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.surface,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral.ink,
  },
  resetButton: {
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  resetButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cancelButton: {
    padding: spacing.sm,
  },
  cancelText: {
    color: colors.neutral.inkTertiary,
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  successTitle: {
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '600',
    color: colors.neutral.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 15,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  backToLoginButton: {
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  backToLoginText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
return { colors, styles };
});
