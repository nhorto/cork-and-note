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
};
