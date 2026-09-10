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
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function AskSommelierBox({ onAsk, onOpen }) {
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
          selectionColor={colors.primary.base}
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
            color={colors.primary.base}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Pairings, plain-words wine questions, or what to open from your cellar.</Text>
    </View>
  );
}

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
});
