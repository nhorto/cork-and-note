// app/_layout.js - WITH NAVIGATION LOGIC
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

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

  // Navigation hooks - ADD THESE
  const router = useRouter();
  const segments = useSegments();

  // Derived state for cleaner checks
  const isAuthenticated = !!(user && session);

  // AUTH INITIALIZATION - With mock mode support
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...');

        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          console.log('⚠️ Running in MOCK MODE - login with any credentials');
          if (mounted) {
            // Don't auto-login - show the login screen
            setSession(null);
            setUser(null);
            setIsInitialized(true);
            setIsLoading(false);
          }
          return;
        }

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('📊 Session result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          error: error?.message
        });

        if (mounted) {
          if (error) {
            console.error('❌ Session check error:', error);
            setSession(null);
            setUser(null);
          } else {
            console.log('✅ Session check result:', session ? 'Found session' : 'No session');
            setSession(session);
            setUser(session?.user ?? null);
          }

          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsInitialized(true);
          setIsLoading(false);
        }
      }
    };

    // Initialize auth
    initializeAuth();

    // Listen for auth state changes (works in both real and mock mode)
    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        console.log('🔄 Auth state changed:', {
          event,
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          isInitialized,
          mockMode: !isSupabaseConfigured()
        });
        setSession(session);
        setUser(session?.user ?? null);

        // If this is a sign-in event, make sure loading is false
        if (event === 'SIGNED_IN' && session) {
          setIsLoading(false);
        }
      }
    });

    const subscription = authListener.data.subscription;

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // NAVIGATION LOGIC - ADD THIS NEW EFFECT
  useEffect(() => {
    if (!isInitialized || isLoading) {
      console.log('⏳ Auth not ready yet, skipping navigation');
      return;
    }

    console.log('🚀 Auth ready, checking navigation...', {
      isAuthenticated,
      currentSegments: segments,
      user: user?.email
    });

    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthFlow = ['login', 'register', 'forgot-password'].includes(segments[0]);
    const inProtectedRoute = ['winery', 'wine', 'profile'].includes(segments[0]) || inAuthGroup;
    const onIndexPage = segments.length === 0; // ← ADD THIS CHECK

    if (isAuthenticated && (inAuthFlow || onIndexPage)) {
      // User is authenticated but on login/register page OR index page
      console.log('✅ User authenticated, navigating from auth flow/index to main app');
      router.replace('/(tabs)/map');
    } else if (!isAuthenticated && !inAuthFlow && !onIndexPage) {
      // User is not authenticated but trying to access protected content (not index)
      console.log('❌ User not authenticated, navigating to login');
      router.replace('/login');
    } else if (!isAuthenticated && onIndexPage) {
      // User is not authenticated and on index page
      console.log('❌ User not authenticated on index, navigating to login');
      router.replace('/login');
    } else {
      console.log('📍 User is in correct section, no navigation needed');
    }
  }, [isAuthenticated, isInitialized, isLoading, segments]);

  // YOUR EXISTING AUTH FUNCTIONS - Keep these the same
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
      
      // Don't set isLoading to false here - let the auth state change handle it
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="profile/account-settings" />
              <Stack.Screen name="profile/change-password" />
              <Stack.Screen name="profile/help-support" />
              <Stack.Screen name="profile/feedback" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthContext.Provider>
  );
}