// components/LogFab.js — floating "＋ Log" pill (flat-five IA, epic #203).
//
// The raised center tab is gone; this pill is now the front door for the
// "start / create" actions. It floats bottom-right on the screens where
// logging is the natural next step (Home, Journal, winery pages) and opens
// the same HubMenu sheet the center button used to.
//
// Owns its own HubMenu instance so host screens just render <LogFab /> as the
// last child of their root view — no state threading through layouts.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { tapMedium } from '../lib/haptics';
import { createThemedStyles } from '../styles/ThemeProvider';
import HubMenu from './HubMenu';


export default function LogFab() {
  const { colors, styles } = useScreenTheme();

  const [hubOpen, setHubOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Log — quick actions"
        onPress={() => {
          tapMedium();
          setHubOpen(true);
        }}
      >
        <Ionicons name="add" size={22} color={colors.onPrimary} />
        <Text style={styles.label}>Log</Text>
      </TouchableOpacity>
      <HubMenu visible={hubOpen} onClose={() => setHubOpen(false)} />
    </>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows } = theme;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.primary.base,
    ...shadows.strong,
  },
  label: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '600',
  },
});
return { colors, styles };
});
