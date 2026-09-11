// lib/trips.js: "Plan a wine day" (Pro tool). Design brief:
// docs/research/pro-features-ux-and-implementation-2026-09-11.md section 7.
//
// Three services and the pure helpers from lib/tripSchedule.js:
//   routesService  the `routes` Edge Function (Google Routes, Pro, metered)
//   tripsService   CRUD on public.trip_plans (owner RLS)
//   askSommelierAboutDay  one optional Sonnet call, task 'trip_plan'
// plus loadCandidates (wishlist + visited + directory, ranked) and
// fetchStopHours (live Google hours for one stop, display only).
//
// What gets persisted is the user's plan and the drive-leg minutes. Google
// hours and details are fetched when a saved day is opened and never stored;
// a matched place id is the one Google datum policy lets us keep.
import { aiService } from './ai';
import { placesService } from './places';
import { isPaywallError } from './pro';
import { supabase } from './supabase';
import {
  DEFAULTS,
  boundsAround,
  buildSchedule,
  buildTripSystemPrompt,
  buildTripUserMessage,
  candidateWineries,
  hoursForDate,
  parseTripPlan,
} from './tripSchedule';
import { visitsService } from './visits';
import { wineryDirectoryService } from './wineryDirectory';
import { wishlistService } from './wishlist';

export * from './tripSchedule';

/**
 * Whether a failed call is the server's Pro gate. The routes and places
 * functions answer 402 with code 'pro_required'; the chat function with
 * 'free_limit_reached'. Either should open the paywall, nothing else should.
 */
export function isProRequired(errorOrResult) {
  return errorOrResult?.code === 'pro_required' || isPaywallError(errorOrResult);
}

async function invokeRoutes(body) {
  const { data, error } = await supabase.functions.invoke('routes', { body });
  if (error) {
    // functions.invoke hides the function's friendly JSON body on error.context.
    let serverMessage = null;
    let serverCode = null;
    try {
      const bodyJson = await error.context?.json?.();
      serverMessage = bodyJson?.error || null;
      serverCode = bodyJson?.code || null;
    } catch {
      // body was not JSON or was already consumed; keep the generic message
    }
    const wrapped = new Error(serverMessage || error.message || 'Routes request failed');
    if (serverCode) wrapped.code = serverCode;
    throw wrapped;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const routesService = {
  /**
   * Fixed-order driving legs from `origin` through `stops`.
   * Returns { success, legs:[{ seconds, meters }] } or { success:false, error, code }.
   */
  async legs({ origin, stops, returnToOrigin = false }) {
    try {
      const body = {
        origin: { lat: origin.lat, lng: origin.lng },
        stops: stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
      };
      if (returnToOrigin) body.returnToOrigin = true;
      const data = await invokeRoutes(body);
      return { success: true, legs: Array.isArray(data.legs) ? data.legs : [] };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },
};

// ── Candidates ─────────────────────────────────────────────────────────────

/** Wishlist and visited wineries that have coordinates, deduped by winery id. */
export async function loadSavedWineries() {
  const byId = new Map();
  const add = (winery, source) => {
    if (!winery?.id || byId.has(winery.id)) return;
    if (winery.latitude == null || winery.longitude == null) return;
    byId.set(winery.id, {
      wineryId: winery.id,
      name: winery.name,
      latitude: winery.latitude,
      longitude: winery.longitude,
      source,
    });
  };
  const [wishlist, visits] = await Promise.all([
    wishlistService.getUserWishlist(),
    visitsService.getUserVisits(),
  ]);
  for (const item of wishlist?.wishlist || []) add(item.wineries, 'wishlist');
  for (const visit of visits?.visits || []) add(visit.wineries, 'visited');
  return [...byId.values()];
}

/**
 * The ranked shortlist for the stop picker around `center`.
 * Directory failures degrade to the user's own saved wineries.
 */
export async function loadCandidates({
  center,
  radiusKm = DEFAULTS.radiusKm,
  savedFirst = true,
  limit = 12,
  exclude = [],
} = {}) {
  try {
    const [saved, directoryRes] = await Promise.all([
      loadSavedWineries().catch(() => []),
      wineryDirectoryService.getInBounds({ ...boundsAround({ ...center, radiusKm }), limitCount: 400 }),
    ]);
    const directory = directoryRes?.success ? directoryRes.wineries : [];
    const excluded = new Set(exclude);
    const candidates = candidateWineries({
      origin: center,
      radiusKm,
      saved,
      directory,
      savedFirst,
      limit: limit + excluded.size,
    }).filter((candidate) => !excluded.has(candidate.key)).slice(0, limit);
    return {
      success: true,
      candidates,
      directoryError: directoryRes?.success ? null : directoryRes?.error || 'Directory unavailable',
    };
  } catch (error) {
    return { success: false, error: error.message, candidates: [] };
  }
}

// ── Hours (live, display only) ─────────────────────────────────────────────

/**
 * Google hours for one stop on the trip's date. Matches the stop to a place
 * once (a stored placeId on the stop or on the winery row skips this), then
 * live-fetches details. Returns { hours, website, placeId, openNow }; hours
 * is null whenever anything is missing, and the caller labels it unknown.
 * `placeId` is returned so the caller may persist it on the stop (allowed).
 */
export async function fetchStopHours(stop, dateStr) {
  const unknown = { hours: null, website: stop?.website || null, placeId: stop?.placeId || null, openNow: null };
  if (!stop || stop.lat == null || stop.lng == null) return unknown;
  try {
    let placeId = stop.placeId || null;
    if (!placeId) {
      const match = await placesService.matchWinery({
        name: stop.name,
        latitude: stop.lat,
        longitude: stop.lng,
      });
      if (!match.success) return { ...unknown, code: match.code, error: match.error };
      placeId = match.candidates?.[0]?.place_id || null;
      if (placeId && stop.wineryId) placesService.saveWineryPlaceId(stop.wineryId, placeId);
    }
    if (!placeId) return unknown;
    const res = await placesService.getDetails(placeId, { directoryId: stop.directoryId ?? null });
    if (!res.success) return { ...unknown, placeId, code: res.code, error: res.error };
    return {
      hours: hoursForDate(res.details?.weekday_hours, dateStr),
      website: res.details?.website || stop.website || null,
      placeId,
      openNow: res.details?.open_now ?? null,
      businessStatus: res.details?.business_status ?? null,
    };
  } catch (error) {
    return { ...unknown, error: error.message };
  }
}

// ── Persistence ────────────────────────────────────────────────────────────

const PLAN_COLUMNS =
  'id, user_id, title, trip_date, start_label, start_lat, start_lng, start_time, end_time, stops, schedule, legs, settings, notes, ai_notes, created_at, updated_at';

/** Recompute a plan's schedule from what is stored on it. */
export function scheduleForPlan(plan) {
  const settings = plan?.settings || {};
  return buildSchedule({
    startTime: plan?.start_time || DEFAULTS.startTime,
    endTime: plan?.end_time || DEFAULTS.endTime,
    stops: plan?.stops || [],
    legs: plan?.legs || [],
    visitMinutes: settings.visitMinutes ?? DEFAULTS.visitMinutes,
    lunchMinutes: settings.lunchMinutes ?? DEFAULTS.lunchMinutes,
    lunchAfterStop: settings.lunchAfterStop ?? DEFAULTS.lunchAfterStop,
  });
}

export const tripsService = {
  /** Insert a plan. `plan` uses the table's column names. Returns { success, plan }. */
  async save(plan) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('trip_plans')
        .insert({ ...plan, user_id: user.id })
        .select(PLAN_COLUMNS)
        .single();
      if (error) throw error;
      return { success: true, plan: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async list() {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select('id, title, trip_date, start_label, start_time, end_time, stops, updated_at')
        .order('trip_date', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return { success: true, plans: data ?? [] };
    } catch (error) {
      return { success: false, error: error.message, plans: [] };
    }
  },

  async get(id) {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(PLAN_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, error: 'Plan not found' };
      return { success: true, plan: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async update(id, patch) {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(PLAN_COLUMNS)
        .single();
      if (error) throw error;
      return { success: true, plan: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async remove(id) {
    try {
      const { error } = await supabase.from('trip_plans').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

// ── Sommelier notes (optional, on demand) ──────────────────────────────────

/**
 * Ask the sommelier to comment on a planned day. One Sonnet call, task
 * 'trip_plan' (Pro-only server-side). Returns { success, notes } where notes
 * is the validated { summary, stopNotes, tips }, or { success:false, error, code }.
 */
export async function askSommelierAboutDay(plan) {
  try {
    const stops = plan?.stops || [];
    if (stops.length === 0) return { success: false, error: 'Add a stop first' };
    const schedule = plan.schedule || scheduleForPlan(plan);
    const message = buildTripUserMessage({
      date: plan.trip_date,
      startLabel: plan.start_label,
      stops,
      schedule,
    });
    const response = await aiService.sendMessage(
      [{ role: 'user', content: message }],
      buildTripSystemPrompt(),
      { task: 'trip_plan' }
    );
    const text = response?.response || '';
    const { value, truncated } = aiService.parseFencedJson(text, 'trip_plan');
    if (truncated) return { success: false, error: 'The sommelier ran out of room. Try again.' };
    const notes = parseTripPlan(value, stops.length);
    if (!notes) return { success: false, error: 'Could not read the sommelier reply.' };
    return { success: true, notes };
  } catch (error) {
    return { success: false, error: error.message || 'Sommelier request failed', code: error.code };
  }
}
