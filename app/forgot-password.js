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
import { borderRadius, colors, spacing, typography } from '../styles/theme';
import { AuthContext } from './_layout';

const SERIF = typography.fonts.serif;

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
      const { error } = await resetPassword(email);

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
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.neutral.charcoal} />
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
              <Ionicons name="mail" size={20} color={colors.primary.burgundy} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={colors.neutral.silver}
              />
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral.cream} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
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
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral.graphite,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.parchment,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral.charcoal,
  },
  resetButton: {
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  resetButtonText: {
    color: colors.neutral.cream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cancelButton: {
    padding: spacing.sm,
  },
  cancelText: {
    color: colors.neutral.pewter,
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
    color: colors.neutral.charcoal,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 15,
    color: colors.neutral.graphite,
    textAlign: 'center',
    marginBottom: 30,
  },
  backToLoginButton: {
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  backToLoginText: {
    color: colors.neutral.cream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
