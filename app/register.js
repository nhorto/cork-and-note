// app/register.js
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '../styles/theme';
import { AuthContext } from './_layout';

const SERIF = typography.fonts.serif;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password validation function
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    const errors = [];

    if (password.length < minLength) {
      errors.push(`at least ${minLength} characters`);
    }
    if (!hasUpperCase) {
      errors.push('one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('one number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Get password requirements status for display
  const getPasswordRequirements = () => {
    const requirements = [
      { text: 'At least 8 characters', met: password.length >= 8 },
      { text: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { text: 'One lowercase letter', met: /[a-z]/.test(password) },
      { text: 'One number', met: /\d/.test(password) },
    ];

    return requirements;
  };

  const handleRegister = async () => {
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Password Requirements Not Met',
        `Your password must have:\n• ${passwordValidation.errors.join('\n• ')}`
      );
      return;
    }

    setIsLoading(true);

    try {
      const { error, data } = await signUp(email, password, name);

      if (error) {
        if (error.message.includes('User already registered')) {
          Alert.alert(
            'Account Already Exists',
            'An account with this email already exists. Would you like to sign in instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => router.replace('/login') }
            ]
          );
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
          // With email confirmation enabled, Supabase returns NO error when the
          // email is already registered — the giveaway is an empty identities
          // array on the returned user.
          if (data?.user && (data.user.identities?.length ?? 0) === 0) {
            Alert.alert(
              'Account Already Exists',
              'An account with this email already exists. Would you like to sign in instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign In', onPress: () => router.replace('/login') }
              ]
            );
          } else if (data.session && data.user) {
            // AuthContext + index.js handle navigation automatically.
          } else {
            // If for some reason they need to confirm email or sign in manually
            Alert.alert(
              'Account Created!',
              'Your account has been successfully created. You can now sign in.',
              [
                { text: 'OK', onPress: () => router.replace('/login') }
              ]
            );
          }
        }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordRequirements = getPasswordRequirements();
  const showRequirements = password.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.neutral.charcoal} />
        </TouchableOpacity>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Cork &amp; Note to track your wine adventures</Text>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color={colors.primary.burgundy} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.neutral.silver}
            />
          </View>

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

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={colors.primary.burgundy} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={colors.neutral.silver}
            />
            <TouchableOpacity
              style={styles.visibilityIcon}
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.primary.burgundy}
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements Display */}
          {showRequirements && (
            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password requirements</Text>
              {passwordRequirements.map((req, index) => (
                <View key={index} style={styles.requirementRow}>
                  <Ionicons
                    name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={req.met ? colors.status.success : colors.neutral.silver}
                  />
                  <Text style={[
                    styles.requirementText,
                    req.met ? styles.requirementMet : styles.requirementNotMet
                  ]}>
                    {req.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={colors.primary.burgundy} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={colors.neutral.silver}
            />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.neutral.cream} />
            ) : (
              <Text style={styles.registerButtonText}>Sign up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral.graphite,
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
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
  visibilityIcon: {
    padding: 8,
  },
  passwordRequirements: {
    backgroundColor: colors.neutral.parchment,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  requirementText: {
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  requirementMet: {
    color: colors.status.success,
  },
  requirementNotMet: {
    color: colors.neutral.pewter,
  },
  registerButton: {
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  registerButtonText: {
    color: colors.neutral.cream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: colors.neutral.graphite,
  },
  loginLink: {
    fontSize: 14,
    color: colors.primary.burgundy,
    fontWeight: '700',
  },
});
