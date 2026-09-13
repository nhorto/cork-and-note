// lib/achievements/index.js — the badge service (#295).
//
// Reads the journal and the cellar through the existing cached services,
// computes every fact on the device, compares that with the rows the user
// already holds, and writes the new ones. That is the entire pipeline: no
// queue, no trigger, no edge function. The table is an append-only ledger of
// what was earned; it is never the source of truth for progress.
//
// Nothing here may ever break a save. Every function returns
// { success: true, ... } or { success: false, error } and none of them throw,
// because the callers in #296 sit on the tail of "log a tasting" and "add a
// bottle" and an achievements failure must not make a user think their wine
// did not save.
import { cached, CACHE_KEYS, invalidate } from '../cache';
import { cellarService } from '../cellar';
import { supabase } from '../supabase';
import { visitsService } from '../visits';
import { ACHIEVEMENTS_ENABLED } from './catalog';
import { evaluate } from './evaluate';
import { buildFacts } from './facts';

const EMPTY = { newlyEarned: [], result: null, facts: null, earnedRows: [] };

const ROW_COLUMNS = 'id, badge_key, tier, points, earned_at, seen_at, source';

async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user;
}

async function fetchEarnedRows(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(ROW_COLUMNS)
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

// Journal + cellar in parallel; both are cached, so a screen that already
// loaded them pays nothing.
async function loadSources() {
  const [visitsResult, cellarResult] = await Promise.all([
    visitsService.getUserVisits(),
    cellarService.getCellarHistory(),
  ]);
  return {
    visits: visitsResult?.visits || [],
    bottles: cellarResult?.bottles || [],
    consumptions: cellarResult?.consumptions || [],
  };
}

/**
 * The whole Wine Journey for display. Read-only: it never writes a row, so a
 * screen can call it freely.
 * @returns {{ success, facts, result, earnedRows }}
 */
export async function getAchievements() {
  return cached(CACHE_KEYS.achievements, _getAchievements);
}

async function _getAchievements() {
  try {
    const user = await currentUser();
    const [sources, earnedRows] = await Promise.all([loadSources(), fetchEarnedRows(user.id)]);
    const facts = buildFacts(sources);
    return { success: true, facts, result: evaluate(facts, earnedRows), earnedRows };
  } catch (error) {
    console.error('Error getting achievements:', error);
    return { success: false, error: error.message, ...EMPTY };
  }
}

/**
 * Recompute and persist. Call this after anything that could earn a badge.
 *
 * `backfill` is true on the first run for an account with history: the user is
 * about to be handed a pile of badges they earned before the feature existed,
 * and #296 uses the flag to show one summary instead of twenty celebrations.
 *
 * @returns {{ success, newlyEarned, result, backfill }}
 */
export async function refreshAchievements() {
  if (!ACHIEVEMENTS_ENABLED) return { success: true, backfill: false, ...EMPTY };

  try {
    const user = await currentUser();
    const [sources, earnedRows] = await Promise.all([loadSources(), fetchEarnedRows(user.id)]);
    const facts = buildFacts(sources);
    const result = evaluate(facts, earnedRows);

    const backfill = earnedRows.length === 0 && result.newlyEarned.length > 1;
    if (result.newlyEarned.length === 0) {
      return { success: true, newlyEarned: [], result, facts, earnedRows, backfill: false };
    }

    const rows = result.newlyEarned.map((badge) => ({
      user_id: user.id,
      badge_key: badge.badge_key,
      tier: badge.tier,
      points: badge.points,
      source: backfill ? 'backfill' : 'live',
    }));

    const inserted = await insertRows(rows);
    invalidate(CACHE_KEYS.achievements);

    // Only report what actually landed, so a celebration can never show a badge
    // the database rejected.
    const landed = new Set(inserted.map((r) => `${r.badge_key}|${r.tier ?? ''}`));
    const newlyEarned = result.newlyEarned.filter(
      (b) => landed.has(`${b.badge_key}|${b.tier ?? ''}`)
    );

    return { success: true, newlyEarned, result, facts, earnedRows, backfill };
  } catch (error) {
    console.error('Error refreshing achievements:', error);
    return { success: false, error: error.message, backfill: false, ...EMPTY };
  }
}

// Insert the new rows, tolerating the race where two screens refresh at once.
// The unique index is on an expression (coalesce(tier, '')), which PostgREST
// cannot name in on_conflict, so a duplicate is handled by asking for it row by
// row and ignoring unique violations (23505) rather than by upserting.
async function insertRows(rows) {
  const { data, error } = await supabase.from('user_achievements').insert(rows).select(ROW_COLUMNS);
  if (!error) return data || [];
  if (error.code !== '23505') throw error;

  const landed = [];
  for (const row of rows) {
    const single = await supabase.from('user_achievements').insert(row).select(ROW_COLUMNS);
    if (!single.error) landed.push(...(single.data || []));
    else if (single.error.code !== '23505') throw single.error;
  }
  return landed;
}

/** Badges the user has not been shown yet, oldest first. */
export async function getUnseen() {
  try {
    const user = await currentUser();
    const { data, error } = await supabase
      .from('user_achievements')
      .select(ROW_COLUMNS)
      .eq('user_id', user.id)
      .is('seen_at', null)
      .order('earned_at', { ascending: true });
    if (error) throw error;
    return { success: true, rows: data || [] };
  } catch (error) {
    console.error('Error getting unseen achievements:', error);
    return { success: false, error: error.message, rows: [] };
  }
}

/**
 * Mark badges as shown. Takes the rows (or ids) a celebration just displayed.
 */
export async function markSeen(rows = []) {
  try {
    const ids = (Array.isArray(rows) ? rows : [rows])
      .map((r) => (r && typeof r === 'object' ? r.id : r))
      .filter(Boolean);
    if (ids.length === 0) return { success: true, count: 0 };

    const user = await currentUser();
    const { error } = await supabase
      .from('user_achievements')
      .update({ seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids);
    if (error) throw error;

    invalidate(CACHE_KEYS.achievements);
    return { success: true, count: ids.length };
  } catch (error) {
    console.error('Error marking achievements seen:', error);
    return { success: false, error: error.message, count: 0 };
  }
}

export const achievementsService = {
  getAchievements,
  refreshAchievements,
  getUnseen,
  markSeen,
};
