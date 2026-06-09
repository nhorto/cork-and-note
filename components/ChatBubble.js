// components/ChatBubble.js
// Chat message bubble - burgundy for user, parchment for AI
// AI messages render markdown, user messages render plain text
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { chatService } from '../lib/chat';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

// Markdown styles for AI messages (Château Label theme)
const mdStyles = {
  body: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '700',
    color: colors.neutral.charcoal,
  },
  em: {
    fontStyle: 'italic',
  },
  heading1: {
    ...typography.heading.h2,
    color: colors.primary.burgundy,
    fontFamily: 'Georgia',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  heading2: {
    ...typography.heading.h3,
    color: colors.primary.burgundy,
    fontFamily: 'Georgia',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  heading3: {
    ...typography.body.large,
    fontWeight: '600',
    color: colors.primary.burgundy,
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
    color: colors.gold.rich,
    fontSize: 14,
    lineHeight: 22,
    marginRight: spacing.xs,
  },
  ordered_list_icon: {
    color: colors.gold.shimmer,
    fontSize: 14,
    lineHeight: 22,
    marginRight: spacing.xs,
  },
  code_inline: {
    backgroundColor: colors.neutral.linen,
    color: colors.primary.merlot,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
    fontFamily: 'Courier',
  },
  fence: {
    backgroundColor: colors.neutral.linen,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold.rich,
    paddingLeft: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  hr: {
    backgroundColor: colors.gold.muted,
    height: 1,
    marginVertical: spacing.sm,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  link: {
    color: colors.primary.burgundy,
    textDecorationLine: 'underline',
  },
};

export default function ChatBubble({ message, onUseSuggestions }) {
  const isUser = message.role === 'user';
  const hasSuggestions = message.ai_suggestions && Object.keys(message.ai_suggestions).length > 0;
  const displayContent = message.displayText || message.content;

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
          <Ionicons name="wine" size={16} color={colors.primary.burgundy} />
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

        {/* Use Suggestions button */}
        {hasSuggestions && onUseSuggestions && (
          <TouchableOpacity
            style={styles.suggestionsButton}
            onPress={() => onUseSuggestions(message.ai_suggestions)}
          >
            <Ionicons name="sparkles" size={14} color={colors.gold.rich} />
            <Text style={styles.suggestionsButtonText}>Use Suggestions</Text>
          </TouchableOpacity>
        )}

        {/* Timestamp */}
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

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
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.gold.muted,
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
    backgroundColor: colors.primary.burgundy,
    borderBottomRightRadius: borderRadius.sm,
  },
  aiBubble: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderBottomLeftRadius: borderRadius.sm,
  },
  text: {
    ...typography.body.regular,
    lineHeight: 22,
  },
  userText: {
    color: colors.neutral.cream,
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
    borderColor: colors.neutral.stone,
  },
  suggestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.cream,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    alignSelf: 'flex-start',
  },
  suggestionsButtonText: {
    ...typography.body.small,
    color: colors.gold.shimmer,
    fontWeight: '600',
  },
  timestamp: {
    ...typography.body.caption,
    marginTop: spacing.xs,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 10,
  },
  userTimestamp: {
    color: colors.primary.rosé,
    textAlign: 'right',
  },
  aiTimestamp: {
    color: colors.neutral.pewter,
  },
});
