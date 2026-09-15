// components/AiNotice.js
// One line under every non-chat AI result: the "this is AI and can be wrong"
// disclaimer plus a Report affordance that opens ReportAiResponseModal.
// Chat bubbles carry their own flag (ChatBubble.js); every other surface that
// renders generated text (Tonight's Pick, bottle pairings, the taste report,
// wine-list picks, the wine-day notes) uses this so that flagging is possible
// in-app for all AI output, not just the chat.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createThemedStyles } from '../styles/ThemeProvider';
import ReportAiResponseModal from './ReportAiResponseModal';

export default function AiNotice({
  content,
  context = null,
  text = 'AI suggestion. It can be wrong; trust your own taste.',
  style,
}) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const serialized = typeof content === 'string' ? content : content == null ? '' : JSON.stringify(content);
  const reportable = serialized.length > 0;
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.text}>{text}</Text>
      {reportable ? (
        <TouchableOpacity
          style={styles.button}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Report this AI response"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="flag-outline" size={13} color={colors.neutral.inkTertiary} />
          <Text style={styles.buttonText}>Report</Text>
        </TouchableOpacity>
      ) : null}
      {reportable ? (
        <ReportAiResponseModal
          visible={open}
          messageContent={serialized}
          context={context}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

const useTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing } = theme;
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: spacing.sm,
      marginTop: spacing.md,
    },
    text: {
      ...typography.body.small,
      color: colors.neutral.inkTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    button: { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
    buttonText: { ...typography.body.small, color: colors.neutral.inkTertiary },
  });
  return { colors, styles };
});
