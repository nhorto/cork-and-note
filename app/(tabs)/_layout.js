// app/(tabs)/_layout.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import theme from '../../styles/theme';

const { colors } = theme;

// Get screen dimensions for responsive scaling
const { width, height } = Dimensions.get('window');

// Create responsive scaling functions
const scale = (size) => (width / 375) * size;
const verticalScale = (size) => (height / 667) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Dynamic icon size based on screen size
const getIconSize = () => {
  if (width < 375) return moderateScale(22);
  if (width > 414) return moderateScale(26);
  return moderateScale(24);
};

// Tab bar styling with Château Label aesthetic
const tabBarStyles = {
  tabBarStyle: {
    backgroundColor: colors.neutral.cream,
    borderTopWidth: 1,
    borderTopColor: colors.gold.muted,
    height: Platform.OS === 'ios' ? verticalScale(88) : verticalScale(64),
    paddingBottom: Platform.OS === 'ios' ? verticalScale(28) : verticalScale(8),
    paddingTop: verticalScale(8),
    shadowColor: colors.neutral.charcoal,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tabBarLabelStyle: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: 2,
  },
  tabBarIconStyle: {
    marginTop: 2,
  },
};

// Header styling with Château Label aesthetic
const headerStyles = {
  headerStyle: {
    backgroundColor: colors.neutral.cream,
    shadowColor: colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold.muted,
  },
  headerTitleStyle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: colors.neutral.charcoal,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerTintColor: colors.primary.burgundy,
};

// Custom tab icon with active indicator
const TabIcon = ({ name, color, focused, size }) => (
  <View style={styles.tabIconContainer}>
    <Ionicons name={name} color={color} size={size} />
    {focused && <View style={styles.activeIndicator} />}
  </View>
);

export default function Layout() {
  const iconSize = getIconSize();

  return (
    <Tabs
      screenOptions={{
        ...tabBarStyles,
        ...headerStyles,
        tabBarActiveTintColor: colors.primary.burgundy,
        tabBarInactiveTintColor: colors.neutral.pewter,
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Map',
          headerShown: false, // Hide header on map for more space
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bookmark" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Wishlist',
          headerShown: false, // Custom header in wishlist screen
        }}
      />
      <Tabs.Screen
        name="wines"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="wine" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Wines',
          headerShown: false, // Custom header in wines screen
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Profile',
          headerShown: false, // Custom header in profile screen
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary.burgundy,
  },
});