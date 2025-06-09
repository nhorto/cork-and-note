// lib/wineryStatus.js
import { favoritesService } from './favorites';
import { supabase } from './supabase';
import { visitsService } from './visits';
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
            isFavorite: false,
            isWantToVisit: false
          }
        };
      }

      // Check visit status by querying visits
      const visitStatus = await this.hasVisited(wineryId);
      
      // Check favorite status
      const favoriteStatus = await favoritesService.isFavorite(wineryId);
      
      // Check wishlist status
      const wishlistStatus = await wishlistService.isInWishlist(wineryId);

      return {
        success: true,
        status: {
          visited: visitStatus.visited,
          lastVisitDate: visitStatus.lastVisitDate,
          visitCount: visitStatus.visitCount,
          isFavorite: favoriteStatus.isFavorite,
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
          isFavorite: false,
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
  },

  // Get all wineries with their status
  async getAllWineriesWithStatus(wineries) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // Return wineries with default status
        return {
          success: false,
          error: 'User not authenticated',
          wineries: wineries.map(winery => ({
            ...winery,
            status: {
              visited: false,
              isFavorite: false,
              isWantToVisit: false
            }
          }))
        };
      }

      // Get all visits for current user
      const { success: visitsSuccess, visits } = await visitsService.getUserVisits();
      
      // Get all favorites
      const { success: favoritesSuccess, favorites } = await favoritesService.getUserFavorites();
      
      // Get wishlist
      const { success: wishlistSuccess, wishlist } = await wishlistService.getUserWishlist();

      // Create lookup maps for faster access
      const visitedWineries = new Map();
      const visitCounts = new Map();
      const lastVisitDates = new Map();
      
      if (visitsSuccess && visits) {
        visits.forEach(visit => {
          visitedWineries.set(visit.winery_id.toString(), true);
          
          const count = visitCounts.get(visit.winery_id.toString()) || 0;
          visitCounts.set(visit.winery_id.toString(), count + 1);
          
          const currentLastDate = lastVisitDates.get(visit.winery_id.toString());
          if (!currentLastDate || new Date(visit.visit_date) > new Date(currentLastDate)) {
            lastVisitDates.set(visit.winery_id.toString(), visit.visit_date);
          }
        });
      }

      const favoriteWineries = new Map();
      if (favoritesSuccess && favorites) {
        favorites.forEach(fav => {
          favoriteWineries.set(fav.winery_id.toString(), true);
        });
      }

      const wishlistWineries = new Map();
      if (wishlistSuccess && wishlist) {
        wishlist.forEach(item => {
          wishlistWineries.set(item.winery_id.toString(), {
            id: item.id
          });
        });
      }

      // Merge status into wineries
      const wineriesWithStatus = wineries.map(winery => {
        const wineryId = winery.id.toString();
        return {
          ...winery,
          status: {
            visited: visitedWineries.has(wineryId),
            visitCount: visitCounts.get(wineryId) || 0,
            lastVisitDate: lastVisitDates.get(wineryId) || null,
            isFavorite: favoriteWineries.has(wineryId),
            isWantToVisit: wishlistWineries.has(wineryId),
            wishlistItem: wishlistWineries.get(wineryId) || null
          }
        };
      });

      return { success: true, wineries: wineriesWithStatus };
    } catch (error) {
      console.error('Error getting wineries with status:', error);
      return { 
        success: false, 
        error: error.message,
        wineries: wineries.map(winery => ({
          ...winery,
          status: {
            visited: false,
            isFavorite: false,
            isWantToVisit: false
          }
        }))
      };
    }
  }
};