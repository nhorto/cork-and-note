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

  // Find the user's existing winery by name, or create one. Used when a session
  // is logged with a winery place that isn't already a saved winery (the user
  // typed a new name in PlacePicker), so the place becomes a real winery row and
  // shows up on the map and in "your places". Reuses a same-name winery to avoid
  // duplicate pins, and backfills coordinates if the saved one had none.
  async findOrCreateWinery({ name, latitude = null, longitude = null, address = null }) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const trimmed = (name || '').trim();
      if (!trimmed) {
        return { success: false, error: 'Winery name required' };
      }

      // Reuse an existing same-name winery (RLS already scopes reads to this user).
      const { data: existing, error: findError } = await supabase
        .from('wineries')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', trimmed)
        .limit(1)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        // Backfill coordinates if the saved winery had none and we now have a pin.
        if (existing.latitude == null && latitude != null && longitude != null) {
          const { data: updated, error: updateError } = await supabase
            .from('wineries')
            .update({ latitude, longitude })
            .eq('id', existing.id)
            .select()
            .single();
          if (!updateError && updated) return { success: true, winery: updated };
        }
        return { success: true, winery: existing };
      }

      const { data: winery, error } = await supabase
        .from('wineries')
        .insert({ name: trimmed, address, latitude, longitude, user_id: user.id })
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
        .select('*')
        .eq('id', wineryId)
        .single();

      if (error) {
        console.error('Error fetching winery:', error);
        throw error;
      }

      return { success: true, winery: data };
    } catch (error) {
      console.error('Error getting winery:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all of the user's own wineries. Wineries are now per-user (RLS scopes
  // every read to the owner), so we query the table directly — this includes
  // dropped pins that don't yet have a visit or wishlist entry. We still tag
  // each winery with hasVisit / inWishlist for the map UI.
  async getUserWineries() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, wineries: [] };
      }

      const [wineriesResult, visitsResult, wishlistResult] = await Promise.all([
        supabase
          .from('wineries')
          .select('id, name, address, latitude, longitude')
          .eq('user_id', user.id),
        supabase
          .from('visits')
          .select('winery_id')
          .eq('user_id', user.id)
          .not('winery_id', 'is', null),
        supabase
          .from('wishlist')
          .select('winery_id')
          .eq('user_id', user.id)
          .not('winery_id', 'is', null)
      ]);

      const visitedIds = new Set((visitsResult.data || []).map(v => v.winery_id));
      const wishlistIds = new Set((wishlistResult.data || []).map(w => w.winery_id));

      const wineries = (wineriesResult.data || []).map(w => ({
        ...w,
        hasVisit: visitedIds.has(w.id),
        inWishlist: wishlistIds.has(w.id)
      }));

      return { success: true, wineries };
    } catch (error) {
      console.error('Error getting user wineries:', error);
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
