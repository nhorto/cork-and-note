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
// import { supabase } from '../lib/supabase'; // Not needed for demo

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

  // Mock user for demo purposes
  const mockUser = {
    id: 'demo-user-123',
    email: 'demo@example.com',
    user_metadata: {
      name: 'Demo User'
    }
  };

  const mockSession = {
    user: mockUser,
    access_token: 'mock-token'
  };

  // Authentication state - Using mock data
  const [user, setUser] = useState(mockUser);
  const [session, setSession] = useState(mockSession);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Start as not authenticated

  // Navigation hooks
  const router = useRouter();
  const segments = useSegments();

  // Navigation logic - redirect to login if not authenticated
  useEffect(() => {
    if (!loaded || isLoading) {
      return;
    }

    const inAuthFlow = ['login', 'register', 'forgot-password'].includes(segments[0]);
    const onIndexPage = segments.length === 0;

    if (isAuthenticated && (inAuthFlow || onIndexPage)) {
      // User is authenticated, go to main app
      setTimeout(() => router.replace('/(tabs)/map'), 100);
    } else if (!isAuthenticated && !inAuthFlow) {
      // User is not authenticated but not on login/register page
      setTimeout(() => router.replace('/login'), 100);
    }
  }, [isAuthenticated, loaded, isLoading, segments]);

  // Mock auth functions
  const signIn = async () => {
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setIsAuthenticated(true);
      setIsLoading(false);
    }, 500);
    return { error: null };
  };

  const signUp = async () => {
    setIsLoading(true);
    // Simulate registration
    setTimeout(() => {
      setIsAuthenticated(true);
      setIsLoading(false);
    }, 500);
    return { error: null };
  };

  const signOut = async () => {
    setIsLoading(true);
    setIsAuthenticated(false);
    setIsLoading(false);
    router.replace('/login');
    return { error: null };
  };

  const resetPassword = async (email) => {
    // Mock password reset
    return { error: null };
  };

  const changePassword = async (currentPassword, newPassword) => {
    // Mock password change
    return { error: null };
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
  };

  // Show splash screen until fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

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