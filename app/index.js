// app/index.js - SIMPLIFIED VERSION
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export default function Index() {
  // This component just shows a loading state.
  // All navigation logic is handled in _layout.js.
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.neutral.bg }}>
      <ActivityIndicator size="large" color={colors.primary.base} />
      <Text style={{ marginTop: 12, color: colors.neutral.inkSecondary }}>
        Loading…
      </Text>
    </View>
  );
}
