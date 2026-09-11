// app/trips/new.js — placeholder for the "Plan a wine day" tool.
//
// Foundation stub (2026-09-11): registers the route the Sommelier tool grid
// navigates to and shows the free-user preview. The real tool replaces this
// file in its own PR. Keeping the route live means the hub never pushes to a
// screen that does not exist.
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import ProFeaturePreview from '../../components/ProFeaturePreview';
import ScreenHeader from '../../components/ScreenHeader';
import { usePro } from '../../hooks/usePro';
import { createThemedStyles } from '../../styles/ThemeProvider';

export default function Screen() {
  const { styles } = useScreenTheme();
  const router = useRouter();
  const { isPro } = usePro();

  return (
    <View style={styles.safeArea}>
      <ScreenHeader title="Plan a wine day" onBack={() => router.back()} />
      {isPro ? (
        <View style={styles.centered}>
          <Text style={styles.title}>A day in wine country, planned</Text>
          <Text style={styles.body}>This tool is being finished right now and will be in the next update.</Text>
        </View>
      ) : (
        <ProFeaturePreview source="trip_plan" title="A day in wine country, planned" body="Pick a start, a date and two or three stops. You get drive times, a schedule with room for lunch, and directions to each stop.">
          <Text style={styles.body}>A sample result will appear here.</Text>
        </ProFeaturePreview>
      )}
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing } = theme;
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.neutral.bg },
    centered: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
    title: { ...typography.heading.h2, color: colors.neutral.ink, marginBottom: spacing.sm },
    body: { ...typography.body.regular, color: colors.neutral.inkSecondary },
  });
  return { colors, styles };
});
