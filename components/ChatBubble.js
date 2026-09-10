// components/ChatBubble.js
// Chat message bubble - primary.base for user, neutral.surface for AI
// AI messages render markdown, user messages render plain text
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { chatService } from '../lib/chat';
import { createThemedStyles } from '../styles/ThemeProvider';
import ReportAiResponseModal from './ReportAiResponseModal';


// Markdown styles for AI messages (Château Label theme)


// The chip label for a source. The hostname, not the page title: "vawine.org"
// tells you at a glance whether the sommelier read the winery's own site or a
// stranger's blog, and it fits on one line where a title never does. Parsed with
// a regex rather than `new URL()` — Hermes' URL support has been partial.
function sourceLabel(url) {
  const match = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url || '');
  return match ? match[1] : url;
}

// `reportContext` is the user prompt that preceded this reply, when the
// parent list had it handy — it rides along on the report so the owner can
// judge the reply against the question it answered.
export default function ChatBubble({ message, onUseSuggestions, reportContext = null }) {
  const { colors, mdStyles, styles } = useScreenTheme();

  const isUser = message.role === 'user';
  const hasSuggestions = message.ai_suggestions && Object.keys(message.ai_suggestions).length > 0;
  const displayContent = message.displayText || message.content;
  // Report flag: real assistant replies only. Local error bubbles (synthetic,
  // client-made) aren't AI content — nothing there for anyone to review.
  const reportable =
    !isUser && !message.isLocalError && !String(message.id ?? '').startsWith('error-');
  const [reportOpen, setReportOpen] = useState(false);
  // Pages the Pro web search leaned on. Present only on a live reply — they are
  // not persisted with the message, so reopening an old chat shows none.
  const sources = Array.isArray(message.sources) ? message.sources : [];

  // chat-photos is a private bucket — resolve stored paths to short-lived signed
  // URLs for display (handles both new path-based rows and legacy public URLs).
  const [imageUrls, setImageUrls] = useState([]);
  useEffect(() => {
    let active = true;
    const raw = message.image_urls || [];
    if (raw.length === 0) {
      setImageUrls([]);
      return;
    }
    chatService
      .getSignedUrls(raw)
      .then((urls) => {
        if (active) setImageUrls(urls.filter(Boolean));
      })
      .catch(() => {
        if (active) setImageUrls([]);
      });
    return () => {
      active = false;
    };
  }, [message.image_urls]);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {/* AI avatar */}
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="wine" size={16} color={colors.primary.ink} />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {/* Image thumbnails */}
        {imageUrls.length > 0 && (
          <View style={styles.imageRow}>
            {imageUrls.map((url, idx) => (
              <Image key={idx} source={{ uri: url }} style={styles.imageThumbnail} />
            ))}
          </View>
        )}

        {/* Message content */}
        {isUser ? (
          <Text style={[styles.text, styles.userText]}>{displayContent}</Text>
        ) : (
          <Markdown style={mdStyles}>{displayContent}</Markdown>
        )}

        {/* Sources — what the sommelier actually read, so a claim about a
            specific bottle can be checked rather than taken on faith. */}
        {!isUser && sources.length > 0 && (
          <View style={styles.sources}>
            <Text style={styles.sourcesLabel}>Sources</Text>
            <View style={styles.sourceChips}>
              {sources.map((source) => (
                <TouchableOpacity
                  key={source.url}
                  style={styles.sourceChip}
                  onPress={() => Linking.openURL(source.url).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel={source.title || sourceLabel(source.url)}
                >
                  <Ionicons name="globe-outline" size={11} color={colors.accent.ink} />
                  <Text style={styles.sourceChipText} numberOfLines={1}>
                    {sourceLabel(source.url)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Use Suggestions button */}
        {hasSuggestions && onUseSuggestions && (
          <TouchableOpacity
            style={styles.suggestionsButton}
            onPress={() => onUseSuggestions(message.ai_suggestions)}
          >
            <Ionicons name="sparkles" size={14} color={colors.accent.base} />
            <Text style={styles.suggestionsButtonText}>Use Suggestions</Text>
          </TouchableOpacity>
        )}

        {/* Timestamp — with a discreet report flag on AI replies (Google Play
            AI-content policy: flagging must be possible in-app, per response). */}
        {isUser ? (
          <Text style={[styles.timestamp, styles.userTimestamp]}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : (
          <View style={styles.footerRow}>
            <Text style={[styles.timestamp, styles.aiTimestamp, styles.footerTimestamp]}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {reportable && (
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => setReportOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Report this response"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flag-outline" size={13} color={colors.neutral.inkTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {reportable && (
        <ReportAiResponseModal
          visible={reportOpen}
          messageContent={message.content}
          context={reportContext}
          onClose={() => setReportOpen(false)}
        />
      )}
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius, shadows } = theme;

const SERIF = typography.fonts.serif;

const mdStyles = {
  body: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '700',
    color: colors.neutral.ink,
  },
  em: {
    fontStyle: 'italic',
  },
  heading1: {
    ...typography.heading.h2,
    color: colors.primary.ink,
    fontFamily: SERIF,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  heading2: {
    ...typography.heading.h3,
    color: colors.primary.ink,
    fontFamily: SERIF,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  heading3: {
    ...typography.body.large,
    fontWeight: '600',
    color: colors.primary.ink,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  bullet_list: {
    marginVertical: spacing.xs,
  },
  ordered_list: {
    marginVertical: spacing.xs,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: colors.accent.ink,
    fontSize: 14,
    lineHeight: 22,
    marginRight: spacing.xs,
  },
  ordered_list_icon: {
    color: colors.accent.ink,
    fontSize: 14,
    lineHeight: 22,
    marginRight: spacing.xs,
  },
  code_inline: {
    backgroundColor: colors.neutral.divider,
    color: colors.primary.ink,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
    fontFamily: 'Courier',
  },
  fence: {
    backgroundColor: colors.neutral.divider,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.base,
    paddingLeft: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  hr: {
    backgroundColor: colors.accent.border,
    height: 1,
    marginVertical: spacing.sm,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  link: {
    color: colors.primary.ink,
    textDecorationLine: 'underline',
  },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    marginTop: spacing.xs,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  userBubble: {
    backgroundColor: colors.primary.base,
    borderBottomRightRadius: borderRadius.sm,
  },
  aiBubble: {
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderBottomLeftRadius: borderRadius.sm,
  },
  text: {
    ...typography.body.regular,
    lineHeight: 22,
  },
  userText: {
    color: colors.onPrimary,
  },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  imageThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  sources: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  sourcesLabel: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginBottom: spacing.xs,
  },
  sourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.accent.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  sourceChipText: {
    ...typography.body.small,
    color: colors.accent.ink,
    flexShrink: 1,
  },
  suggestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.bg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignSelf: 'flex-start',
  },
  suggestionsButtonText: {
    ...typography.body.small,
    color: colors.accent.ink,
    fontWeight: '600',
  },
  timestamp: {
    ...typography.body.caption,
    marginTop: spacing.xs,
    textTransform: 'none',
    letterSpacing: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  footerTimestamp: {
    marginTop: 0,
  },
  reportButton: {
    padding: 2,
  },
  userTimestamp: {
    color: colors.journey.secondary,
    textAlign: 'right',
  },
  aiTimestamp: {
    color: colors.neutral.inkTertiary,
  },
});
return { colors, mdStyles, styles };
});
