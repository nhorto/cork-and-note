// components/ErrorBoundary.js: the last line between a render throw and a
// blank screen.
//
// Until this existed there was no error boundary anywhere in the app. A
// render throw in any screen (a null join, a bad date, a theme token that
// stopped existing) took the whole app to a white screen with no way back
// but force-quitting. Wrapped around the navigator in app/_layout.js, this
// keeps the providers alive, tells the user something went wrong, and offers
// to try again, which remounts the tree beneath it.
//
// Class component on purpose: React only exposes getDerivedStateFromError and
// componentDidCatch to classes.
import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

export function ErrorFallback({ error, onRetry }) {
  const { styles } = useScreenTheme();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        Cork &amp; Note hit a problem it could not recover from on this screen. Your saved
        tastings and cellar are safe.
      </Text>
      {__DEV__ && error?.message ? <Text style={styles.detail}>{String(error.message)}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonLabel}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { borderRadius, colors, spacing, typography } = theme;
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.neutral.bg,
    },
    title: {
      ...typography.heading.h1,
      color: colors.neutral.ink,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    body: {
      ...typography.body.regular,
      color: colors.neutral.inkSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    detail: {
      ...typography.body.small,
      color: colors.status.error,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    button: {
      minHeight: 52,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onPrimary,
    },
  });
  return { styles };
});
