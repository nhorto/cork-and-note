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
import AskSommelierBox from '../../components/AskSommelierBox';
import ChatBubble from '../../components/ChatBubble';
import ChatInput from '../../components/ChatInput';
import MeterHint from '../../components/MeterHint';
import ProUpsellCard from '../../components/ProUpsellCard';
import ScreenHeader from '../../components/ScreenHeader';
import SommelierToolCard from '../../components/SommelierToolCard';
import TypingDots from '../../components/TypingDots';
import UpgradePill from '../../components/UpgradePill';
import { usePro } from '../../hooks/usePro';
import { aiService } from '../../lib/ai';
import { isPaywallError, meterHint } from '../../lib/pro';
import { chatService } from '../../lib/chat';
import { createThemedStyles } from '../../styles/ThemeProvider';

// Tapped inside a blank chat, these send as-is.
const STARTER_QUESTIONS = [
  'What wine goes with dinner tonight?',
  'Explain a wine I just tried',
  'Help me choose a bottle from my cellar',
];

// The hub's chips half-write the question and focus the input instead of
// sending, so a free user's metered message carries their actual dish, wine
// or mood rather than a generic prompt.
const STARTER_CHIPS = [
  { icon: 'restaurant-outline', label: 'Pair a dish', prefill: 'What wine pairs with ' },
  { icon: 'wine-outline', label: 'Explain a wine', prefill: 'Can you tell me about ' },
  { icon: 'help-circle-outline', label: 'Wine basics', prefill: 'In simple terms, what is ' },
];


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

  const { gate, isPro, remaining, presentPaywall } = usePro();
  const router = useRouter();
  // State
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
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

  // Leaving a conversation that never got a message discards it, so tapping
  // the ask box's idle arrow and backing out does not litter Recent chats with
  // "New Conversation" rows (seen on the sim 2026-09-12). The delete is not
  // awaited: the list reload below races it, so the row is filtered locally too.
  const goBackToList = useCallback(() => {
    const abandoned =
      loadedEmpty && messages.length === 0 && activeConversation?.id ? activeConversation.id : null;
    setView('list');
    setActiveConversation(null);
    setMessages([]);
    if (abandoned) {
      chatService.deleteConversation(abandoned).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== abandoned));
      loadConversations().then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== abandoned));
      });
      return;
    }
    loadConversations();
  }, [activeConversation, loadedEmpty, messages.length]);

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

  // The tab's own ask box (2026-09-11) rides the same two-step path as Home's.
  const askFromHub = useCallback(
    (question) => {
      setPendingAsk(question);
      startNewChat();
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
    setReceiving(false);
    const streamMessageId = `stream-${Date.now()}`;
    let streamStarted = false;
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

      // The shared chat entry point currently returns a complete response.
      // Keep the delta handler ready for the deferred backend streaming rollout.
      const aiResponse = await aiService.sendChatMessage(aiMessages, systemPrompt, {
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

      // Parse suggestions
      const suggestions = aiService.parseSuggestions(responseText);
      const displayText = aiService.getDisplayText(responseText);

      // Save AI message
      const aiMsg = await chatService.addMessage(
        activeConversation.id,
        'assistant',
        responseText,
        [],
        suggestions,
        aiResponse.sources || []
      );

      const savedMessage = { ...aiMsg, displayText, sources: aiResponse.sources || [] };
      setMessages((previous) =>
        streamStarted
          ? previous.map((message) => message.id === streamMessageId ? savedMessage : message)
          : [...previous, savedMessage]
      );
    } catch (err) {
      console.error('Send error:', err);
      if (streamStarted) {
        setMessages((previous) => previous.filter((message) => message.id !== streamMessageId));
      }
      // The server refused because the free meter is spent: that is a paywall,
      // not an error, and the user's message is already saved to the
      // conversation, so the answer is one tap away once they upgrade.
      if (isPaywallError(err)) {
        presentPaywall('chat');
        return;
      }
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
      setReceiving(false);
      setSending(false);
    }
  }, [activeConversation, messages, systemPrompt, loadedEmpty, gate, presentPaywall]);

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
            ScreenHeader handles the top inset itself. The PRO pill is the
            standing paywall route for free users (owner ask 2026-09-10). */}
        <ScreenHeader
          title="Sommelier"
          subtitle="Your wine companion"
          showBack={false}
          right={<UpgradePill source="chat" />}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.ink} />
          </View>
        ) : (
          // One scroll surface (owner direction 2026-09-11, reshaped
          // 2026-09-12): a serif prompt and the ask box are the hero, with
          // half-written starter chips; the four guided tools sit under it as
          // a 2x2 grid (Tonight's Pick is a tile now, not a competing row);
          // then the standing Pro entry and past conversations. There is no
          // separate "Start a new chat" button: the ask box is the new chat.
          <ScrollView
            contentContainerStyle={styles.listScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.heroTitle}>What can I help you with?</Text>
            <AskSommelierBox
              onAsk={askFromHub}
              onOpen={startNewChat}
              chips={STARTER_CHIPS}
              style={styles.askBox}
            />

            <Text style={styles.sectionLabel}>GUIDED TOOLS</Text>
            <View style={styles.toolGrid}>
              <SommelierToolCard
                icon="camera-outline"
                title="Photograph a wine list"
                subtitle="Personal picks for dinner"
                pro
                style={styles.toolTile}
                onPress={() => router.push('/sommelier/wine-list')}
                testID="tool-wine-list"
              />
              <SommelierToolCard
                icon="sparkles-outline"
                title="Tonight's pick"
                subtitle="A bottle from your cellar"
                pro
                style={styles.toolTile}
                onPress={() => router.push('/sommelier/tonight')}
                testID="tool-tonight"
              />
              <SommelierToolCard
                icon="analytics-outline"
                title="My taste"
                subtitle="What your journal says"
                pro
                style={styles.toolTile}
                onPress={() => router.push('/sommelier/taste')}
                testID="tool-taste"
              />
              <SommelierToolCard
                icon="car-outline"
                title="Plan a wine day"
                subtitle="Stops, times, drives"
                pro
                style={styles.toolTile}
                onPress={() => router.push('/trips/new')}
                testID="tool-trip"
              />
            </View>

            {/* Standing Pro entry (owner ask 2026-09-10): the paywall used to
                be reachable from this tab only by exhausting the chat meter.
                Renders nothing for Pro. */}
            <ProUpsellCard
              title="Unlimited sommelier with Pro"
              subtitle={
                meterHint({ isPro, task: 'chat', remaining: remaining('chat') }) ??
                'Ask anything, any time, photos included'
              }
              source="chat"
              style={styles.upsell}
            />

            {conversations.length === 0 ? (
              <>
                <Text style={styles.recentLabel}>RECENT CHATS</Text>
                <View style={styles.listEmptyState}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={22}
                    color={colors.neutral.placeholder}
                  />
                  <Text style={styles.listEmptySubtitle}>
                    Your conversations will show up here.
                  </Text>
                </View>
              </>
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
        <TouchableOpacity
          onPress={startNewChat}
          style={styles.chatNewButton}
          accessibilityRole="button"
          accessibilityLabel="Start another new chat"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={24} color={colors.primary.ink} />
        </TouchableOpacity>
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
              Ask in your own words. I can use what you have rated and what is in
              your cellar to make the answer personal.
            </Text>
            <Text style={styles.starterLabel}>TRY ASKING</Text>
            <View style={styles.starterList}>
              {STARTER_QUESTIONS.map((question) => (
                <TouchableOpacity
                  key={question}
                  style={styles.starterButton}
                  onPress={() => handleSend(question)}
                  accessibilityRole="button"
                  accessibilityLabel={question}
                >
                  <Text style={styles.starterText}>{question}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary.ink} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.photoTip}
              onPress={() => router.push('/sommelier/wine-list')}
              accessibilityRole="button"
              accessibilityLabel="Photograph a restaurant wine list"
            >
              <Ionicons name="camera-outline" size={18} color={colors.accent.ink} />
              <Text style={styles.photoTipText}>
                At a restaurant? Photograph the wine list and get picks for your dinner.
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ChatBubble
                message={item}
                // The preceding user prompt rides along on an AI-response
                // report so the owner can judge the reply in context.
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
          disabled={sending}
          photosLocked={!isPro}
          onLockedPhotoPress={() => presentPaywall('chat')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, borderRadius } = theme;

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
  heroTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: colors.neutral.ink,
    marginTop: spacing.xs,
    marginBottom: spacing.sm + 4,
  },
  askBox: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginBottom: spacing.sm,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toolTile: {
    // Two per row: basis just under half so the gap fits, grow to fill.
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 104,
  },
  upsell: {
    marginBottom: spacing.sm,
  },
  recentLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    marginTop: spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
  },
  listEmptySubtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    flex: 1,
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
  chatNewButton: {
    // 44pt touch target, mirrors the back chevron on the left.
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  starterLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  starterList: { alignSelf: 'stretch', gap: spacing.sm },
  starterButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  starterText: {
    ...typography.body.small,
    color: colors.neutral.ink,
    flex: 1,
  },
  photoTip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  photoTipText: {
    ...typography.body.small,
    color: colors.accent.ink,
    flex: 1,
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
