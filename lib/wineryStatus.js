// lib/wineryStatus.js
import { supabase } from './supabase';
import { wishlistService } from './wishlist';

export const wineryStatusService = {
  // Get comprehensive status for a winery
  async getWineryStatus(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return {
          success: false,
          error: 'User not authenticated',
          status: {
            visited: false,
            isWantToVisit: false
          }
        };
      }

      // Check visit status by querying visits
      const visitStatus = await this.hasVisited(wineryId);

      // Check wishlist status
      const wishlistStatus = await wishlistService.isInWishlist(wineryId);

      return {
        success: true,
        status: {
          visited: visitStatus.visited,
          lastVisitDate: visitStatus.lastVisitDate,
          visitCount: visitStatus.visitCount,
          isWantToVisit: wishlistStatus.isInWishlist,
          wishlistItem: wishlistStatus.wishlistItem
        }
      };
    } catch (error) {
      console.error('Error getting winery status:', error);
      return {
        success: false,
        error: error.message,
        status: {
          visited: false,
          isWantToVisit: false
        }
      };
    }
  },

  // Check if user has visited a winery
  async hasVisited(wineryId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { visited: false, visitCount: 0 };
      }

      // Query visits table
      const { data, error } = await supabase
        .from('visits')
        .select('id, visit_date')
        .eq('user_id', user.id)
        .eq('winery_id', wineryId)
        .order('visit_date', { ascending: false });

      if (error) {
        console.error('Error checking visit status:', error);
        return { visited: false, visitCount: 0 };
      }

      return {
        visited: data.length > 0,
        visitCount: data.length,
        lastVisitDate: data.length > 0 ? data[0].visit_date : null,
        visits: data
      };
    } catch (error) {
      console.error('Error checking if winery visited:', error);
      return { visited: false, visitCount: 0 };
    }
  }
};