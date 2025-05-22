// app/_layout.js
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, createContext } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import { supabase } from '../lib/supabase';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Auth context
export const AuthContext = createContext({
  signIn: () => {},
  signOut: () => {},
  signUp: () => {},
  resetPassword: () => {},
  user: null,
  isLoading: true,
  session: null,
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

  // Check auth state on mount
  useEffect(() => {
    let mounted = true;

    // Check for active session on component mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (mounted) {
        if (error) {
          console.error('Session check error:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Check for specific error types
        if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid email or password. Please check your credentials or sign up for a new account.' } };
        } else if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and click the confirmation link before signing in.' } };
        } else if (error.message.includes('User not found')) {
          return { error: { message: 'No account found with this email. Please sign up first.' } };
        }
        throw error;
      }
      
      // Don't manually update state here - let the onAuthStateChange listener handle it
      setIsLoading(false);
      return { error: null, data };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  // Sign up with email and password
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
      
      if (error) throw error;
      
      // Don't manually update state here - let the onAuthStateChange listener handle it
      setIsLoading(false);
      return { error: null, data };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear state immediately before calling signOut
      setSession(null);
      setUser(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        // If signOut fails, we still want to clear local state
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

  // Reset password
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

  // Auth context value
  const authContextValue = {
    signIn,
    signOut,
    signUp,
    resetPassword,
    user,
    isLoading,
    session,
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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="forgot-password" />
          </Stack>
        </ThemeProvider>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </AuthContext.Provider>
  );
}