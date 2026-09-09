// app/(tabs)/_layout.js
// Château Label Design - Elegant & Refined
// 5-tab layout: Home · Cellar · ＋Log (center) · Explore · Profile.
// Wishlist / Wines / Sommelier routes are preserved but hidden from the bar
// (reached contextually / nested) per docs/design/information-architecture.md.
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HubMenu from '../../components/HubMenu';
import { tapMedium } from '../../lib/haptics';
import theme from '../../styles/theme';

const { colors } = theme;

// Get screen dimensions for responsive scaling
const { width } = Dimensions.get('window');

// Create responsive scaling functions
const scale = (size) => (width / 375) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Dynamic icon size based on screen size
const getIconSize = () => {
  if (width < 375) return moderateScale(22);
  if (width > 414) return moderateScale(26);
  return moderateScale(24);
};

// Height of the row that actually holds the icons and labels, above whatever the
// device reserves for the home indicator / gesture bar. A fixed point value on
// purpose: the row holds one icon and one line of text, so it does not get
// taller on a bigger phone. The old code ran this and the safe-area padding
// through verticalScale(), sizing the inset from the SCREEN height rather than
// the device's real inset — on a tall phone that produced a 126pt bar with 40pt
// of dead space beneath the labels, so every tab sat well above where a thumb
// expects it. The inset now comes from useSafeAreaInsets() (see Layout below).
const TAB_BAR_ROW_HEIGHT = 60;

// Tab bar styling with Château Label aesthetic
const tabBarStyles = {
  tabBarStyle: {
    backgroundColor: colors.neutral.cream,
    borderTopWidth: 1,
    borderTopColor: colors.gold.muted,
    paddingTop: 8,
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

// The active tab already reads as active from the burgundy tint on its icon and
// label, so there is no separate indicator dot — a second marker under one of
// five tabs just looked like a smudge.
const TabIcon = ({ name, color, size }) => (
  <View style={styles.tabIconContainer}>
    <Ionicons name={name} color={color} size={size} />
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

  // Reserve exactly what the device reserves, on both platforms: the iOS home
  // indicator and the Android edge-to-edge navigation bar (#130) are the same
  // problem, and both report their real size here. Padding the row by the inset
  // keeps every tab tappable; adding the inset to the height keeps the bar's
  // cream background running to the bottom edge instead of floating.
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    ...tabBarStyles.tabBarStyle,
    height: TAB_BAR_ROW_HEIGHT + insets.bottom,
    paddingBottom: insets.bottom,
  };

  return (
    <>
    <Tabs
      screenOptions={{
        ...tabBarStyles,
        tabBarStyle,
        ...headerStyles,
        tabBarActiveTintColor: colors.primary.burgundy,
        tabBarInactiveTintColor: colors.neutral.pewter,
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="home" color={color} size={iconSize} />
          ),
          title: 'Home',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="cellar"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="file-tray-stacked" color={color} size={iconSize} />
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
            <LogTabButton
              {...props}
              onPress={() => {
                tapMedium();
                setHubOpen(true);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="map" color={color} size={iconSize} />
          ),
          title: 'Explore',
          headerShown: false, // Hide header on map for more space
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="person" color={color} size={iconSize} />
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
