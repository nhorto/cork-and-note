// lib/aiReports.js — user-filed reports on AI sommelier responses.
//
// Google Play's AI-generated content policy requires an in-app way to flag a
// problematic AI response, backed by a real review route. The flag on an
// assistant chat bubble inserts a row into public.ai_response_reports
// (RLS: insert-own only; no client read — an append-only queue the owner
// reviews with the service role). Same shape as lib/wineryReports.
import { supabase } from './supabase';

export const AI_REPORT_REASONS = [
  { value: 'inaccurate', label: 'Inaccurate or misleading' },
  { value: 'inappropriate', label: 'Inappropriate or offensive' },
  { value: 'unsafe', label: 'Unsafe advice' },
  { value: 'other', label: 'Something else' },
];

const VALID_REASONS = new Set(AI_REPORT_REASONS.map((r) => r.value));

export const aiReportsService = {
  /**
   * File a report on an assistant message. `messageContent` is the reply
   * being reported, captured verbatim (chat messages are user-deletable, so
   * the report carries its own copy); `context` is the user prompt that
   * preceded it when the chat surface had it handy. Never throws — a failed
   * report should tell the user, not crash the chat.
   */
  async reportResponse({ messageContent, context = null, reason, details = null }) {
    try {
      if (!VALID_REASONS.has(reason)) {
        return { success: false, error: 'Invalid reason' };
      }
      const content = (messageContent ?? '').trim();
      if (!content) {
        return { success: false, error: 'Missing message content' };
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const trimmedContext = (context ?? '').trim();
      const trimmedDetails = (details ?? '').trim();
      const { error } = await supabase.from('ai_response_reports').insert({
        user_id: user.id,
        message_content: content,
        context: trimmedContext ? trimmedContext.slice(0, 4000) : null,
        reason,
        details: trimmedDetails ? trimmedDetails.slice(0, 1000) : null,
      });
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error reporting AI response:', error);
      return { success: false, error: error.message };
    }
  },
};
