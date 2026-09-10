// lib/wineryReports.js — user-filed winery problem reports (#225).
//
// A lightweight freshness channel for the winery directory: "Report a
// problem" on the winery page inserts a row into public.winery_reports
// (RLS: insert-own / read-own; no update/delete — an append-only queue the
// owner reviews with the service role). Reports never mutate the directory
// directly; a human decides what a report means.
import { supabase } from './supabase';

export const REPORT_REASONS = [
  { value: 'permanently_closed', label: 'Permanently closed' },
  { value: 'wrong_location', label: 'Wrong location' },
  { value: 'other', label: 'Something else' },
];

const VALID_REASONS = new Set(REPORT_REASONS.map((r) => r.value));

export const wineryReportsService = {
  /**
   * File a report. `wineryId` is the user's wineries row (bigint id);
   * `directoryId` is the winery_directory row when the page was opened from
   * a discovery pin (the link only survives that first navigation). Either
   * may be null — one of them should be present for the report to be usable.
   */
  async reportProblem({ wineryId = null, directoryId = null, reason, details = null }) {
    try {
      if (!VALID_REASONS.has(reason)) {
        return { success: false, error: 'Invalid reason' };
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const trimmed = (details ?? '').trim();
      const { error } = await supabase.from('winery_reports').insert({
        user_id: user.id,
        winery_id: wineryId,
        directory_id: directoryId,
        reason,
        details: trimmed ? trimmed.slice(0, 1000) : null,
      });
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error reporting winery problem:', error);
      return { success: false, error: error.message };
    }
  },
};
