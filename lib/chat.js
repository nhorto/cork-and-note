// lib/chat.js - Chat service for AI Sommelier
// CRUD for conversations/messages + photo upload to chat-photos bucket
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
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

  // Uploads to the (now private) chat-photos bucket and returns the storage
  // PATH (not a public URL). Display code resolves short-lived signed URLs via
  // getSignedUrls. The filename encodes the owner id for the owner-scoped RLS.
  async uploadChatPhoto(photoUri) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = `chat_${user.id}_${timestamp}_${randomId}.jpg`;

    // Read the local file as base64 and upload the decoded bytes.
    // fetch(localUri).blob() returns an EMPTY blob for file:// URIs in Expo/RN
    // (uploaded 0-byte images); expo-file-system reads the real bytes.
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { error } = await supabase.storage
      .from('chat-photos')
      .upload(fileName, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    return fileName;
  },

  // Normalize a stored image_urls entry to a storage path. New rows store the
  // path directly; legacy rows hold a full public URL (.../chat-photos/<path>?…)
  // — extract the path so those still resolve after the bucket went private.
  _toStoragePath(value) {
    if (!value) return value;
    const marker = '/chat-photos/';
    const idx = value.indexOf(marker);
    if (idx === -1) return value;
    return decodeURIComponent(value.slice(idx + marker.length).split('?')[0]);
  },

  // Resolve an array of stored image_urls entries to short-lived signed URLs.
  // Returns an array aligned to the input (null where signing failed).
  async getSignedUrls(values = [], expiresIn = 3600) {
    if (!values || values.length === 0) return [];
    const paths = values.map((v) => this._toStoragePath(v));
    const { data, error } = await supabase.storage
      .from('chat-photos')
      .createSignedUrls(paths, expiresIn);
    if (error) {
      console.error('Error creating signed URLs:', error);
      return values.map(() => null);
    }
    return data.map((d) => d?.signedUrl ?? null);
  },

  // ─── Auto-title ───────────────────────────────────────────

  generateTitle(firstMessage) {
    // Take first ~50 chars of the first user message as title
    const clean = firstMessage.replace(/\n/g, ' ').trim();
    if (clean.length <= 50) return clean;
    return clean.substring(0, 47) + '...';
  },
};
