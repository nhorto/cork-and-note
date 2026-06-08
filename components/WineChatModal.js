// components/WineChatModal.js
// Half-sheet modal (~65% height) with mini chat for wine identification
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import { aiService } from '../lib/ai';
import { chatService } from '../lib/chat';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.65;

export default function WineChatModal({ visible, onClose, onUseSuggestions, existingConversationId, currentWineData }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(null);
  const flatListRef = useRef(null);

  // Initialize when modal opens
  useEffect(() => {
    if (visible) {
      init();
    } else {
      // Reset when closed
      setConversation(null);
      setMessages([]);
    }
  }, [visible]);

  const init = async () => {
    try {
      setLoading(true);

      // Build system prompt with current wine form context
      let prompt = await aiService.buildSystemPrompt();

      if (currentWineData) {
        let formContext = '\n\nThe user is currently logging a wine. Here is what they have filled in so far on the form:';
        const d = currentWineData;
        if (d.name) formContext += `\n- Wine Name: ${d.name}`;
        formContext += `\n- Wine Type: ${d.type || 'Red (default)'}`;
        if (d.varietal) formContext += `\n- Varietal: ${d.varietal}`;
        if (d.year) formContext += `\n- Year: ${d.year}`;
        if (d.overallRating > 0) formContext += `\n- Overall Rating: ${d.overallRating}/5`;
        const nonZeroRatings = Object.entries(d.ratings || {}).filter(([_, v]) => v > 0);
        if (nonZeroRatings.length > 0) {
          formContext += '\n- Detailed Ratings: ' + nonZeroRatings.map(([k, v]) => `${k}: ${v}/5`).join(', ');
        }
        if (d.flavorNotes?.length > 0) formContext += `\n- Flavor Notes: ${d.flavorNotes.join(', ')}`;
        if (d.additionalNotes) formContext += `\n- Notes: "${d.additionalNotes}"`;
        if (d.photoCount > 0) formContext += `\n- Photos: ${d.photoCount} photo(s) attached to the wine entry`;

        const hasAnyData = d.name || d.varietal || d.year || d.overallRating > 0 || nonZeroRatings.length > 0 || d.flavorNotes?.length > 0 || d.additionalNotes;
        if (!hasAnyData) {
          formContext += '\n- (Nothing filled in yet — the form is mostly blank)';
        }

        formContext += '\n\nUse this context to give relevant, specific help. If they have ratings, comment on those. If the form is blank, help them get started. Always offer to help fill in any missing fields.';
        prompt += formContext;
      }

      setSystemPrompt(prompt);

      if (existingConversationId) {
        // Resume existing conversation
        const conv = await chatService.getConversation(existingConversationId);
        setConversation(conv);
        const msgs = await chatService.getMessages(existingConversationId);
        setMessages(msgs.map(m => ({
          ...m,
          displayText: m.role === 'assistant' ? aiService.getDisplayText(m.content) : m.content,
        })));
      } else {
        // Don't create conversation yet — wait until first message is sent
        setConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('WineChatModal init error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = useCallback(async (text, photos = []) => {
    setSending(true);
    try {
      // Create conversation on first message (lazy creation)
      let activeConv = conversation;
      if (!activeConv) {
        activeConv = await chatService.createConversation('wine_entry');
        setConversation(activeConv);
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
      const previousMsgs = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      const aiMessages = [...previousMsgs, currentMsg];

      // Call AI
      const aiResponse = await aiService.sendMessage(aiMessages, systemPrompt);
      const responseText = aiResponse.response;
      const suggestions = aiService.parseSuggestions(responseText);
      const displayText = aiService.getDisplayText(responseText);

      // Save AI message
      const aiMsg = await chatService.addMessage(
        activeConv.id, 'assistant', responseText, [], suggestions
      );

      setMessages(prev => [...prev, { ...aiMsg, displayText }]);
    } catch (err) {
      console.error('WineChatModal send error:', err);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, something went wrong: ${err.message}`,
        displayText: `Sorry, something went wrong: ${err.message}`,
        image_urls: [],
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }, [conversation, messages, systemPrompt]);

  const handleUseSuggestions = useCallback((suggestions) => {
    if (onUseSuggestions) {
      onUseSuggestions(suggestions);
    }
  }, [onUseSuggestions]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="wine" size={18} color={colors.primary.burgundy} />
              <Text style={styles.headerTitle}>Ask the Sommelier</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.neutral.graphite} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {/* Messages */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary.burgundy} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Snap a photo of a wine label or describe what you're tasting — I'll help identify it and fill in the details.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ChatBubble
                  message={item}
                  onUseSuggestions={item.ai_suggestions ? handleUseSuggestions : undefined}
                />
              )}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Typing indicator */}
          {sending && (
            <View style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <Text style={styles.typingText}>Thinking...</Text>
              </View>
            </View>
          )}

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={sending} />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 44, 0.4)',
  },
  modalContainer: {
    height: MODAL_HEIGHT,
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.strong,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral.stone,
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
    color: colors.neutral.charcoal,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  closeButton: {
    padding: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gold.muted,
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
    color: colors.neutral.pewter,
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
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
  typingText: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    fontStyle: 'italic',
  },
});
