// app/(tabs)/sommelier.js
// AI Wine Sommelier - conversation list ↔ active chat
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ChatBubble from '../../components/ChatBubble';
import ChatInput from '../../components/ChatInput';
import MeterHint from '../../components/MeterHint';
import ScreenHeader from '../../components/ScreenHeader';
import TonightsPickCard from '../../components/TonightsPickCard';
import TypingDots from '../../components/TypingDots';
import { usePro } from '../../hooks/usePro';
import { aiService } from '../../lib/ai';
import { chatService } from '../../lib/chat';
import { createThemedStyles } from '../../styles/ThemeProvider';


// Compact relative date for the recent-chats list.
function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// A single recent-conversation row. Local to this screen so the list can live
// inside the same ScrollView as the "Tonight's pick" hero without nesting a
// FlatList in a ScrollView.
function ConversationRow({ conversation, onPress, onDelete }) {
  const { colors, styles } = useScreenTheme();

  const contextIcon =
    conversation.context_type === 'wine_entry' ? 'wine' : 'chatbubbles';
  const handleLongPress = () => {
    Alert.alert('Delete Conversation', `Delete "${conversation.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(conversation.id),
      },
    ]);
  };
  return (
    <TouchableOpacity
      style={styles.convItem}
      onPress={() => onPress(conversation)}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.convIcon}>
        <Ionicons name={contextIcon} size={20} color={colors.primary.ink} />
      </View>
      <View style={styles.convContent}>
        <Text style={styles.convTitle} numberOfLines={1}>
          {conversation.title}
        </Text>
        <Text style={styles.convMeta}>
          {conversation.context_type === 'wine_entry' ? 'Wine entry' : 'Chat'}
          {' · '}
          {formatRelativeDate(conversation.updated_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.neutral.placeholder} />
    </TouchableOpacity>
  );
}

export default function SommelierScreen() {
  const { colors, styles } = useScreenTheme();

  const { gate, isPro, presentPaywall } = usePro();
  const router = useRouter();
  // State
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(null);
  // True only when the active conversation genuinely has no messages (a new
  // chat, or one whose history loaded empty). Gates the auto-title on first
  // send so a failed history load can't re-title an existing conversation.
  const [loadedEmpty, setLoadedEmpty] = useState(false);
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
      setLoadedEmpty(processed.length === 0);
    } catch (err) {
      console.error('Failed to load messages:', err);
      Alert.alert('Error', 'Could not load this conversation. Please try again.');
      setView('list');
      setActiveConversation(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      const conversation = await chatService.createConversation('general');
      setActiveConversation(conversation);
      setMessages([]);
      setLoadedEmpty(true);
      setView('chat');
    } catch (err) {
      console.error('Failed to create conversation:', err);
      Alert.alert('Error', 'Could not start a new conversation. Please try again.');
    }
  }, []);

  const goBackToList = useCallback(() => {
    setView('list');
    setActiveConversation(null);
    setMessages([]);
    loadConversations();
  }, []);

  // Home's "Ask the sommelier" box hands its question over via ?ask=… (the
  // Tonight's Pick card left Home for this — owner feedback 2026-09-09).
  // Two steps on purpose: handleSend closes over activeConversation, so the
  // question is parked in state and fired only once the fresh conversation
  // has actually landed — calling handleSend right after startNewChat would
  // read the stale null conversation and silently drop the question.
  const params = useLocalSearchParams();
  const [pendingAsk, setPendingAsk] = useState(null);
  useEffect(() => {
    const ask = typeof params.ask === 'string' ? params.ask.trim() : '';
    if (!ask) return;
    router.setParams({ ask: undefined });
    setPendingAsk(ask);
    startNewChat();
  }, [params.ask]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingAsk || view !== 'chat' || !activeConversation) return;
    const question = pendingAsk;
    setPendingAsk(null);
    handleSend(question);
  }, [pendingAsk, view, activeConversation]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Free sommelier chat is metered (5/month, §4.2). Checked before the photo
    // uploads below, so a walled message costs the user neither bandwidth nor a
    // stored image they never got an answer to.
    if (!gate('chat')) return;

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

      // Auto-title on first message — only when the conversation genuinely
      // started empty, not when its history simply failed to load.
      if (loadedEmpty && messages.length === 0 && text) {
        const title = chatService.generateTitle(text);
        await chatService.updateConversationTitle(activeConversation.id, title);
        setActiveConversation(prev => ({ ...prev, title }));
        setLoadedEmpty(false);
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

      // `sources` rides along on the in-memory message only — the messages
      // table has no column for it, so they show for this reply and are gone on
      // reload. Worth persisting later; not worth a schema change to ship this.
      setMessages(prev => [...prev, { ...aiMsg, displayText, sources: aiResponse.sources || [] }]);
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
  }, [activeConversation, messages, systemPrompt, loadedEmpty, gate]);

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
      <View style={styles.safeArea}>
        {/* Somm tab root (flat-five bar, #203) — no back chevron.
            ScreenHeader handles the top inset itself. */}
        <ScreenHeader title="Sommelier" subtitle="Your wine companion" showBack={false} />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.ink} />
          </View>
        ) : (
          // Single scroll surface: the cellar-grounded "Tonight's pick" hero on
          // top, then past conversations. (#51 compact entry point.)
          <ScrollView
            contentContainerStyle={styles.listScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pickWrap}>
              <TonightsPickCard
                onRequireCellar={() => router.push('/cellar/add')}
              />
            </View>

            {/* New conversation */}
            <TouchableOpacity style={styles.newChatButton} onPress={startNewChat}>
              <Ionicons name="add-circle" size={20} color={colors.onPrimary} />
              <Text style={styles.newChatText}>New conversation</Text>
            </TouchableOpacity>

            {conversations.length === 0 ? (
              <View style={styles.listEmptyState}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={colors.neutral.border}
                />
                <Text style={styles.listEmptyTitle}>No conversations yet</Text>
                <Text style={styles.listEmptySubtitle}>
                  Ask your sommelier anything, or let it pick tonight&apos;s bottle above.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.recentLabel}>RECENT CHATS</Text>
                {conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    onPress={openConversation}
                    onDelete={handleDeleteConversation}
                  />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // Chat view
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={goBackToList}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary.ink} />
        </TouchableOpacity>
        <View style={styles.chatHeaderContent}>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>
            {activeConversation?.title || 'New conversation'}
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
            <ActivityIndicator size="large" color={colors.primary.ink} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChatState}>
            <View style={styles.sommelierIcon}>
              <Ionicons name="wine" size={32} color={colors.primary.ink} />
            </View>
            <Text style={styles.emptyChatTitle}>Bonjour!</Text>
            <Text style={styles.emptyChatSubtitle}>
              I&apos;m your personal wine sommelier. Ask me about wines, grape varieties, food pairings, or snap a photo of a wine label for identification.
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
              <TypingDots />
            </View>
          </View>
        )}

        {/* Input */}
        <MeterHint task="chat" style={styles.meterHint} />
        <ChatInput
          onSend={handleSend}
          disabled={sending}
          photosLocked={!isPro}
          onLockedPhotoPress={() => presentPaywall('chat')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius, shadows } = theme;

const styles = StyleSheet.create({
  meterHint: {
    paddingHorizontal: spacing.md,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.accent.border,
  },

  // List view (Tonight's pick + recent chats)
  listScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  pickWrap: {
    marginBottom: spacing.md,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.base,
    borderRadius: borderRadius.md,
    ...shadows.soft,
  },
  newChatText: {
    ...typography.body.regular,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  recentLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  convIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  convContent: { flex: 1 },
  convTitle: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  convMeta: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    marginTop: 2,
  },
  listEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  listEmptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: spacing.md,
  },
  listEmptySubtitle: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    // 44pt minimum touch target (launch plan §3.3)
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  chatHeaderTitle: {
    ...typography.heading.h3,
    color: colors.neutral.ink,
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
    backgroundColor: colors.neutral.surface,
    borderWidth: 2,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyChatTitle: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  emptyChatSubtitle: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
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
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginLeft: 36, // account for avatar space
  },
});
return { colors, styles };
});
