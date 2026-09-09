// app/_layout.js — root layout: auth context, Pro entitlements, navigation guard,
// cellar reminders
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OfflineBanner from '../components/OfflineBanner';
import { ProProvider } from '../components/ProProvider';
import { checkAndReschedule, setNotificationHandler } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { startUpdateWatcher } from '../lib/updates';

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
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  // Derived state for cleaner checks
  const isAuthenticated = !!(user && session);

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
          } else {
            setSession(session);
            setUser(session?.user ?? null);
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
    if (!isInitialized || isLoading) return;

    // The password-recovery deep link manages its own navigation: the user
    // arrives unauthenticated (tokens still in the URL) and becomes
    // authenticated mid-screen once the recovery session is set — neither
    // state should yank them off the screen.
    if (segments[0] === 'reset-password') return;

    const inAuthFlow = ['login', 'register', 'forgot-password'].includes(segments[0]);
    const onIndexPage = segments.length === 0;

    if (isAuthenticated && (inAuthFlow || onIndexPage)) {
      // Authenticated but on an auth screen or the index page → main app.
      router.replace('/(tabs)/home');
    } else if (!isAuthenticated && !inAuthFlow) {
      // Not authenticated and outside the auth flow (incl. index) → login.
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, isLoading, segments]);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
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
      
      setIsLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Error signing out:', error.message);
      setIsLoading(false);
      throw error;
    }
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
  };

  // Show splash screen until everything is loaded
  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isLoading]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {/* Inside the auth provider because it follows the signed-in user: it
          identifies them to RevenueCat on sign-in and logs out on sign-out, so
          one account's Pro cannot leak to the next person on this device. */}
      <ProProvider userId={user?.id ?? null}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            {/* Pinned above the navigator so it shows on every screen (§2.3). */}
            <OfflineBanner />
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="forgot-password" />
                <Stack.Screen name="reset-password" />
                <Stack.Screen name="profile/account-settings" />
                <Stack.Screen name="profile/notifications" />
                <Stack.Screen name="profile/change-password" />
                <Stack.Screen name="profile/help-support" />
                <Stack.Screen name="profile/feedback" />
                <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ProProvider>
    </AuthContext.Provider>
  );
}