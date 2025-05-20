// app/index.js
import { View, ActivityIndicator } from 'react-native';
import { useContext, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthContext } from './_layout';

export default function Index() {
  const { user, isLoading } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    // Only navigate after initial loading is complete
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)/map');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // Show loading indicator while determining route
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#8E2DE2" />
    </View>
  );
}