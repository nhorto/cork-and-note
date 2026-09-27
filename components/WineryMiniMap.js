// components/WineryMiniMap.js
//
// A small, still map of one winery for its page (owner feedback 2026-09-27:
// "it would be nice to be able to see it on the map in the app itself").
// The map itself takes no gestures, so it never fights the page scroll; the
// whole card is one button that opens the Map tab focused on this winery.
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView from 'react-native-maps';
import { createThemedStyles } from '../styles/ThemeProvider';
import { darkMapStyle } from '../styles/mapTheme';
import StableMarker from './StableMarker';

// About a kilometre across: close enough to read the roads around it.
const DELTA = 0.012;

export default function WineryMiniMap({ latitude, longitude, name, onPress }) {
  const { colors, mode, styles } = useScreenTheme();
  const coordinate = { latitude: Number(latitude), longitude: Number(longitude) };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Show ${name || 'this winery'} on the map`}
      testID="winery-mini-map"
    >
      <View style={styles.mapWrap} pointerEvents="none">
        <MapView
          style={StyleSheet.absoluteFill}
          userInterfaceStyle={mode}
          customMapStyle={mode === 'dark' ? darkMapStyle(colors) : []}
          initialRegion={{ ...coordinate, latitudeDelta: DELTA, longitudeDelta: DELTA }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterest={false}
          // Android draws a static bitmap: cheap, and the card is not interactive.
          liteMode={Platform.OS === 'android'}
        >
          <StableMarker key={`mini-${mode}`} coordinate={coordinate}>
            <View style={styles.marker}>
              <Ionicons name="wine" size={16} color={colors.onPrimary} />
            </View>
          </StableMarker>
        </MapView>
      </View>
      <View style={styles.footer}>
        <Ionicons name="map-outline" size={18} color={colors.primary.ink} />
        <Text style={styles.footerText}>Show on the map</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary.ink} />
      </View>
    </TouchableOpacity>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
const { colors, mode, typography, spacing, borderRadius, shadows } = theme;

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.bg,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  mapWrap: {
    height: 150,
  },
  marker: {
    backgroundColor: colors.primary.base,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.neutral.bg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  footerText: {
    ...typography.body.regular,
    flex: 1,
    color: colors.primary.ink,
    fontWeight: '600',
  },
});
return { colors, mode, styles };
});
