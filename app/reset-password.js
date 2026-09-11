// app/reset-password.js — completes the password-recovery deep link.
//
// The reset email links to `corkandnote://reset-password` with the recovery
// credentials attached (implicit flow → tokens in the URL fragment; a PKCE
// `?code=` is handled too, defensively). The supabase client is configured with
// detectSessionInUrl: false, so this screen exchanges the credentials itself,
// then lets the user set a new password via supabase.auth.updateUser.
//
// The root layout's navigation guard deliberately ignores this route: the user
// arrives unauthenticated and becomes authenticated mid-screen once the
// recovery session is set — neither state should navigate them away.
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { validatePassword } from '../lib/password';
import { establishPasswordRecovery } from '../lib/passwordRecovery';
import { createThemedStyles } from '../styles/ThemeProvider';


const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function ResetPasswordScreen() {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();
  const url = Linking.useURL();

  // 'checking' → validating the link | 'ready' → show the form
  // 'invalid'  → link expired/bad    | 'done' → password updated
  const [status, setStatus] = useState('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const exchangeRef = useRef(null);

  useEffect(() => {
    let active = true;

    const establishRecoverySession = async () => {
      try {
        const recoveryUrl = url ?? await Linking.getInitialURL();
        if (!active) return;
        setStatus('checking');
        // Reuse the exchange if the hook re-renders with the same one-time link.
        if (!exchangeRef.current || exchangeRef.current.url !== recoveryUrl) {
          exchangeRef.current = { url: recoveryUrl, promise: establishPasswordRecovery(recoveryUrl, supabase.auth) };
        }
        await exchangeRef.current.promise;
        if (active) setStatus('ready');
      } catch {
        if (active) setStatus('invalid');
      }
    };

    establishRecoverySession();
    return () => { active = false; };
  }, [url]);

  const handleSubmit = async () => {
    setFormError(null);
    // Same rule as sign-up and "change password" (lib/password.js): a reset
    // must not be a back door to a password the other screens would refuse.
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setFormError(`Password must have ${validation.errors.join(', ')}.`);
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
        return;
      }
      setStatus('done');
      Alert.alert('Password updated', 'You are signed in with your new password.');
      router.replace('/(tabs)/home');
    } catch (e) {
      setFormError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'checking') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary.ink} />
        <Text style={styles.checkingText}>Opening your reset link…</Text>
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="time-outline" size={48} color={colors.primary.ink} />
        <Text style={styles.title}>Link expired</Text>
        <Text style={styles.subtitle}>
          This reset link is invalid or has expired. Request a new one and try again.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/forgot-password')}
        >
          <Text style={styles.buttonText}>Request a new link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>
          Enter a new password for your Cork &amp; Note account.
        </Text>

        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary.ink} />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={colors.neutral.placeholder}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.primary.ink}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary.ink} />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.neutral.placeholder}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
          />
        </View>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={saving || status === 'done'}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  checkingText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
    marginTop: spacing.md,
  },
  title: {
    ...typography.heading.h1,
    fontFamily: SERIF,
    color: colors.neutral.ink,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.ink,
    padding: 0,
  },
  errorText: {
    ...typography.body.small,
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
return { colors, styles };
});
