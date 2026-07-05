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
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// Pull recovery credentials out of the deep link. Implicit-flow links carry
// `#access_token=…&refresh_token=…&type=recovery`; PKCE links carry `?code=…`.
function parseRecoveryParams(url) {
  if (!url) return null;
  try {
    const fragment = url.split('#')[1];
    if (fragment) {
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) return { access_token, refresh_token };
    }
    const { queryParams } = Linking.parse(url);
    if (queryParams?.code) return { code: String(queryParams.code) };
  } catch {
    // fall through — treated as "no credentials in this URL"
  }
  return null;
}

export default function ResetPasswordScreen() {
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
  const exchangedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const establishRecoverySession = async () => {
      // Already signed in (e.g. supabase handled the PASSWORD_RECOVERY event,
      // or the exchange ran for a previous URL value) → straight to the form.
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setStatus('ready');
        return;
      }

      const creds = parseRecoveryParams(url);
      if (!creds) {
        // No usable credentials in the link and no session — expired or malformed.
        if (url !== null) setStatus('invalid');
        return;
      }
      if (exchangedRef.current) return;
      exchangedRef.current = true;

      const { error } = creds.code
        ? await supabase.auth.exchangeCodeForSession(creds.code)
        : await supabase.auth.setSession(creds);

      if (!active) return;
      setStatus(error ? 'invalid' : 'ready');
    };

    establishRecoverySession();
    return () => { active = false; };
  }, [url]);

  const handleSubmit = async () => {
    setFormError(null);
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
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
        <ActivityIndicator size="large" color={colors.primary.burgundy} />
        <Text style={styles.checkingText}>Opening your reset link…</Text>
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="time-outline" size={48} color={colors.primary.burgundy} />
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
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary.burgundy} />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={colors.neutral.silver}
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
              color={colors.primary.burgundy}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary.burgundy} />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.neutral.silver}
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
            <ActivityIndicator color={colors.neutral.cream} />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
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
    color: colors.neutral.graphite,
    marginTop: spacing.md,
  },
  title: {
    ...typography.heading.h1,
    fontFamily: SERIF,
    color: colors.neutral.charcoal,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body.regular,
    color: colors.neutral.graphite,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    padding: 0,
  },
  errorText: {
    ...typography.body.small,
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary.burgundy,
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
    color: colors.neutral.cream,
  },
});
