// app/index.js - FIXED VERSION
import { useRouter } from 'expo-router';
import { useContext, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthContext } from './_layout';

export default function Index() {
  const { user, isLoading, session, isAuthenticated } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    // Only navigate after loading is complete AND we have a definitive answer
    if (!isLoading) {
      if (isAuthenticated) {
        //console.log('✅ User authenticated, navigating to map');
        router.replace('/(tabs)/map');
      } else {
        //console.log('❌ User not authenticated, navigating to login');
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

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