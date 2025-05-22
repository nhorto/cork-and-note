// app/index.js
import { View, ActivityIndicator, Text } from 'react-native';
import { useContext, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthContext } from './_layout';

export default function Index() {
  const { user, isLoading, session } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    // Only navigate after loading is complete
    if (!isLoading) {
      if (user && session) {
        router.replace('/(tabs)/map');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, session, router]);

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