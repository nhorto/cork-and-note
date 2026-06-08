// components/ConversationList.js
// Past conversations list with tap-to-continue, swipe-to-delete
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationItem({ conversation, onPress, onDelete }) {
  const contextIcon = conversation.context_type === 'wine_entry' ? 'wine' : 'chatbubbles';

  const handleLongPress = () => {
    Alert.alert(
      'Delete Conversation',
      `Delete "${conversation.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(conversation.id) },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(conversation)}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={contextIcon} size={20} color={colors.primary.burgundy} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{conversation.title}</Text>
        <Text style={styles.itemMeta}>
          {conversation.context_type === 'wine_entry' ? 'Wine Entry' : 'Chat'}
          {' · '}
          {formatRelativeDate(conversation.updated_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.neutral.silver} />
    </TouchableOpacity>
  );
}

export default function ConversationList({ conversations, onSelect, onDelete, onNewChat }) {
  return (
    <View style={styles.container}>
      {/* New Chat button */}
      <TouchableOpacity style={styles.newChatButton} onPress={onNewChat}>
        <Ionicons name="add-circle" size={20} color={colors.neutral.cream} />
        <Text style={styles.newChatText}>New Conversation</Text>
      </TouchableOpacity>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.neutral.stone} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a conversation with your personal wine sommelier
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={onSelect}
              onDelete={onDelete}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.burgundy,
    borderRadius: borderRadius.md,
    ...shadows.soft,
  },
  newChatText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  itemMeta: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
