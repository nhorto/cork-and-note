// components/OfflineBanner.js — a quiet "you're offline" strip (§2.3).
//
// Wineries and tasting rooms are exactly where signal is worst, which is also
// exactly where people log wines. Without this the app just appears to fail:
// saves error out and reads come back empty with no explanation.
//
// Deliberately restrained — one thin bar pinned under the status bar, no modal,
// nothing blocked. Logging still works offline as far as the UI is concerned;
// this only explains why a sync or a sommelier reply isn't happening.
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles } from '../styles/ThemeProvider';


export default function OfflineBanner() {
  const { spacing, styles } = useScreenTheme();

  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // `isInternetReachable` is null until the first probe resolves; treating
    // that as offline would flash the banner on every cold start, so only a
    // definite false counts as offline.
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(isOffline);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offline, slide]);

  if (!offline) return null;

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + spacing.xs,
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
          ],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.inner}>
        <Text style={styles.text}>No connection — changes may not save yet</Text>
      </View>
    </Animated.View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing } = theme;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.neutral.ink,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  inner: {
    alignItems: 'center',
  },
  text: {
    ...typography.body.small,
    color: colors.neutral.bg,
    fontWeight: '600',
  },
});
return { spacing, styles };
});
