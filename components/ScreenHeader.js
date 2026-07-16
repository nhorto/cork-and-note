// components/ScreenHeader.js
// Shared screen header for stack (detail / profile) screens.
// One safe-area-aware bar, one back icon (chevron), a centered serif title,
// 44pt touch targets, and an optional right-hand slot. Replaces the three
// hand-rolled header recipes (paddingTop 50 / 60, arrow-vs-chevron, 18 vs 20,
// hardcoded 'Georgia') that had drifted across the app.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../styles/theme';

const SERIF = typography.fonts.serif;
const HIT = 44; // Apple HIG minimum touch target

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right = null,
  backAccessibilityLabel = 'Go back',
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleBack = onBack || (() => router.back());

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.primary.burgundy} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.neutral.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold.muted,
  },
  side: {
    width: HIT,
    minHeight: HIT,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: HIT,
    height: HIT,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
    textAlign: 'center',
  },
});
