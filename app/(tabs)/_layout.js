import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const headerStyle = {
  backgroundColor: '#E7E3E2',
};

const headerTitleStyle = {
  fontWeight: 'bold',
  fontSize: 18,
  color: '#3E3E3E',
};

const tabBarStyle = {
  backgroundColor: '#E7E3E2',
  borderTopColor: '#ccc',
};

const tabBarActiveTintColor = '#8C1C13';
const tabBarInactiveTintColor = '#3E3E3E';

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle,
        headerTitleStyle,
        tabBarStyle,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarLabelStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="map" color={color} size={24} />,
          title: 'Map',
          headerTitle: 'Explore Wineries',
        }}
      />
      <Tabs.Screen
        name="wines"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="wine" color={color} size={24} />,
          title: 'Wines',
          headerTitle: 'Wines',
        }}
      />
      <Tabs.Screen
        name="wineries"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="business" color={color} size={24} />,
          title: 'Wineries',
          headerTitle: 'Wineries',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={24} />,
          title: 'Profile',
          headerTitle: 'Your Profile',
        }}
      />
    </Tabs>
  );
}