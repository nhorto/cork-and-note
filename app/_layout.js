// app/_layout.js — root layout: auth context, Pro entitlements, navigation guard,
// cellar reminders
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AgeGate from '../components/AgeGate';
import ErrorBoundary from '../components/ErrorBoundary';
import OfflineBanner from '../components/OfflineBanner';
import { ProProvider } from '../components/ProProvider';
import { checkAndReschedule, setNotificationHandler } from '../lib/notifications';
import { isGuestUser, linkGuestAccount, signInFromGuest, startGuestSession } from '../lib/guest';
import { initializeMetaAppEvents } from '../lib/metaAppEvents';
import { supabase } from '../lib/supabase';
import { startUpdateWatcher } from '../lib/updates';
import { AppThemeProvider, useAppearance } from '../styles/ThemeProvider';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Register how foreground notifications are presented. Guarded internally: this
// is a no-op on web or when the native module / permission is absent, and never
// throws — so it's safe to run at module load.
setNotificationHandler();

// Auth context
export const AuthContext = createContext({
  signIn: () => {},
  signOut: () => {},
  signUp: () => {},
  resetPassword: () => {},
  changePassword: () => {},
  user: null,
  isLoading: true,
  session: null,
  isAuthenticated: false,
  // Guest mode (epic #316): true for an anonymous Supabase user.
  isGuest: false,
  continueAsGuest: () => {},
});

export default function RootLayout() {
  return <AppThemeProvider><AppRoot /></AppThemeProvider>;
}

function AppRoot() {
  const { theme, ready: themeReady } = useAppearance();
  const { colors, isDark } = theme;
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary.ink,
      background: colors.neutral.bg,
      card: colors.neutral.surface,
      text: colors.neutral.ink,
      border: colors.neutral.border,
      notification: colors.accent.base,
    },
  };
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // AGE GATE — one-time legal-drinking-age attestation per install, required
  // by the Terms ("You must be of legal drinking age…") for an alcohol app.
  // Covers signed-in AND signed-out users, which is why it lives here and not
  // on the register screen. 'loading' → keep the splash up, 'needed' → render
  // the gate over everything, 'ok' → attested (or unreadable storage next
  // launch will simply ask again — re-asking is the safe failure).
  const [ageStatus, setAgeStatus] = useState('loading');
  useEffect(() => {
    // Screenshot automation can't tap the gate (see the automation note
    // below); that build profile never ships, so skipping it is safe.
    if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1') {
      setAgeStatus('ok');
      return;
    }
    let mounted = true;
    AsyncStorage.getItem('cn_age_attested')
      .then((v) => { if (mounted) setAgeStatus(v === 'yes' ? 'ok' : 'needed'); })
      .catch(() => { if (mounted) setAgeStatus('needed'); });
    return () => { mounted = false; };
  }, []);
  const confirmAge = () => {
    setAgeStatus('ok');
    // Best-effort persist: a write failure just re-asks on the next launch.
    AsyncStorage.setItem('cn_age_attested', 'yes').catch(() => {});
  };

  // App-install attribution is configured only in builds that contain both
  // Meta SDK values. Wait until the age gate is out of the way so iOS never
  // stacks its tracking-permission sheet on top of Cork & Note's first-run
  // screen. The initializer is idempotent across re-renders.
  useEffect(() => {
    if (ageStatus !== 'ok') return;
    initializeMetaAppEvents();
  }, [ageStatus]);

  const router = useRouter();
  const segments = useSegments();

  // Derived state for cleaner checks
  const isAuthenticated = !!(user && session);
  // A guest is authenticated (every RLS policy is `to authenticated`, and an
  // anonymous user is), just without an identity of their own yet.
  const isGuest = isAuthenticated && isGuestUser(user);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (error) {
            console.error('Session check error:', error.message);
            setSession(null);
            setUser(null);
          } else if (session) {
            setSession(session);
            setUser(session.user);
          } else {
            // No session: a fresh install or a signed-out device. Guest mode
            // (epic #316, App Review 5.1.1): mint an anonymous Supabase user
            // so the app opens straight onto Home. Offline, this fails and
            // the guard shows the login screen, which offers a retry.
            const guest = await startGuestSession(supabase);
            if (!mounted) return;
            if (guest.error) {
              console.warn('Guest session failed:', guest.error.message);
              setSession(null);
              setUser(null);
            } else {
              setSession(guest.session);
              setUser(guest.user);
            }
          }

          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error.message);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsInitialized(true);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);

        // If this is a sign-in event, make sure loading is false
        if (event === 'SIGNED_IN' && session) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Navigation guard: keep unauthenticated users in the auth flow and move
  // authenticated users out of it.
  useEffect(() => {
    if (!loaded || !themeReady || !isInitialized || isLoading) return;

    // The password-recovery deep link manages its own navigation: the user
    // arrives unauthenticated (tokens still in the URL) and becomes
    // authenticated mid-screen once the recovery session is set — neither
    // state should yank them off the screen.
    if (segments[0] === 'reset-password') return;

    const inAuthFlow = ['login', 'register', 'forgot-password'].includes(segments[0]);
    const onIndexPage = segments.length === 0;

    if (isAuthenticated && !isGuest && (inAuthFlow || onIndexPage)) {
      // A real account on an auth screen or the index page → main app.
      // Landing here from the register screen means a fresh sign-up (or a
      // guest who just linked their account, whose is_anonymous flipped
      // while still on that screen): those get the Free/Pro choice first
      // (owner ask 2026-09-10), everyone else lands on Home.
      router.replace(segments[0] === 'register' ? '/choose-plan' : '/(tabs)/home');
    } else if (isGuest && onIndexPage) {
      // Guests go straight to Home too. They are NOT bounced off the auth
      // screens: that is how a guest creates or signs in to an account.
      router.replace('/(tabs)/home');
    } else if (!isAuthenticated && !inAuthFlow) {
      // No session at all (the guest sign-in failed, e.g. offline) → login,
      // which offers "Continue without an account" to retry.
      router.replace('/login');
    }
  }, [isAuthenticated, isGuest, isInitialized, isLoading, segments, loaded, themeReady, router]);

  // SCREENSHOT AUTOMATION — App Store listing capture.
  //
  // Compiled in ONLY when the `simulator` EAS build profile sets
  // EXPO_PUBLIC_SCREENSHOT_MODE=1, so it cannot exist in a production binary.
  // scripts/capture-screenshots.sh writes a route into AsyncStorage and
  // relaunches; this drives the app there. It exists because capturing the
  // store screenshots otherwise needs synthetic taps, and macOS will not grant
  // Accessibility permission to a non-interactive session. It only navigates to
  // an in-app route — it grants no data or privilege the user doesn't have.
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') return;
    if (!isAuthenticated || !isInitialized || isLoading) return;

    let cancelled = false;
    (async () => {
      try {
        const route = await AsyncStorage.getItem('__screenshot_route__');
        // One shot: the capture script rewrites it before every launch, and
        // leaving it behind would keep replacing the stack with a screen that
        // has nothing to go back to (owner hit exactly that on 2026-09-11).
        if (route) await AsyncStorage.removeItem('__screenshot_route__');
        if (route && !cancelled) {
          // Let the auth redirect to /(tabs)/home settle first.
          setTimeout(() => {
            if (!cancelled) router.replace(route);
          }, 500);
        }
      } catch {
        // Screenshot tooling only — never break app startup over it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitialized, isLoading]);

  // CELLAR REMINDERS - check & (re)schedule the restrained drink-soon / past-peak
  // nudge when the app comes to the foreground (and once on first authenticated
  // load). Fully guarded inside lib/notifications: no-ops on web, without the
  // native module, when push is disabled, or when permission isn't granted, and
  // never blocks boot. Only runs for a signed-in user (cellar is user-scoped).
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Defer off the boot path so it never delays first paint.
    const id = setTimeout(() => { checkAndReschedule(); }, 0);

    const sub = AppState.addEventListener('change', (next) => {
      const cameToForeground =
        appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameToForeground) checkAndReschedule();
    });

    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [isAuthenticated]);

  // OTA updates: check on launch and on every return to the foreground, so a
  // shipped JS fix reaches testers on this launch rather than the next one
  // (§2.3). No-ops in development and when updates are disabled.
  useEffect(() => startUpdateWatcher(), []);

  const signIn = async (email, password) => {
    try {
      setIsLoading(true);
      // From a guest session, the guest's rows follow them into the account
      // they sign in to (lib/guest.js: claim token first, merge after).
      const guestId = isGuest ? user.id : null;
      const { data, error } = await signInFromGuest(supabase, { guestId, email, password });
      
      if (error) {
        setIsLoading(false); // Only set to false on error
        if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid email or password. Please check your credentials or sign up for a new account.' } };
        } else if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and click the confirmation link before signing in.' } };
        } else if (error.message.includes('User not found')) {
          return { error: { message: 'No account found with this email. Please sign up first.' } };
        }
        throw error;
      }
      
      // Don't set isLoading to false here - let the auth state change handle it
      return { error: null, data };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  const signUp = async (email, password, name) => {
    try {
      setIsLoading(true);

      if (isGuest) {
        // Guest mode: "Create account" fills the email in on the anonymous
        // user instead of creating a second one, so the id (and every row
        // under it) is preserved. The project auto-confirms email, so the
        // link lands immediately (verified live 2026-09-21).
        const linked = await linkGuestAccount(supabase, { email, password, name });
        if (linked.error) {
          setIsLoading(false);
          throw linked.error;
        }
        // Flip locally as well as via USER_UPDATED: the guard then routes
        // register → choose-plan exactly like a fresh sign-up.
        if (linked.data?.user) setUser(linked.data.user);
        setIsLoading(false);
        return { error: null, data: { ...linked.data, session, linked: true } };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      
      if (error) {
        setIsLoading(false);
        throw error;
      }

      // With email confirmation enabled, signUp returns NO session and no
      // SIGNED_IN event ever fires — without this, isLoading stayed true and
      // the navigation guard was disabled until the next auth event.
      if (!data?.session) {
        setIsLoading(false);
      }
      // Otherwise let the SIGNED_IN auth state change clear it.
      return { error: null, data };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      setSession(null);
      setUser(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }

      // Guest mode: signing out lands on Home as a new guest, not on a wall.
      // isLoading stays true until that session exists so the guard never
      // flashes the login screen in between.
      const guest = await startGuestSession(supabase);
      if (!guest.error) {
        setSession(guest.session);
        setUser(guest.user);
      }
      
      setIsLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Error signing out:', error.message);
      setIsLoading(false);
      throw error;
    }
  };

  // Retry the guest session from the login screen after an offline launch.
  const continueAsGuest = async () => {
    setIsLoading(true);
    const guest = await startGuestSession(supabase);
    if (guest.error) {
      setIsLoading(false);
      return { error: guest.error };
    }
    setSession(guest.session);
    setUser(guest.user);
    setIsLoading(false);
    return { error: null };
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'corkandnote://reset-password',
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        return { error: { message: 'Current password is incorrect' } };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return { error: updateError };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Auth context value
  const authContextValue = {
    signIn,
    signOut,
    signUp,
    resetPassword,
    changePassword,
    user,
    isLoading,
    session,
    isAuthenticated,
    isInitialized,
    isGuest,
    continueAsGuest,
  };

  // Show splash screen until everything is loaded — including the age-gate
  // check, so the gate never flashes in after the app is already visible.
  useEffect(() => {
    if (loaded && themeReady && !isLoading && ageStatus !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [loaded, themeReady, isLoading, ageStatus]);

  if (!loaded || !themeReady || ageStatus === 'loading') {
    return null;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {/* Inside the auth provider because it follows the signed-in user: it
          identifies them to RevenueCat on sign-in and logs out on sign-out, so
          one account's Pro cannot leak to the next person on this device. */}
      <ProProvider userId={user?.id ?? null}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.neutral.bg }}>
          <SafeAreaProvider>
            {/* Pinned above the navigator so it shows on every screen (§2.3). */}
            <OfflineBanner />
            <ThemeProvider value={navigationTheme}>
              {/* A render throw in any screen lands here instead of on a blank
                  white screen. Inside the providers so a retry keeps the
                  session, theme and Pro state. */}
              <ErrorBoundary>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.neutral.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="choose-plan" />
                <Stack.Screen name="forgot-password" />
                <Stack.Screen name="reset-password" />
                <Stack.Screen name="profile/account-settings" />
                <Stack.Screen name="profile/notifications" />
                <Stack.Screen name="profile/achievements" />
                <Stack.Screen name="profile/change-password" />
                <Stack.Screen name="profile/help-support" />
                <Stack.Screen name="profile/feedback" />
                <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              </ErrorBoundary>
              <StatusBar style={isDark ? 'light' : 'dark'} />
            </ThemeProvider>
            {/* Last child so its opaque absolute fill covers every screen
                (and the offline banner) until the user attests. */}
            {ageStatus === 'needed' && <AgeGate onConfirm={confirmAge} />}
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ProProvider>
    </AuthContext.Provider>
  );
}
