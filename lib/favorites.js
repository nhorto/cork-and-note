// lib/favorites.js
import { supabase } from './supabase';

export const favoritesService = {
  // Get all favorites for current user
  async getUserFavorites() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('favorites')
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
        console.error('Error fetching favorites:', error);
        throw error;
      }

      return { success: true, favorites: data };
    } catch (error) {
      console.error('Error getting user favorites:', error);
      return { success: false, error: error.message };
    }
  },

  // Add a winery to favorites
  async addFavorite(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          winery_id: wineryId
        })
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          return { success: false, error: 'This winery is already in your favorites' };
        }
        console.error('Error adding favorite:', error);
        throw error;
      }

      return { success: true, favorite: data };
    } catch (error) {
      console.error('Error adding favorite:', error);
      return { success: false, error: error.message };
    }
  },

  // Remove a winery from favorites
  async removeFavorite(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('winery_id', wineryId);

      if (error) {
        console.error('Error removing favorite:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing favorite:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if a winery is favorited by current user
  async isFavorite(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { success: false, isFavorite: false };
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('winery_id', wineryId)
        .maybeSingle();

      if (error) {
        console.error('Error checking favorite status:', error);
        throw error;
      }

      return { success: true, isFavorite: !!data };
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return { success: false, error: error.message, isFavorite: false };
    }
  }
};