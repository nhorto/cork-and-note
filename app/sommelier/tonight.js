// app/sommelier/tonight.js: Tonight's pick as a guided tool of its own.
//
// The Sommelier hub used to embed the card as a collapsible row directly under
// an ask box whose placeholder said nearly the same thing (owner feedback
// 2026-09-12). It is now a tool tile that opens this screen, where the card is
// the whole page and never folds. The Cellar tab keeps its own inline copy.
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import TonightsPickCard from '../../components/TonightsPickCard';
import { useSafeBack } from '../../hooks/useSafeBack';
import { createThemedStyles } from '../../styles/ThemeProvider';

export default function TonightsPickScreen() {
  const { styles } = useScreenTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(tabs)/sommelier');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Tonight's pick" subtitle="From your cellar" onBack={goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TonightsPickCard
          collapsible={false}
          onRequireCellar={() => router.push('/cellar/add')}
        />
      </ScrollView>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, spacing } = theme;
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.neutral.bg },
    content: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
  });
  return { styles };
});
