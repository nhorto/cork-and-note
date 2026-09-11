// components/WineChatModal.js
// Full-screen mini chat for wine identification and tasting-form assistance.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import MeterHint from './MeterHint';
import TypingDots from './TypingDots';
import { usePro } from '../hooks/usePro';
import { aiService } from '../lib/ai';
import { chatService } from '../lib/chat';
import { buildSommelierPrompt } from '../lib/sommelierPrompt';
import { buildWineEntryAssistantPrompt, protectWineEntrySuggestions } from '../lib/wineEntryAssistant';
import { createThemedStyles } from '../styles/ThemeProvider';

export default function WineChatModal({ visible, onClose, onUseSuggestions, onConversationStarted, onDismiss, existingConversationId, currentWineData }) {
  const { colors, styles } = useScreenTheme();
  const insets = useSafeAreaInsets();

  const { gate, isPro, presentPaywall } = usePro();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(null);
  const flatListRef = useRef(null);
  // Re-entry guard for handleSend: `sending` state updates async, so two rapid
  // taps could both see conversation === null and create two conversations.
  const sendingRef = useRef(false);

  // Initialize when modal opens. The cleanup flag cancels a stale init so a
  // rapid close/reopen can't land old setState calls after the reset.
  useEffect(() => {
    if (visible) {
      let active = true;
      init(() => active);
      return () => {
        active = false;
      };
    } else {
      // Reset when closed
      setConversation(null);
      setMessages([]);
    }
  }, [visible]);

  const init = async (isActive) => {
    try {
      if (isActive()) setLoading(true);

      // The form-specific contract tells the model that structured suggestions
      // are an actual UI action. Without it, models often reply that they cannot
      // edit the form even though this surface is built to do exactly that.
      let basePrompt = '';
      try {
        basePrompt = await aiService.buildSystemPrompt();
      } catch (err) {
        // Journal/cellar context is helpful, but the form action must still be
        // usable if that background lookup is temporarily unavailable.
        console.error('WineChatModal context error:', err);
        basePrompt = buildSommelierPrompt();
      }
      const prompt = buildWineEntryAssistantPrompt(basePrompt, currentWineData);

      if (isActive()) setSystemPrompt(prompt);

      if (existingConversationId) {
        // Resume existing conversation
        const conv = await chatService.getConversation(existingConversationId);
        if (isActive()) setConversation(conv);
        const msgs = await chatService.getMessages(existingConversationId);
        if (isActive()) {
          let precedingUserText = '';
          let precedingUserHasPhotos = false;
          setMessages(msgs.map((m) => {
            if (m.role === 'user') {
              precedingUserText = m.content || '';
              precedingUserHasPhotos = Array.isArray(m.image_urls) && m.image_urls.length > 0;
            }
            const safeSuggestions = m.role === 'assistant'
              ? protectWineEntrySuggestions(m.ai_suggestions, currentWineData, precedingUserText, { hasPhotos: precedingUserHasPhotos })
              : m.ai_suggestions;
            return {
              ...m,
              ai_suggestions: safeSuggestions,
              displayText: m.role === 'assistant' ? aiService.getDisplayText(m.content) : m.content,
            };
          }));
        }
      } else if (isActive()) {
        // Don't create conversation yet — wait until first message is sent
        setConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('WineChatModal init error:', err);
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  const handleSend = useCallback(async (text, photos = []) => {
    if (sendingRef.current) return;
    // The second sommelier surface (#121). It spends the same 5/month chat meter
    // as the Sommelier tab, so it needs the same gate — walling only one of them
    // would just move the surprise.
    if (!gate('chat')) return;
    sendingRef.current = true;
    setSending(true);
    setReceiving(false);
    const streamMessageId = `stream-${Date.now()}`;
    let streamStarted = false;
    try {
      // Create conversation on first message (lazy creation)
      let activeConv = conversation;
      if (!activeConv) {
        activeConv = await chatService.createConversation('wine_entry');
        setConversation(activeConv);
        // Report the new conversation id up so the parent can resume THIS same
        // thread if the user closes and reopens the chat during logging (#121).
        onConversationStarted?.(activeConv.id);
      }

      // Convert photos to base64 for AI
      let base64Images = [];
      for (const uri of photos) {
        const result = await aiService.photoToBase64(uri);
        if (result) base64Images.push(result);
      }

      // Upload photos to storage for display (in parallel)
      let imageUrls = [];
      if (photos.length > 0) {
        const uploadPromises = photos.map(uri => chatService.uploadChatPhoto(uri));
        imageUrls = (await Promise.all(uploadPromises)).filter(Boolean);
      }

      // Save user message to DB
      const userMsg = await chatService.addMessage(activeConv.id, 'user', text, imageUrls);
      const displayUserMsg = { ...userMsg, displayText: text };
      setMessages(prev => [...prev, displayUserMsg]);

      // Auto-title on first message
      if (messages.length === 0 && text) {
        const title = chatService.generateTitle(text);
        await chatService.updateConversationTitle(activeConv.id, title);
      }

      // Build messages for AI — base64 images sent directly
      const currentMsg = {
        role: 'user',
        content: text,
        images: base64Images,
      };
      // Local error bubbles are UI-only — never replay them to the AI as history.
      const previousMsgs = messages
        .filter(m => !m.isLocalError)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      const aiMessages = [...previousMsgs, currentMsg];

      // Use the same real streaming transport as the main Sommelier chat. The
      // structured suggestions are still parsed and made actionable only after
      // the complete response arrives.
      const aiResponse = await aiService.sendMessageStream(aiMessages, systemPrompt, {
        onDelta: (textSoFar) => {
          setReceiving(true);
          setMessages((previous) => {
            const streamingMessage = {
              id: streamMessageId,
              role: 'assistant',
              content: textSoFar,
              displayText: textSoFar,
              image_urls: [],
              created_at: new Date().toISOString(),
              isStreaming: true,
            };
            if (!streamStarted) {
              streamStarted = true;
              return [...previous, streamingMessage];
            }
            return previous.map((message) =>
              message.id === streamMessageId ? streamingMessage : message
            );
          });
        },
      });
      const responseText = aiResponse.response;
      const suggestions = protectWineEntrySuggestions(
        aiService.parseSuggestions(responseText),
        currentWineData,
        text,
        { hasPhotos: base64Images.length > 0 }
      );
      const displayText = aiService.getDisplayText(responseText);

      // Save AI message
      const aiMsg = await chatService.addMessage(
        activeConv.id, 'assistant', responseText, [], suggestions, aiResponse.sources || []
      );

      const savedMessage = {
        ...aiMsg,
        // Use the locally protected value even if a database mock/older schema
        // returns the inserted row without ai_suggestions.
        ai_suggestions: suggestions,
        displayText,
        sources: aiResponse.sources || [],
      };
      setMessages((previous) =>
        streamStarted
          ? previous.map((message) => message.id === streamMessageId ? savedMessage : message)
          : [...previous, savedMessage]
      );
    } catch (err) {
      console.error('WineChatModal send error:', err);
      setMessages((previous) => [...(
        streamStarted
          ? previous.filter((message) => message.id !== streamMessageId)
          : previous
      ), {
        id: `error-${Date.now()}`,
        role: 'assistant',
        // Synthetic, client-only bubble — flagged so it's filtered out of the
        // history sent to the AI on the next message.
        isLocalError: true,
        content: `Sorry, something went wrong: ${err.message}`,
        displayText: `Sorry, something went wrong: ${err.message}`,
        image_urls: [],
        created_at: new Date().toISOString(),
      }]);
    } finally {
      sendingRef.current = false;
      setReceiving(false);
      setSending(false);
    }
  }, [conversation, messages, systemPrompt, currentWineData, onConversationStarted, gate]);

  const handleUseSuggestions = useCallback((suggestions) => {
    if (onUseSuggestions) {
      onUseSuggestions(suggestions);
    }
  }, [onUseSuggestions]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="wine" size={18} color={colors.primary.ink} />
              <Text style={styles.headerTitle}>Ask the sommelier</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.neutral.inkSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {/* Messages */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary.ink} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Snap a photo of a wine label or describe what you&apos;re tasting — I&apos;ll help identify it and fill in the details.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <ChatBubble
                  message={item}
                  onUseSuggestions={item.ai_suggestions ? handleUseSuggestions : undefined}
                  // Preceding user prompt, for AI-response reports (see ChatBubble).
                  reportContext={
                    index > 0 && messages[index - 1].role === 'user'
                      ? messages[index - 1].content
                      : null
                  }
                />
              )}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Typing indicator */}
          {sending && !receiving && (
            <View style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <TypingDots />
              </View>
            </View>
          )}

          {/* Input */}
          <MeterHint task="chat" style={styles.meterHint} />
          <ChatInput
            onSend={handleSend}
            // Do not let a fast tap race prompt construction. A send with a
            // null prompt falls back to general chat and loses the form-action
            // contract, which was the intermittent "I can't fill that" bug.
            disabled={sending || loading || !systemPrompt}
            photosLocked={!isPro}
            onLockedPhotoPress={() => presentPaywall('chat')}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

const styles = StyleSheet.create({
  meterHint: {
    paddingHorizontal: spacing.md,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  closeButton: {
    // 44pt minimum touch target (launch plan §3.3)
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.accent.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typingBubble: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
});
return { colors, styles };
});
