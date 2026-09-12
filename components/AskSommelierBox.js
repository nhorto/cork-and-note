// components/AskSommelierBox.js — the one way to start talking to the sommelier.
//
// A single surface, used on Home and as the Sommelier tab's hero: a real text
// input with a send button, and an optional row of quick chips underneath.
// There is deliberately no separate "Start a new chat" button (owner feedback
// 2026-09-12: the input IS the new chat). Sending with text asks; sending with
// nothing typed just opens a blank conversation.
//
// Chips come in two kinds. A chip with `prefill` drops a half-written question
// into the input and focuses it, so the user finishes the sentence instead of
// spending a metered message on a generic prompt. A chip with `onPress` is a
// plain shortcut (a guided tool, a route). Free-tier metering is enforced in
// the tab and on the server, not here: this box is an entrance, not a gate.
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function AskSommelierBox({
  onAsk,
  onOpen,
  chips = [],
  placeholder = 'Ask anything about wine',
  autoFocus = false,
  style,
}) {
  const { colors, styles } = useScreenTheme();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  const submit = () => {
    const question = text.trim();
    if (!question) {
      onOpen?.();
      return;
    }
    setText('');
    onAsk?.(question);
  };

  const pressChip = (chip) => {
    if (chip.prefill) {
      setText(chip.prefill);
      inputRef.current?.focus();
      return;
    }
    chip.onPress?.();
  };

  return (
    <View style={[styles.box, style]}>
      <View style={styles.inputRow}>
        <Ionicons name="sparkles" size={18} color={colors.accent.strong} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.placeholder}
          selectionColor={colors.primary.ink}
          returnKeyType="send"
          autoFocus={autoFocus}
          onSubmitEditing={submit}
          accessibilityLabel="Ask your sommelier a question"
        />
        <TouchableOpacity
          onPress={submit}
          style={[styles.send, hasText ? styles.sendActive : styles.sendIdle]}
          accessibilityRole="button"
          accessibilityLabel={hasText ? 'Send question' : 'Open the sommelier'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={hasText ? 'arrow-up' : 'arrow-forward'}
            size={18}
            color={hasText ? colors.onPrimary : colors.primary.ink}
          />
        </TouchableOpacity>
      </View>

      {chips.length > 0 ? (
        <>
          <View style={styles.divider} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={styles.chip}
                onPress={() => pressChip(chip)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={chip.accessibilityLabel || chip.label}
                testID={chip.testID}
              >
                {chip.icon ? (
                  <Ionicons name={chip.icon} size={14} color={colors.primary.ink} />
                ) : null}
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;

  const styles = StyleSheet.create({
    box: {
      backgroundColor: colors.neutral.surface,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: borderRadius.lg,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      minHeight: 56,
    },
    input: {
      flex: 1,
      ...typography.body.regular,
      color: colors.neutral.ink,
      paddingVertical: spacing.sm,
    },
    send: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendIdle: { backgroundColor: colors.primary.surface },
    sendActive: { backgroundColor: colors.primary.base },
    divider: {
      height: 1,
      backgroundColor: colors.neutral.divider,
      marginHorizontal: spacing.md,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 32,
      paddingHorizontal: spacing.sm + 4,
      borderRadius: borderRadius.round,
      backgroundColor: colors.primary.surface,
    },
    chipText: {
      ...typography.body.small,
      fontWeight: '600',
      color: colors.primary.ink,
    },
  });
  return { colors, styles };
});
