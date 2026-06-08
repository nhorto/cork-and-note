// Updated lib/visits.js - Multiple photos support
import { supabase } from './supabase';

export const visitsService = {
  // Upload multiple photos to Supabase storage
  async uploadPhotos(photos, bucketName, folderPrefix = '') {
    if (!photos || photos.length === 0) return [];
    
    const uploadPromises = photos.map(async (photoUri, index) => {
      try {
        // Create unique filename
        const timestamp = new Date().getTime();
        const randomId = Math.random().toString(36).substring(2);
        const fileName = `${folderPrefix}${timestamp}_${randomId}_${index}.jpg`;
        
        // Convert URI to blob for upload
        const response = await fetch(photoUri);
        const blob = await response.blob();
        
        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });
          
        if (error) {
          console.error('Photo upload error:', error);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
          
        return publicUrl;
      } catch (error) {
        console.error('Error uploading photo:', error);
        return null;
      }
    });
    
    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls.filter(url => url !== null);
  },

  // Delete photos from storage
  async deletePhotos(photoUrls, bucketName) {
    if (!photoUrls || photoUrls.length === 0) return;
    
    const deletePromises = photoUrls.map(async (url) => {
      try {
        // Extract filename from URL
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([fileName]);
          
        if (error) {
          console.error('Error deleting photo:', error);
        }
      } catch (error) {
        console.error('Error deleting photo:', error);
      }
    });
    
    await Promise.all(deletePromises);
  },

  // Create a new visit with wines and photos
  async createVisit(visitData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Upload winery photos if any
      let wineryPhotoUrls = [];
      if (visitData.wineryPhotos && visitData.wineryPhotos.length > 0) {
        wineryPhotoUrls = await this.uploadPhotos(
          visitData.wineryPhotos, 
          'visit-photos', 
          `visit_${user.id}_`
        );
      }

      // Create visit record with photos as JSON array
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          winery_id: visitData.wineryId,
          visit_date: visitData.date,
          notes: visitData.notes || visitData.additionalNotes,
          photo_url: JSON.stringify(wineryPhotoUrls) // Store as JSON array
        })
        .select()
        .single();

      if (visitError) {
        console.error('Visit creation error:', visitError);
        throw visitError;
      }

      console.log('Visit created successfully:', visit);

      // Create wine records for each wine tried
      if (visitData.wines && visitData.wines.length > 0) {
        const winePromises = visitData.wines.map(wine => 
          this.createWineForVisit(visit.id, wine, user.id)
        );
        
        const wineResults = await Promise.all(winePromises);
        console.log('Wines created:', wineResults.length);
      }

      return { success: true, visit };
    } catch (error) {
      console.error('Error creating visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Create wine for visit with photos
  async createWineForVisit(visitId, wineData, userId) {
    try {
      // Upload wine photos if any
      let winePhotoUrls = [];
      if (wineData.photos && wineData.photos.length > 0) {
        winePhotoUrls = await this.uploadPhotos(
          wineData.photos, 
          'wine-photos', 
          `wine_${userId}_`
        );
      }

      // Insert wine record
      const { data: wine, error: wineError } = await supabase
        .from('wines')
        .insert({
          visit_id: visitId,
          wine_name: wineData.name || `${wineData.type} Wine`,
          wine_type: wineData.type,
          wine_varietal: wineData.varietal,
          wine_year: wineData.year,
          overall_rating: wineData.overallRating || 0,
          sweetness: wineData.ratings?.sweetness || 0,
          tannin: wineData.ratings?.tannins || 0,
          acidity: wineData.ratings?.acidity || 0,
          body: wineData.ratings?.body || 0,
          alcohol: wineData.ratings?.alcohol || 0,
          additional_notes: wineData.additionalNotes,
          photo_url: JSON.stringify(winePhotoUrls) // Store as JSON array
        })
        .select()
        .single();

      if (wineError) {
        console.error('Wine creation error:', wineError);
        throw wineError;
      }

      // Handle flavor notes if any
      if (wineData.flavorNotes && wineData.flavorNotes.length > 0) {
        await this.createWineFlavorNotes(wine.id, wineData.flavorNotes);
      }

      return wine;
    } catch (error) {
      console.error('Error creating wine:', error);
      throw error;
    }
  },

  // Create wine flavor notes
  async createWineFlavorNotes(wineId, flavorNotes) {
    try {
      // Get flavor note IDs
      const { data: flavorNoteData, error: flavorError } = await supabase
        .from('flavor_notes')
        .select('id, name')
        .in('name', flavorNotes);

      if (flavorError) {
        console.error('Error fetching flavor notes:', flavorError);
        return;
      }

      // Create wine-flavor connections
      const connections = flavorNoteData.map(note => ({
        wine_id: wineId,
        flavor_note_id: note.id
      }));

      if (connections.length > 0) {
        const { error: connectionError } = await supabase
          .from('wine_flavor_notes')
          .insert(connections);

        if (connectionError) {
          console.error('Error creating wine flavor connections:', connectionError);
        }
      }
    } catch (error) {
      console.error('Error creating wine flavor notes:', error);
    }
  },

  // Get user visits with photos
  async getUserVisits() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: visits, error } = await supabase
        .from('visits')
        .select(`
          *,
          wineries (
            id,
            name,
            address,
            latitude,
            longitude
          ),
          wines (
            id,
            wine_name,
            wine_type,
            wine_varietal,
            wine_year,
            overall_rating,
            sweetness,
            tannin,
            acidity,
            body,
            alcohol,
            additional_notes,
            photo_url,
            created_at,
            wine_flavor_notes (
              flavor_notes (
                name,
                category
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false });

      if (error) {
        console.error('Error fetching visits:', error);
        throw error;
      }

      // Parse photo URLs from JSON strings
      const visitsWithPhotos = visits.map(visit => ({
        ...visit,
        // Parse visit photos
        photos: this.parsePhotoUrls(visit.photo_url),
        wines: visit.wines?.map(wine => ({
          ...wine,
          // Parse wine photos
          photos: this.parsePhotoUrls(wine.photo_url)
        })) || []
      }));

      return { success: true, visits: visitsWithPhotos };
    } catch (error) {
      console.error('Error getting user visits:', error);
      return { success: false, error: error.message };
    }
  },

  // Helper function to parse photo URLs from JSON string
  parsePhotoUrls(photoUrlString) {
    if (!photoUrlString) return [];
    
    try {
      // If it's already an array, return it
      if (Array.isArray(photoUrlString)) return photoUrlString;
      
      // Try to parse as JSON
      const parsed = JSON.parse(photoUrlString);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      // If parsing fails, treat as single URL string
      return photoUrlString ? [photoUrlString] : [];
    }
  },

  // Update visit with photos
  async updateVisit(visitId, visitData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Handle photo updates if provided
      let photoUpdate = {};
      if (visitData.wineryPhotos !== undefined) {
        // Upload new photos
        const wineryPhotoUrls = await this.uploadPhotos(
          visitData.wineryPhotos, 
          'visit-photos', 
          `visit_${user.id}_`
        );
        
        photoUpdate = {
          photo_url: JSON.stringify(wineryPhotoUrls)
        };
      }

      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .update({
          visit_date: visitData.date,
          notes: visitData.notes,
          ...photoUpdate
        })
        .eq('id', visitId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (visitError) {
        console.error('Visit update error:', visitError);
        throw visitError;
      }

      return { success: true, visit };
    } catch (error) {
      console.error('Error updating visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Update wine with photos
  async updateWine(wineId, wineData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Handle photo updates if provided
      let photoUpdate = {};
      if (wineData.photos !== undefined) {
        // Upload new photos
        const winePhotoUrls = await this.uploadPhotos(
          wineData.photos, 
          'wine-photos', 
          `wine_${user.id}_`
        );
        
        photoUpdate = {
          photo_url: JSON.stringify(winePhotoUrls)
        };
      }

      const { data: wine, error: wineError } = await supabase
        .from('wines')
        .update({
          wine_name: wineData.name || `${wineData.type} Wine`,
          wine_type: wineData.type,
          wine_varietal: wineData.varietal,
          wine_year: wineData.year,
          overall_rating: wineData.overallRating || 0,
          sweetness: wineData.ratings?.sweetness || 0,
          tannin: wineData.ratings?.tannins || 0,
          acidity: wineData.ratings?.acidity || 0,
          body: wineData.ratings?.body || 0,
          alcohol: wineData.ratings?.alcohol || 0,
          additional_notes: wineData.additionalNotes,
          ...photoUpdate
        })
        .eq('id', wineId)
        .select()
        .single();

      if (wineError) {
        console.error('Wine update error:', wineError);
        throw wineError;
      }

      // Update flavor notes if provided
      if (wineData.flavorNotes !== undefined) {
        // Delete existing flavor notes
        await supabase
          .from('wine_flavor_notes')
          .delete()
          .eq('wine_id', wineId);

        // Add new flavor notes
        if (wineData.flavorNotes.length > 0) {
          await this.createWineFlavorNotes(wineId, wineData.flavorNotes);
        }
      }

      return { success: true, wine };
    } catch (error) {
      console.error('Error updating wine:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete visit and cleanup photos
  async deleteVisit(visitId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get visit and wine data first to cleanup photos
      const { data: visitData } = await supabase
        .from('visits')
        .select(`
          photo_url,
          wines (photo_url)
        `)
        .eq('id', visitId)
        .eq('user_id', user.id)
        .single();

      // Delete visit photos from storage
      if (visitData?.photo_url) {
        const visitPhotos = this.parsePhotoUrls(visitData.photo_url);
        await this.deletePhotos(visitPhotos, 'visit-photos');
      }

      // Delete wine photos from storage
      if (visitData?.wines) {
        for (const wine of visitData.wines) {
          if (wine.photo_url) {
            const winePhotos = this.parsePhotoUrls(wine.photo_url);
            await this.deletePhotos(winePhotos, 'wine-photos');
          }
        }
      }

      // Delete visit (will cascade delete wines and flavor notes due to foreign keys)
      const { error: deleteError } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Visit deletion error:', deleteError);
        throw deleteError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Get visit statistics
  async getVisitStats() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get basic counts
      const [visitsResult, wineriesResult, winesResult] = await Promise.all([
        supabase
          .from('visits')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('visits')
          .select('winery_id')
          .eq('user_id', user.id),
        supabase
          .from('wines')
          .select('id', { count: 'exact' })
          .in('visit_id', 
            supabase
              .from('visits')
              .select('id')
              .eq('user_id', user.id)
          )
      ]);

      const totalVisits = visitsResult.count || 0;
      const totalWineries = new Set(wineriesResult.data?.map(v => v.winery_id)).size;
      const totalWines = winesResult.count || 0;

      return {
        success: true,
        stats: {
          totalVisits,
          totalWineries,
          totalWines
        }
      };
    } catch (error) {
      console.error('Error getting visit stats:', error);
      return { success: false, error: error.message };
    }
  }
};