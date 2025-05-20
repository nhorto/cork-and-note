import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Layout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="map" color={color} size={24} />,
          title: 'Map',
          headerTitle: 'Explore Wineries', // ✅ This sets the header title
          headerShown: true,              // ✅ Ensure it's visible
          tabBarIcon: ({ color }) => <Ionicons name="map" color={color} size={24} />,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
        }}
      />
      <Tabs.Screen
        name="wines"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="wine" color={color} size={24} />,
          title: 'Wines',
          headerTitle: 'Wines',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="wineries"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="business" color={color} size={24} />,
          title: 'Wineries',
          headerTitle: 'Wineries',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={24} />,
          title: 'Profile',
          headerTitle: 'Your Profile',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}