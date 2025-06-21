// app/(tabs)/_layout.js
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Dimensions, Platform } from 'react-native';

// Get screen dimensions for responsive scaling
const { width, height } = Dimensions.get('window');

// Create responsive scaling functions
const scale = (size) => (width / 375) * size; // Base on iPhone 8 width
const verticalScale = (size) => (height / 667) * size; // Base on iPhone 8 height
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Define responsive spacing and typography
const spacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(24),
  xxl: moderateScale(32),
};

const typography = {
  tabLabel: {
    fontSize: moderateScale(12),
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
  }
};

// Responsive style definitions
const responsiveStyles = {
  headerStyle: {
    backgroundColor: '#E7E3E2',
    height: Platform.OS === 'ios' ? verticalScale(88) : verticalScale(56),
  },
  
  headerTitleStyle: {
    ...typography.headerTitle,
    color: '#3E3E3E',
  },
  
  tabBarStyle: {
    backgroundColor: '#E7E3E2',
    borderTopColor: '#ccc',
    height: Platform.OS === 'ios' ? verticalScale(83) : verticalScale(60),
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingTop: spacing.xs,
  },
  
  tabBarLabelStyle: {
    ...typography.tabLabel,
    marginTop: spacing.xs / 2,
    marginBottom: Platform.OS === 'ios' ? 0 : spacing.xs / 2,
  },
  
  tabBarIconStyle: {
    marginTop: spacing.xs / 2,
  }
};

// Dynamic icon size based on screen size
const getIconSize = () => {
  if (width < 375) return moderateScale(20); // Small screens
  if (width > 414) return moderateScale(26); // Large screens
  return moderateScale(24); // Default
};

const tabBarActiveTintColor = '#8C1C13';
const tabBarInactiveTintColor = '#3E3E3E';

export default function Layout() {
  const iconSize = getIconSize();
  
  return (
    <Tabs
      screenOptions={{
        headerStyle: responsiveStyles.headerStyle,
        headerTitleStyle: responsiveStyles.headerTitleStyle,
        tabBarStyle: responsiveStyles.tabBarStyle,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarLabelStyle: responsiveStyles.tabBarLabelStyle,
        tabBarIconStyle: responsiveStyles.tabBarIconStyle,
        tabBarAllowFontScaling: false, // Prevent system font scaling from breaking layout
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="map" color={color} size={iconSize} />,
          title: 'Map',
          headerTitle: 'Explore Wineries',
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="bookmark" color={color} size={iconSize} />,
          title: 'Want to Visit',
          headerTitle: 'Want to Visit',
        }}
      />
      <Tabs.Screen
        name="wines"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="wine" color={color} size={iconSize} />,
          title: 'Wines',
          headerTitle: 'My Wines',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={iconSize} />,
          title: 'Profile',
          headerTitle: 'Your Profile',
        }}
      />
    </Tabs>
  );
}