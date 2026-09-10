import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles, useAppearance } from '../styles/ThemeProvider';

const OPTIONS = [
  { value: 'system', label: 'System', detail: 'Follow your device', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', detail: 'Royal Velvet', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', detail: 'Purple After Dark', icon: 'moon-outline' },
];

export default function AppearanceSettings() {
  const { preference, setPreference } = useAppearance();
  const { colors, styles } = useScreenTheme();
  const select = (value) => {
    setPreference(value).catch(() => Alert.alert(
      'Appearance changed',
      'Your choice is active, but could not be saved for your next visit. Please try again.'
    ));
  };
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Appearance</Text>
      <Text style={styles.description}>Choose your look, or match your device automatically.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="App appearance">
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <TouchableOpacity key={option.value} onPress={() => select(option.value)}
              style={[styles.option, selected && styles.selected]}
              accessibilityRole="radio" accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}: ${option.detail}`}>
              <Ionicons name={option.icon} size={23} color={colors.primary.ink} />
              <View style={styles.copy}>
                <Text style={styles.label}>{option.label}</Text>
                <Text style={styles.detail}>{option.detail}</Text>
              </View>
              <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={23}
                color={selected ? colors.primary.ink : colors.neutral.inkTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const useScreenTheme = createThemedStyles(({ colors, typography }) => ({
  colors,
  styles: StyleSheet.create({
    section: { marginBottom: 32 },
    title: { fontFamily: typography.fonts.serif, fontSize: 22, color: colors.neutral.ink, marginBottom: 8 },
    description: { color: colors.neutral.inkSecondary, fontSize: 14, lineHeight: 21, marginBottom: 14 },
    option: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 9, gap: 13, borderWidth: 1, borderColor: colors.neutral.border, borderRadius: 12, backgroundColor: colors.neutral.surface },
    selected: { backgroundColor: colors.primary.surface, borderColor: colors.primary.ink },
    copy: { flex: 1 },
    label: { color: colors.neutral.ink, fontSize: 16, fontWeight: '600' },
    detail: { color: colors.neutral.inkSecondary, fontSize: 12, marginTop: 3 },
  }),
}));
