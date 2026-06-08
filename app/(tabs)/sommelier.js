// app/(tabs)/sommelier.js
// AI Wine Sommelier - conversation list ↔ active chat
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ChatBubble from '../../components/ChatBubble';
import ChatInput from '../../components/ChatInput';
import ConversationList from '../../components/ConversationList';
import { aiService } from '../../lib/ai';
import { chatService } from '../../lib/chat';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

export default function SommelierScreen() {
  // State
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(null);
  const flatListRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    // Pre-build system prompt
    aiService.buildSystemPrompt().then(setSystemPrompt).catch(console.error);
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = useCallback(async (conversation) => {
    try {
      setActiveConversation(conversation);
      setView('chat');
      setLoading(true);

      const msgs = await chatService.getMessages(conversation.id);
      // Add display text for AI messages (strip suggestion blocks)
      const processed = msgs.map(m => ({
        ...m,
        displayText: m.role === 'assistant' ? aiService.getDisplayText(m.content) : m.content,
      }));
      setMessages(processed);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      const conversation = await chatService.createConversation('general');
      setActiveConversation(conversation);
      setMessages([]);
      setView('chat');
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  }, []);

  const goBackToList = useCallback(() => {
    setView('list');
    setActiveConversation(null);
    setMessages([]);
    loadConversations();
  }, []);

  const handleDeleteConversation = useCallback(async (id) => {
    try {
      await chatService.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, []);

  const handleSend = useCallback(async (text, photos = []) => {
    if (!activeConversation) return;

    setSending(true);
    try {
      // Convert photos to base64 for AI (do this first, before upload)
      let base64Images = [];
      for (const uri of photos) {
        const result = await aiService.photoToBase64(uri);
        if (result) base64Images.push(result);
      }

      // Upload photos to storage for display/persistence (in parallel)
      let imageUrls = [];
      if (photos.length > 0) {
        const uploadPromises = photos.map(uri => chatService.uploadChatPhoto(uri));
        imageUrls = (await Promise.all(uploadPromises)).filter(Boolean);
      }

      // Save user message to DB (with storage URLs for display)
      const userMsg = await chatService.addMessage(
        activeConversation.id,
        'user',
        text,
        imageUrls
      );
      const displayUserMsg = { ...userMsg, displayText: text };
      setMessages(prev => [...prev, displayUserMsg]);

      // Auto-title on first message
      if (messages.length === 0 && text) {
        const title = chatService.generateTitle(text);
        await chatService.updateConversationTitle(activeConversation.id, title);
        setActiveConversation(prev => ({ ...prev, title }));
      }

      // Build messages array for AI — send base64 images directly, not URLs
      const currentMsg = {
        role: 'user',
        content: text,
        images: base64Images, // base64 images go straight to Claude
      };

      // Previous messages are text-only (images already seen by AI)
      const previousMsgs = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const aiMessages = [...previousMsgs, currentMsg];

      // Call AI
      const aiResponse = await aiService.sendMessage(aiMessages, systemPrompt);
      const responseText = aiResponse.response;

      // Parse suggestions
      const suggestions = aiService.parseSuggestions(responseText);
      const displayText = aiService.getDisplayText(responseText);

      // Save AI message
      const aiMsg = await chatService.addMessage(
        activeConversation.id,
        'assistant',
        responseText,
        [],
        suggestions
      );

      setMessages(prev => [...prev, { ...aiMsg, displayText }]);
    } catch (err) {
      console.error('Send error:', err);
      // Add error message locally
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        displayText: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        image_urls: [],
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }, [activeConversation, messages, systemPrompt]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ─── Render ─────────────────────────────────────────────

  if (view === 'list') {
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sommelier</Text>
          <Text style={styles.headerSubtitle}>Your Wine Companion</Text>
        </View>
        <View style={styles.divider} />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.burgundy} />
          </View>
        ) : (
          <ConversationList
            conversations={conversations}
            onSelect={openConversation}
            onDelete={handleDeleteConversation}
            onNewChat={startNewChat}
          />
        )}
      </SafeAreaView>
    );
  }

  // Chat view
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={goBackToList} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary.burgundy} />
        </TouchableOpacity>
        <View style={styles.chatHeaderContent}>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>
            {activeConversation?.title || 'New Conversation'}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.burgundy} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChatState}>
            <View style={styles.sommelierIcon}>
              <Ionicons name="wine" size={32} color={colors.primary.burgundy} />
            </View>
            <Text style={styles.emptyChatTitle}>Bonjour!</Text>
            <Text style={styles.emptyChatSubtitle}>
              I'm your personal wine sommelier. Ask me about wines, grape varieties, food pairings, or snap a photo of a wine label for identification.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Typing indicator */}
        {sending && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={sending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerSubtitle: {
    ...typography.body.small,
    color: colors.gold.shimmer,
    fontStyle: 'italic',
    marginTop: 2,
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

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  chatHeaderContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  chatHeaderTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },

  // Chat area
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingVertical: spacing.md,
  },

  // Empty chat state
  emptyChatState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  sommelierIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 2,
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyChatTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  emptyChatSubtitle: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Typing indicator
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
  },
  typingBubble: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginLeft: 36, // account for avatar space
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral.pewter,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
});
