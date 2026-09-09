// lib/places.js — client for the `places` Edge Function (Google enrichment, Pro).
// Cost-lean plan: docs/research/winery-enrichment-google-places.md §2.5.
//
// Every call is Pro-gated and rate-limited SERVER-side; this wrapper's job is
// ergonomics: session memoization (Google data is live-fetch-only by policy,
// but within one app session re-fetching the same winery is pure waste), and
// surfacing the function's friendly error + `pro_required` code the same way
// lib/ai.js does for the sommelier (only a 402 should open the paywall).
import { supabase } from './supabase';

// One entry per place_id for the app session. Deliberately NOT persisted:
// Google's policy allows storing place IDs only, so ratings/hours die with
// the session.
const detailsCache = new Map();

async function invokePlaces(body) {
  const { data, error } = await supabase.functions.invoke('places', { body });

  if (error) {
    // functions.invoke hides the function's friendly JSON body ("Winery
    // details are a Pro feature.", "Daily limit reached…") on error.context —
    // extract it so callers can show the real message.
    let serverMessage = null;
    let serverCode = null;
    try {
      const bodyJson = await error.context?.json?.();
      serverMessage = bodyJson?.error || null;
      serverCode = bodyJson?.code || null;
    } catch {
      // body wasn't JSON / already consumed — fall through to the generic message
    }
    const wrapped = new Error(serverMessage || error.message || 'Places request failed');
    if (serverCode) wrapped.code = serverCode; // isPaywallError() reads this
    throw wrapped;
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

export const placesService = {
  /**
   * Live Google details for a winery page: rating, review count, open-now,
   * weekday hours, website, phone, Google Maps link, first photo name.
   * Memoized per place_id for the session. Callers must render Google
   * attribution next to this data and degrade gracefully on failure.
   */
  async getDetails(placeId) {
    if (!placeId) return { success: false, error: 'Missing place id' };
    if (detailsCache.has(placeId)) return { success: true, details: detailsCache.get(placeId) };
    try {
      const data = await invokePlaces({ mode: 'details', place_id: placeId });
      detailsCache.set(placeId, data);
      return { success: true, details: data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },

  /**
   * Match one of OUR winery records to a Google place (free IDs-Only search,
   * biased to the winery's coordinates). Returns candidates; the caller
   * persists the chosen `place_id` onto the winery row — the one Google
   * datum we're allowed to store.
   */
  async matchWinery({ name, latitude = null, longitude = null }) {
    try {
      const body = { mode: 'match', name };
      if (latitude != null && longitude != null) {
        body.lat = latitude;
        body.lng = longitude;
      }
      const data = await invokePlaces(body);
      return { success: true, candidates: data.candidates ?? [] };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },

  /** Persist a confirmed google_place_id onto a winery row. */
  async saveWineryPlaceId(wineryId, placeId) {
    try {
      const { error } = await supabase
        .from('wineries')
        .update({ google_place_id: placeId })
        .eq('id', wineryId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Resolve a Google photo resource name to a short-lived image URI.
   * Fallback only — the winery hero should be the user's own visit photo
   * whenever one exists.
   */
  async getPhotoUri(photoName) {
    if (!photoName) return { success: false, error: 'Missing photo name' };
    try {
      const data = await invokePlaces({ mode: 'photo', photo_name: photoName });
      return { success: true, uri: data.photo_uri ?? null };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },
};
