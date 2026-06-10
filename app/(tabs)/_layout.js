// app/(tabs)/_layout.js
// Château Label Design - Elegant & Refined
// 5-tab layout: Home · Cellar · ＋Log (center) · Explore · Profile.
// Wishlist / Wines / Sommelier routes are preserved but hidden from the bar
// (reached contextually / nested) per docs/design/information-architecture.md.
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import HubMenu from '../../components/HubMenu';
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

// Raised center "＋ Log" button
const LogTabButton = ({ onPress, accessibilityState }) => (
  <View style={styles.logButtonSlot}>
    <TouchableOpacity
      style={styles.logButton}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Quick actions"
      accessibilityState={accessibilityState}
    >
      <Ionicons name="add" size={30} color={colors.neutral.cream} />
    </TouchableOpacity>
  </View>
);

export default function Layout() {
  const iconSize = getIconSize();
  // The center "＋" opens the quick-actions hub instead of navigating.
  const [hubOpen, setHubOpen] = useState(false);

  return (
    <>
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
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Home',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="cellar"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="file-tray-stacked" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Cellar',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          headerShown: false,
          // Intercept the press: open the quick-actions hub instead of
          // navigating straight to the log chooser.
          tabBarButton: (props) => (
            <LogTabButton {...props} onPress={() => setHubOpen(true)} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map" color={color} focused={focused} size={iconSize} />
          ),
          title: 'Explore',
          headerShown: false, // Hide header on map for more space
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

      {/* Routes preserved but hidden from the tab bar (reached contextually) */}
      <Tabs.Screen name="wishlist" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="wines" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="sommelier" options={{ href: null, headerShown: false }} />
    </Tabs>
    <HubMenu visible={hubOpen} onClose={() => setHubOpen(false)} />
    </>
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
  // Raised center Log button
  logButtonSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logButton: {
    top: -18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.neutral.cream,
    shadowColor: colors.primary.burgundy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
