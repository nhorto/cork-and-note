// app/_layout.js (simplified version)
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, createContext } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Simple auth context
export const AuthContext = createContext({
  signIn: () => {},
  signOut: () => {},
  user: null,
  isLoading: true,
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    async function prepare() {
      try {
        // This is where you would check Supabase auth status
        // For now, simulate a check with a slight delay
        setTimeout(() => {
          setUser(null); // Initially logged out
          setIsLoading(false);
        }, 500);
      } catch (e) {
        console.warn(e);
      }
    }

    prepare();
  }, []);

  // Auth functions
  const authContext = {
    signIn: (userData) => {
      setUser(userData);
    },
    signOut: () => {
      setUser(null);
    },
    user,
    isLoading,
  };

  // Show splash screen until everything is loaded
  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isLoading]);

  if (!loaded || isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider value={authContext}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
          </Stack>
        </ThemeProvider>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </AuthContext.Provider>
  );
}