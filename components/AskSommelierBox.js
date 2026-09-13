// components/AskSommelierBox.js — Home's front door to the sommelier.
// A real text input (owner feedback 2026-09-09: replace the Tonight's Pick
// card with "something there where they can talk to the somm"). Submitting
// hands the question to the Somm tab, which opens a fresh conversation and
// sends it; tapping the sparkle affordance with nothing typed just opens the
// tab. Free-tier metering is enforced there (and server-side), not here —
// this box is an entrance, not a gate.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';


export default function AskSommelierBox({ onAsk, onOpen, onOpenWineList, showActions = false }) {
  const { colors, styles } = useScreenTheme();

  const [text, setText] = useState('');

  const submit = () => {
    const question = text.trim();
    if (!question) {
      onOpen?.();
      return;
    }
    setText('');
    onAsk?.(question);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>ASK YOUR SOMMELIER</Text>
      <View style={styles.box}>
        <Ionicons name="sparkles" size={18} color={colors.accent.strong} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="What should I open tonight?"
          placeholderTextColor={colors.neutral.placeholder}
          selectionColor={colors.primary.ink}
          returnKeyType="send"
          onSubmitEditing={submit}
          accessibilityLabel="Ask your sommelier a question"
        />
        <TouchableOpacity
          onPress={submit}
          style={styles.send}
          accessibilityRole="button"
          accessibilityLabel={text.trim() ? 'Send question' : 'Open the sommelier'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={text.trim() ? 'arrow-up-circle' : 'chevron-forward-circle'}
            size={28}
            color={colors.primary.ink}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Tell it what you like, ask about a pairing, or get help choosing a bottle.
      </Text>
      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={onOpenWineList}
            accessibilityRole="button"
            accessibilityLabel="Photograph a restaurant wine list"
          >
            <Ionicons name="camera-outline" size={18} color={colors.onPrimary} />
            <View style={styles.actionCopy}>
              <Text style={styles.primaryActionTitle}>Photograph a wine list</Text>
              <Text style={styles.primaryActionSubtitle}>Get personal picks for dinner</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel="Start a new sommelier chat"
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.primary.ink} />
            <Text style={styles.secondaryActionText}>Start a new chat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  label: { ...typography.body.caption, color: colors.accent.ink, marginBottom: spacing.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    minHeight: 52,
  },
  input: {
    flex: 1,
    ...typography.body.regular,
    color: colors.neutral.ink,
    paddingVertical: spacing.sm,
  },
  send: { padding: spacing.xs },
  hint: { ...typography.body.caption, color: colors.neutral.inkTertiary, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryAction: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionCopy: { flex: 1 },
  primaryActionTitle: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  primaryActionSubtitle: {
    ...typography.body.small,
    color: colors.onPrimary,
    opacity: 0.82,
  },
  secondaryAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary.base,
    borderRadius: borderRadius.lg,
  },
  secondaryActionText: {
    ...typography.body.regular,
    color: colors.primary.ink,
    fontWeight: '700',
  },
});
return { colors, styles };
});
