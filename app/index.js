// app/index.js - SIMPLIFIED VERSION
import { ActivityIndicator, Text, View } from 'react-native';

export default function Index() {
  // This component now just shows loading
  // All navigation logic is handled in _layout.js
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#8E2DE2" />
      <Text style={{ marginTop: 10, color: '#666' }}>
        Initializing...
      </Text>
    </View>
  );
}