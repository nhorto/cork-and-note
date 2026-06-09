// app/(tabs)/log.js - Logging entry point (center "+" tab)
// Château Label Design - Elegant & Refined
// Presents the two entry paths from the hybrid logging design
// (docs/design/logging-flow.md). The full flow lands with Epic #5.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../../styles/theme';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function LogScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Log</Text>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={colors.neutral.charcoal} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerBorder} />
      </View>

      <View style={styles.body}>
        <Text style={styles.prompt}>What would you like to do?</Text>

        <TouchableOpacity
          style={styles.choice}
          activeOpacity={0.9}
          onPress={() => router.push('/log-session?mode=wine')}
        >
          <View style={styles.choiceIcon}>
            <Ionicons name="wine" size={24} color={colors.primary.burgundy} />
          </View>
          <View style={styles.choiceText}>
            <Text style={styles.choiceTitle}>Log a wine</Text>
            <Text style={styles.choiceSub}>
              Just the winemaker &amp; varietal — add a place if you like.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gold.shimmer} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choice}
          activeOpacity={0.9}
          onPress={() => router.push('/log-session?mode=winery')}
        >
          <View style={styles.choiceIcon}>
            <Ionicons name="location" size={24} color={colors.primary.burgundy} />
          </View>
          <View style={styles.choiceText}>
            <Text style={styles.choiceTitle}>Start a winery visit</Text>
            <Text style={styles.choiceSub}>
              Log several wines from one winery in a session.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gold.shimmer} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  header: { backgroundColor: colors.neutral.cream, paddingTop: 60 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
    marginHorizontal: spacing.lg,
  },

  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  prompt: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.lg,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1 },
  choiceTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  choiceSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 2 },
  note: {
    ...typography.body.small,
    color: colors.neutral.silver,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
});
