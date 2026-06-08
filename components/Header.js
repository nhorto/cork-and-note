import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ title, showBackButton = false, rightAction }) {
  const router = useRouter();
  const navigation = useNavigation();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        
        <Text style={styles.title}>{title}</Text>
        
        {rightAction && (
          <TouchableOpacity 
            style={styles.rightAction} 
            onPress={rightAction.onPress}
          >
            <Ionicons name={rightAction.icon} size={24} color="#8E2DE2" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    paddingHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  rightAction: {
    position: 'absolute',
    right: 16,
  }
});

// app/_layout.js - FIXED VERSION
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export const AuthContext = createContext({
  signIn: () => {},
  signOut: () => {},
  signUp: () => {},
  resetPassword: () => {},
  user: null,
  isLoading: true,
  session: null,
  isAuthenticated: false, // Add this helper
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false); // Track if auth is initialized

  // Derived state for cleaner checks
  const isAuthenticated = !!(user && session);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        //console.log('🔐 Initializing authentication...');
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            //console.error('❌ Session check error:', error);
            // Even with error, we should consider auth initialized
            setSession(null);
            setUser(null);
          } else {
            //console.log('✅ Session check result:', session ? 'Found session' : 'No session');
            setSession(session);
            setUser(session?.user ?? null);
          }
          
          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (error) {
        //console.error('❌ Auth initialization error:', error);
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && isInitialized) {
        //console.log('🔄 Auth state changed:', event, session ? 'has session' : 'no session');
        setSession(session);
        setUser(session?.user ?? null);
        // Don't change loading state here - it's already initialized
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid email or password. Please check your credentials or sign up for a new account.' } };
        } else if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and click the confirmation link before signing in.' } };
        } else if (error.message.includes('User not found')) {
          return { error: { message: 'No account found with this email. Please sign up first.' } };
        }
        throw error;
      }
      
      // Don't manually update state - let onAuthStateChange handle it
      setIsLoading(false);
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
      
      if (error) throw error;
      
      setIsLoading(false);
      return { error: null, data };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear state immediately for better UX
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

  const authContextValue = {
    signIn,
    signOut,
    signUp,
    resetPassword,
    user,
    isLoading,
    session,
    isAuthenticated, // Helper for cleaner checks
  };

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
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthContext.Provider>
  );
}