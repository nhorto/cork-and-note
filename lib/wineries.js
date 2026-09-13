// lib/wineries.js
import { supabase } from './supabase';

export const wineriesService = {
  // Create a new winery in Supabase
  async createWinery({ name, latitude, longitude, address = null }) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: winery, error } = await supabase
        .from('wineries')
        .insert({
          name,
          address,
          latitude,
          longitude,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Winery creation error:', error);
        throw error;
      }

      return { success: true, winery };
    } catch (error) {
      console.error('Error creating winery:', error);
      return { success: false, error: error.message };
    }
  },

  // Find the user's existing winery, or create one. Used when a session is
  // logged or a wishlist entry made for a place that isn't already a saved
  // winery, so the place becomes a real winery row and shows up on the map
  // and in "your places". Reuses the winery linked to the same directory row
  // first, then a same-name winery, to avoid duplicate pins; backfills the
  // directory link and coordinates on a match. Browsing never calls this:
  // discovery pins open a preview page (#270), and only Log visit / Add to
  // wishlist promote.
  async findOrCreateWinery({ name, latitude = null, longitude = null, address = null, directoryId = null }) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const trimmed = (name || '').trim();
      if (!trimmed) {
        return { success: false, error: 'Winery name required' };
      }

      // RLS already scopes reads to this user.
      let existing = null;
      if (directoryId != null) {
        const { data, error: linkError } = await supabase
          .from('wineries')
          .select('*')
          .eq('user_id', user.id)
          .eq('directory_id', directoryId)
          .limit(1)
          .maybeSingle();
        if (linkError) throw linkError;
        existing = data;
      }
      if (!existing) {
        const { data, error: findError } = await supabase
          .from('wineries')
          .select('*')
          .eq('user_id', user.id)
          .ilike('name', trimmed)
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;
        existing = data;
      }

      if (existing) {
        const patch = {};
        // Backfill coordinates if the saved winery had none and we now have a pin.
        if (existing.latitude == null && latitude != null && longitude != null) {
          patch.latitude = latitude;
          patch.longitude = longitude;
        }
        if (existing.directory_id == null && directoryId != null) {
          patch.directory_id = directoryId;
        }
        if (Object.keys(patch).length) {
          const { data: updated, error: updateError } = await supabase
            .from('wineries')
            .update(patch)
            .eq('id', existing.id)
            .select()
            .single();
          if (!updateError && updated) return { success: true, winery: updated };
        }
        return { success: true, winery: existing };
      }

      const { data: winery, error } = await supabase
        .from('wineries')
        .insert({ name: trimmed, address, latitude, longitude, user_id: user.id, directory_id: directoryId })
        .select()
        .single();

      if (error) throw error;

      return { success: true, winery };
    } catch (error) {
      console.error('Error finding/creating winery:', error);
      return { success: false, error: error.message };
    }
  },

  // Get a single winery by ID
  async getWinery(wineryId) {
    try {
      // Guard against place-less logs: a null/undefined winery_id (location-
      // optional tastings) must never reach the query — `wineries.id` is a
      // bigint, so binding "null" throws 22P02 (invalid input for bigint).
      if (wineryId == null || wineryId === 'null' || wineryId === 'undefined') {
        return { success: false, error: 'No winery for this log', winery: null };
      }

      const { data, error } = await supabase
        .from('wineries')
        .select('*, winery_directory (operating_status)')
        .eq('id', wineryId)
        .single();

      if (error) {
        console.error('Error fetching winery:', error);
        throw error;
      }

      // Carry the linked directory row's status so a saved winery that has
      // since closed is badged on its page (#273).
      const { winery_directory: directory, ...winery } = data ?? {};
      return { success: true, winery: { ...winery, operatingStatus: directory?.operating_status ?? null } };
    } catch (error) {
      console.error('Error getting winery:', error);
      return { success: false, error: error.message };
    }
  },

  // The user's winery linked to a directory row, if any (#270): lets a
  // discovery pin, Near You card or Find result open your own page (with your
  // notes) instead of a preview when you've already saved that winery.
  async getWineryByDirectoryId(directoryId) {
    try {
      if (directoryId == null) return { success: true, winery: null };
      const { data, error } = await supabase
        .from('wineries')
        .select('*')
        .eq('directory_id', directoryId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { success: true, winery: data ?? null };
    } catch (error) {
      return { success: false, error: error.message, winery: null };
    }
  },

  // Get all of the user's own wineries. Wineries are now per-user (RLS scopes
  // every read to the owner), so we query the table directly — this includes
  // dropped pins that don't yet have a visit or wishlist entry. We still tag
  // each winery with hasVisit / inWishlist for the map UI, and carry the
  // linked directory row's operating status so a closed winery can be badged.
  async getUserWineries() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, wineries: [] };
      }

      const [wineriesResult, visitsResult, wishlistResult] = await Promise.all([
        supabase
          .from('wineries')
          .select('id, name, address, latitude, longitude, directory_id, winery_directory (operating_status)')
          .eq('user_id', user.id),
        // Only real visits mark a pin "Visited": a bottle opened at home carries
        // the producer's winery_id with a null place_type (#294).
        supabase
          .from('visits')
          .select('winery_id')
          .eq('user_id', user.id)
          .eq('place_type', 'winery')
          .not('winery_id', 'is', null),
        supabase
          .from('wishlist')
          .select('winery_id')
          .eq('user_id', user.id)
          .not('winery_id', 'is', null)
      ]);

      const visitedIds = new Set((visitsResult.data || []).map(v => v.winery_id));
      const wishlistIds = new Set((wishlistResult.data || []).map(w => w.winery_id));

      const wineries = (wineriesResult.data || []).map(({ winery_directory: directory, ...w }) => ({
        ...w,
        hasVisit: visitedIds.has(w.id),
        inWishlist: wishlistIds.has(w.id),
        operatingStatus: directory?.operating_status ?? null,
      }));

      return { success: true, wineries };
    } catch (error) {
      console.error('Error getting user wineries:', error);
      return { success: false, error: error.message, wineries: [] };
    }
  },

  // Every winery the user has actually logged a visit at, aggregated for the
  // Places list screen (#170): visit count + most-recent visit date, sorted by
  // last visit desc. Place-less logs (null winery_id) never surface here, and
  // neither do cellar-origin tastings (winery_id set, place_type null, #294).
  async getVisitedWineries() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return { success: false, wineries: [] };
      }

      const { data: visits, error } = await supabase
        .from('visits')
        .select('winery_id, visit_date, wineries (id, name, address)')
        .eq('user_id', user.id)
        .eq('place_type', 'winery')
        .not('winery_id', 'is', null);
      if (error) throw error;

      const byWinery = new Map(); // winery_id -> { id, name, address, visitCount, lastVisit }
      for (const v of visits || []) {
        if (!v.wineries?.name) continue;
        const cur = byWinery.get(v.winery_id) || {
          id: v.winery_id,
          name: v.wineries.name,
          address: v.wineries.address,
          visitCount: 0,
          lastVisit: v.visit_date,
        };
        cur.visitCount += 1;
        if (new Date(v.visit_date) > new Date(cur.lastVisit)) cur.lastVisit = v.visit_date;
        byWinery.set(v.winery_id, cur);
      }

      const wineries = [...byWinery.values()].sort(
        (a, b) => new Date(b.lastVisit) - new Date(a.lastVisit)
      );
      return { success: true, wineries };
    } catch (error) {
      console.error('Error getting visited wineries:', error);
      return { success: false, error: error.message, wineries: [] };
    }
  },

  // Delete a winery, preserving the user's tasting data ("detach, keep notes").
  // The FKs into wineries are NO ACTION, so every reference must be cleared first
  // or the delete fails. We KEEP logged data by un-linking the place:
  //   - visits        → clear winery_id (becomes a location-less log; notes/wines kept)
  //   - cellar_bottles → clear winery_id (bottle keeps its free-text producer)
  //   - wishlist / favorites → remove the entry (these are just place pointers)
  // RLS scopes everything to the owner; the user_id filters are belt-and-suspenders.
  async deleteWinery(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const detachResults = await Promise.all([
        supabase
          .from('visits')
          .update({ winery_id: null })
          .eq('winery_id', wineryId)
          .eq('user_id', user.id),
        supabase
          .from('cellar_bottles')
          .update({ winery_id: null })
          .eq('winery_id', wineryId)
          .eq('user_id', user.id),
        supabase
          .from('wishlist')
          .delete()
          .eq('winery_id', wineryId)
          .eq('user_id', user.id),
        supabase
          .from('favorites')
          .delete()
          .eq('winery_id', wineryId)
          .eq('user_id', user.id)
      ]);

      const detachError = detachResults.find(r => r.error)?.error;
      if (detachError) throw detachError;

      // No references remain — remove the winery (RLS ensures the user owns it).
      const { error } = await supabase
        .from('wineries')
        .delete()
        .eq('id', wineryId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting winery:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if a winery exists by name (for duplicate detection)
  async findWineryByName(name) {
    try {
      const { data, error } = await supabase
        .from('wineries')
        .select('*')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error finding winery:', error);
        throw error;
      }

      return {
        success: true,
        winery: data,
        exists: !!data
      };
    } catch (error) {
      console.error('Error finding winery by name:', error);
      return { success: false, error: error.message, exists: false };
    }
  }
};
