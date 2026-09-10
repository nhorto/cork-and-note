import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { createThemedStyles } from '../styles/ThemeProvider';

export default function NotFoundScreen() {
  const { styles } = useScreenTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>
          This page seems to have been uncorked and poured elsewhere.
        </Text>
        <Link href="/(tabs)/home" style={styles.link}>
          Back to home
        </Link>
      </View>
    </>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, spacing, typography } = theme;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.bg,
    padding: spacing.lg,
  },
  title: {
    ...(typography.heading.h1 as TextStyle),
    fontFamily: typography.fonts.serif,
    color: colors.neutral.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...(typography.body.regular as TextStyle),
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  link: {
    ...(typography.body.regular as TextStyle),
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    fontWeight: '600',
    color: colors.primary.ink,
  },
});
return { styles };
});
