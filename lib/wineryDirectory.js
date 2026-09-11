// lib/wineryDirectory.js — winery discovery from our directory table, for every plan.
// Epic #203 Phase 2; plan: docs/research/winery-enrichment-google-places.md §2.5.
//
// The `winery_directory` table is seeded from Overture Maps open data
// (data/winery-directory/README.md) — this is the cost-lean substitute for
// Google Nearby Search: discovery reads our own database, so it costs
// no Google fee per query. Database and bandwidth costs still apply.
// Google is only consulted for Pro enrichment later,
// when a winery PAGE is opened (see lib/places.js).
import { haversineKm } from './geo';
import { supabase } from './supabase';

// Near You search boxes in degrees of latitude (~5, ~13, ~40 km), tried in
// order. Longitude degrees shrink with latitude, so each query widens the
// longitude window by 1/cos(lat) to keep the box roughly square.
const NEARBY_LAT_RANGES = [0.045, 0.12, 0.36];
const NEARBY_QUERY_CAP = 200;

// Freshness filter (#225): hide wineries we KNOW are gone. NULL means
// "unknown" — the overwhelming majority — and must be kept, so this can't be
// a bare .neq() (PostgREST `neq` evaluates NULL rows to NULL → filtered out).
// 'possibly_closed' (missing from the latest Overture extract) still shows:
// absence from one release isn't proof of closure.
const NOT_PERMANENTLY_CLOSED =
  'operating_status.is.null,operating_status.neq.permanently_closed';

export const wineryDirectoryService = {
  /**
   * One directory row for a preview page (#270): what the winery page shows
   * for a discovery pin before the user has saved anything. Closed rows are
   * still returned (the page badges them); only discovery queries hide them.
   */
  async getById(directoryId) {
    try {
      const { data, error } = await supabase
        .from('winery_directory')
        .select('id, name, latitude, longitude, address, city, state, website, google_place_id, operating_status')
        .eq('id', directoryId)
        .maybeSingle();
      if (error) throw error;
      return { success: true, winery: data ?? null };
    } catch (error) {
      return { success: false, error: error.message, winery: null };
    }
  },

  /** Directory website for a discovered or previously saved winery; never calls Google. */
  async getWebsite({ directoryId = null, name, latitude, longitude }) {
    try {
      let query = supabase.from('winery_directory').select('website');
      if (directoryId != null) {
        query = query.eq('id', directoryId);
      } else {
        // Saved winery pages have no directory route param. Only use an exact
        // name and coordinate match, never another same-name winery's website.
        if (!name || latitude == null || longitude == null) return null;
        query = query.eq('name', name).eq('latitude', latitude).eq('longitude', longitude);
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data?.website) return null;
      const url = new URL(data.website);
      // Directory data is external: don't launch arbitrary app URL schemes.
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
        ? url.href
        : null;
    } catch {
      return null;
    }
  },

  /**
   * The closest directory wineries to a coordinate, nearest first.
   *
   * Searched in widening boxes (about 5, 13 and 40 km). One capped query on a
   * 40 km box picks an arbitrary 200 of the ~1,500 rows around St Helena, so
   * Near You there showed Sonoma wineries 17 miles off while dozens sat next
   * door. Starting small means the nearest rows are always in the set, and a
   * sparse area still widens out to the old radius.
   */
  async getNearby({ latitude, longitude, limitCount = 6 }) {
    try {
      const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
      let rows = [];
      for (const latRange of NEARBY_LAT_RANGES) {
        const lngRange = latRange / cosLat;
        const { data, error } = await supabase
          .from('winery_directory')
          .select('id, name, latitude, longitude, city, state, website')
          .gte('latitude', latitude - latRange)
          .lte('latitude', latitude + latRange)
          .gte('longitude', longitude - lngRange)
          .lte('longitude', longitude + lngRange)
          .or(NOT_PERMANENTLY_CLOSED)
          .limit(NEARBY_QUERY_CAP);
        if (error) throw error;
        rows = data ?? [];
        // Enough rows to fill the list without hitting the cap (which would
        // mean the box, not distance, chose them): stop widening.
        if (rows.length >= limitCount || rows.length >= NEARBY_QUERY_CAP) break;
      }

      const nearest = rows
        .map((w) => ({
          ...w,
          distanceKm: haversineKm(latitude, longitude, w.latitude, w.longitude),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limitCount);
      return { success: true, wineries: nearest };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Every directory winery inside a map viewport (#224) — the Explore map
   * refetches this as the user pans/zooms, so discovery works anywhere, not
   * just around the phone's physical location. The cap keeps a whole-country
   * viewport from pulling all 14k rows; clustering absorbs whatever comes
   * back. Ordered by id so the subset a too-big viewport gets is stable
   * across refetches (pins don't flicker in and out between pans).
   *
   * The cap scales with the box (#276): a whole-country view keeps the
   * 750-row payload, but anything narrower than a degree (Napa and Sonoma
   * together are about half a degree wide and hold ~1,500 rows) gets the
   * larger cap so a valley view no longer silently drops half its wineries.
   * Returns `truncated` so the caller knows whether the box was fully covered.
   */
  async getInBounds({ north, south, east, west, limitCount }) {
    const cap = limitCount ?? (east - west < 1 ? 2000 : 750);
    try {
      const { data, error } = await supabase
        .from('winery_directory')
        .select('id, name, latitude, longitude, city, state, website')
        .gte('latitude', south)
        .lte('latitude', north)
        .gte('longitude', west)
        .lte('longitude', east)
        .or(NOT_PERMANENTLY_CLOSED)
        .order('id', { ascending: true })
        .limit(cap);
      if (error) throw error;
      const wineries = data ?? [];
      return { success: true, wineries, truncated: wineries.length >= cap };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Name search across the whole directory (the map's "Find" tab). Nearest
   * matches first when a location is known, alphabetical otherwise.
   */
  async searchByName({ query, latitude = null, longitude = null, limitCount = 12 }) {
    const q = (query ?? '').trim();
    if (q.length < 2) return { success: true, wineries: [] };
    try {
      const { data, error } = await supabase
        .from('winery_directory')
        .select('id, name, latitude, longitude, city, state, website')
        .ilike('name', `%${q}%`)
        .or(NOT_PERMANENTLY_CLOSED)
        .limit(50);
      if (error) throw error;

      let results = data ?? [];
      if (latitude != null && longitude != null) {
        results = results
          .map((w) => ({
            ...w,
            distanceKm: haversineKm(latitude, longitude, w.latitude, w.longitude),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm);
      } else {
        results = results.slice().sort((a, b) => a.name.localeCompare(b.name));
      }
      return { success: true, wineries: results.slice(0, limitCount) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
