// lib/wishlist.js
import { supabase } from './supabase';

export const wishlistService = {
  // Get all wishlist items for current user
  async getUserWishlist() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          wineries (
            id,
            name,
            address,
            latitude,
            longitude
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching wishlist:', error);
        throw error;
      }

      return { success: true, wishlist: data };
    } catch (error) {
      console.error('Error getting user wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  // Add a winery to wishlist
  async addToWishlist(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          winery_id: wineryId
        })
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          return { success: false, error: 'This winery is already in your wishlist' };
        }
        console.error('Error adding to wishlist:', error);
        throw error;
      }

      return { success: true, item: data };
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  // Remove a winery from wishlist
  async removeFromWishlist(itemId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing from wishlist:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  // Remove a winery from wishlist by winery ID
  async removeFromWishlistByWineryId(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('winery_id', wineryId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing from wishlist:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if a winery is in user's wishlist
  async isInWishlist(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { success: false, isInWishlist: false };
      }

      const { data, error } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('winery_id', wineryId)
        .maybeSingle();

      if (error) {
        console.error('Error checking wishlist status:', error);
        throw error;
      }

      return { 
        success: true, 
        isInWishlist: !!data,
        wishlistItem: data || null
      };
    } catch (error) {
      console.error('Error checking wishlist status:', error);
      return { success: false, error: error.message, isInWishlist: false };
    }
  }
};