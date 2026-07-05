// app/login.js
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Basic validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert('Error', error.message);
      }
      // On success, AuthContext + index.js handle navigation automatically.
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logoImageWrapper}>
            <Image
              source={require('../assets/images/cork_and_note_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Welcome to Cork &amp; Note</Text>
          <Text style={styles.tagline}>Taste, note, and remember every wine</Text>
        </View>

        <View style={styles.formContainer}>
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

          <Link href="/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.neutral.cream} />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don’t have an account? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Sign Up</Text>
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
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  logoImage: {
    width: 220,
    height: 130,
  },
  appName: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '600',
    color: colors.primary.burgundy,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 15,
    color: colors.neutral.graphite,
    textAlign: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotPasswordText: {
    color: colors.primary.burgundy,
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  loginButtonText: {
    color: colors.neutral.cream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: colors.neutral.graphite,
  },
  registerLink: {
    fontSize: 14,
    color: colors.primary.burgundy,
    fontWeight: '700',
  },
});
