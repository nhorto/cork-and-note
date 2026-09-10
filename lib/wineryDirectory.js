// lib/wineryDirectory.js — nearby wineries from OUR directory table (Pro).
// Epic #203 Phase 2; plan: docs/research/winery-enrichment-google-places.md §2.5.
//
// The `winery_directory` table is seeded from Overture Maps open data
// (data/winery-directory/README.md) — this is the cost-lean substitute for
// Google Nearby Search: discovery reads our own database, so it costs
// nothing per query and works at any scale. Google is only consulted later,
// when a winery PAGE is opened (see lib/places.js).
import { haversineKm } from './geo';
import { supabase } from './supabase';

// ~40 km of latitude. Longitude degrees shrink with latitude, so the query
// widens the longitude window by 1/cos(lat) to keep the box roughly square.
const LAT_RANGE = 0.36;

export const wineryDirectoryService = {
  /** The closest directory wineries to a coordinate, nearest first. */
  async getNearby({ latitude, longitude, limitCount = 6 }) {
    try {
      const lngRange = LAT_RANGE / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
      const { data, error } = await supabase
        .from('winery_directory')
        .select('id, name, latitude, longitude, city, state, website')
        .gte('latitude', latitude - LAT_RANGE)
        .lte('latitude', latitude + LAT_RANGE)
        .gte('longitude', longitude - lngRange)
        .lte('longitude', longitude + lngRange)
        .limit(200);
      if (error) throw error;

      const nearest = (data ?? [])
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
   */
  async getInBounds({ north, south, east, west, limitCount = 750 }) {
    try {
      const { data, error } = await supabase
        .from('winery_directory')
        .select('id, name, latitude, longitude, city, state, website')
        .gte('latitude', south)
        .lte('latitude', north)
        .gte('longitude', west)
        .lte('longitude', east)
        .order('id', { ascending: true })
        .limit(limitCount);
      if (error) throw error;
      return { success: true, wineries: data ?? [] };
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
