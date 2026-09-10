// app/(tabs)/_layout.js
// Château Label Design - Elegant & Refined
// Flat five-tab layout (epic #203): Home · Journal · Wineries · Somm · Cellar.
// The raised center "＋" is gone — logging moved to the floating "＋ Log" pill
// (components/LogFab.js) on Home, Journal, and winery pages, and Profile moved
// behind the Home avatar. Log / Wishlist / Profile routes are preserved but
// hidden from the bar (reached contextually).
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles } from '../../styles/ThemeProvider';


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


// Header styling with Château Label aesthetic


// The active tab already reads as active from the primary.base tint on its icon and
// label, so there is no separate indicator dot — a second marker under one of
// five tabs just looked like a smudge.
const TabIcon = ({ name, color, size }) => (
  <View style={styles.tabIconContainer}>
    <Ionicons name={name} color={color} size={size} />
  </View>
);

export default function Layout() {
  const { colors, tabBarStyles, headerStyles } = useScreenTheme();

  const iconSize = getIconSize();

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
    <Tabs
      screenOptions={{
        ...tabBarStyles,
        tabBarStyle,
        ...headerStyles,
        tabBarActiveTintColor: colors.primary.ink,
        tabBarInactiveTintColor: colors.neutral.inkTertiary,
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
        name="wines"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="book" color={color} size={iconSize} />
          ),
          title: 'Journal',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="location" color={color} size={iconSize} />
          ),
          title: 'Wineries',
          headerShown: false, // Hide header on map for more space
        }}
      />
      <Tabs.Screen
        name="sommelier"
        options={{
          tabBarIcon: ({ color }) => (
            <TabIcon name="sparkles" color={color} size={iconSize} />
          ),
          title: 'Somm',
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

      {/* Routes preserved but hidden from the tab bar (reached contextually):
          log via the ＋ Log pill / hub, wishlist via Home & the Wineries list,
          profile via the Home avatar. */}
      <Tabs.Screen name="log" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="wishlist" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="profile" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});


const useScreenTheme = createThemedStyles((theme) => {
const { colors } = theme;

const tabBarStyles = {
  tabBarStyle: {
    backgroundColor: colors.neutral.bg,
    borderTopWidth: 1,
    borderTopColor: colors.accent.border,
    paddingTop: 8,
    shadowColor: colors.neutral.ink,
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

const headerStyles = {
  headerStyle: {
    backgroundColor: colors.neutral.bg,
    shadowColor: colors.neutral.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.border,
  },
  headerTitleStyle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: colors.neutral.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerTintColor: colors.primary.ink,
};
return { colors, tabBarStyles, headerStyles };
});
