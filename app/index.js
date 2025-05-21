// app/index.js
import { View, ActivityIndicator, Text } from 'react-native';
import { useContext, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { AuthContext } from './_layout';

export default function Index() {
  const { user, isLoading, session } = useContext(AuthContext);
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    console.log('Index: Auth state changed - User:', user?.email, 'Loading:', isLoading, 'Session:', !!session);
    
    // Only navigate after loading is complete and we haven't navigated yet
    if (!isLoading && !hasNavigated.current) {
      if (user && session) {
        console.log('Index: Navigating to tabs (user authenticated)');
        hasNavigated.current = true;
        router.replace('/(tabs)/map');
      } else {
        console.log('Index: Navigating to login (no user)');
        hasNavigated.current = true;
        router.replace('/login');
      }
    }
  }, [user, isLoading, session, router]);

  // Reset navigation flag when auth state changes
  useEffect(() => {
    hasNavigated.current = false;
  }, [user]);

  // Show loading indicator while determining route
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#8E2DE2" />
      <Text style={{ marginTop: 10, color: '#666' }}>
        {isLoading ? 'Loading...' : 'Redirecting...'}
      </Text>
    </View>
  );
}