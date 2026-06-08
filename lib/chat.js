// lib/chat.js - Chat service for AI Sommelier
// CRUD for conversations/messages + photo upload to chat-photos bucket
import { supabase } from './supabase';

export const chatService = {
  // ─── Conversations ────────────────────────────────────────

  async createConversation(contextType = 'general', contextMetadata = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation',
        context_type: contextType,
        context_metadata: contextMetadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getConversation(conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateConversationTitle(conversationId, title) {
    const { error } = await supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) throw error;
  },

  async deleteConversation(conversationId) {
    // Messages cascade-delete via FK
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
  },

  // ─── Messages ─────────────────────────────────────────────

  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addMessage(conversationId, role, content, imageUrls = [], aiSuggestions = null) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        image_urls: imageUrls,
        ai_suggestions: aiSuggestions,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Photo Upload ─────────────────────────────────────────

  async uploadChatPhoto(photoUri) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = `chat_${user.id}_${timestamp}_${randomId}.jpg`;

    // Convert URI to blob
    const response = await fetch(photoUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('chat-photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  // ─── Auto-title ───────────────────────────────────────────

  generateTitle(firstMessage) {
    // Take first ~50 chars of the first user message as title
    const clean = firstMessage.replace(/\n/g, ' ').trim();
    if (clean.length <= 50) return clean;
    return clean.substring(0, 47) + '...';
  },
};
