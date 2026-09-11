// app/sommelier/taste.js — placeholder for the "My taste" tool.
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
      <ScreenHeader title="My taste" onBack={() => router.back()} />
      {isPro ? (
        <View style={styles.centered}>
          <Text style={styles.title}>What your journal says about you</Text>
          <Text style={styles.body}>This tool is being finished right now and will be in the next update.</Text>
        </View>
      ) : (
        <ProFeaturePreview source="taste_report" title="What your journal says about you" body="Once you have rated a few wines, the sommelier reads your whole journal and tells you what keeps standing out and what to try next.">
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
