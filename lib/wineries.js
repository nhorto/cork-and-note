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
          longitude
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

  // Get all wineries the user has interacted with (from visits + wishlist)
  // This avoids needing a 'created_by' column on the wineries table
  async getUserWineries() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, wineries: [] };
      }

      // Get wineries from visits and wishlist in parallel
      const [visitsResult, wishlistResult] = await Promise.all([
        supabase
          .from('visits')
          .select('winery_id, wineries(id, name, address, latitude, longitude)')
          .eq('user_id', user.id),
        supabase
          .from('wishlist')
          .select('winery_id, wineries(id, name, address, latitude, longitude)')
          .eq('user_id', user.id)
      ]);

      // Combine and dedupe wineries
      const wineryMap = new Map();

      visitsResult.data?.forEach(v => {
        if (v.wineries) {
          wineryMap.set(v.wineries.id, {
            ...v.wineries,
            hasVisit: true
          });
        }
      });

      wishlistResult.data?.forEach(w => {
        if (w.wineries) {
          const existing = wineryMap.get(w.wineries.id);
          if (existing) {
            existing.inWishlist = true;
          } else {
            wineryMap.set(w.wineries.id, {
              ...w.wineries,
              inWishlist: true
            });
          }
        }
      });

      return {
        success: true,
        wineries: Array.from(wineryMap.values())
      };
    } catch (error) {
      console.error('Error getting user wineries:', error);
      return { success: false, error: error.message, wineries: [] };
    }
  },

  // Delete a winery (only if user owns it and no visits/wishlist reference it)
  async deleteWinery(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if there are any visits or wishlist entries referencing this winery
      const [visitsCheck, wishlistCheck] = await Promise.all([
        supabase
          .from('visits')
          .select('id')
          .eq('winery_id', wineryId)
          .limit(1),
        supabase
          .from('wishlist')
          .select('id')
          .eq('winery_id', wineryId)
          .limit(1)
      ]);

      // If winery has visits or wishlist entries, don't delete it
      if (visitsCheck.data?.length > 0 || wishlistCheck.data?.length > 0) {
        return {
          success: false,
          error: 'Cannot delete winery with visits or wishlist entries. Remove those first.'
        };
      }

      // Delete the winery
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
