// lib/visits.js - Updated to properly handle wine data structure
import { supabase } from './supabase';

export const visitsService = {
  // Create a new visit with wines
  async createVisit(visitData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // First, create the visit record
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          winery_id: visitData.wineryId,
          visit_date: visitData.date,
          notes: visitData.notes || visitData.additionalNotes,
          photo_url: visitData.photoUri || visitData.wineryPhoto
        })
        .select()
        .single();

      if (visitError) {
        console.error('Visit creation error:', visitError);
        throw visitError;
      }

      console.log('Visit created successfully:', visit);

      // Then create wine records for each wine tried
      if (visitData.wines && visitData.wines.length > 0) {
        const winePromises = visitData.wines.map(wine => 
          this.createWineForVisit(visit.id, wine)
        );
        
        const wineResults = await Promise.all(winePromises);
        console.log('Wines created:', wineResults.length);
      }
      // Handle legacy winesTried field
      else if (visitData.winesTried && visitData.winesTried.length > 0) {
        const winePromises = visitData.winesTried.map(wine => 
          this.createWineForVisit(visit.id, wine)
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

  // Create a wine record for a visit
  async createWineForVisit(visitId, wineData) {
    try {
      // Normalize wine data structure
      const normalizedWine = {
        visit_id: visitId,
        wine_name: wineData.wineName || wineData.name || null,
        wine_type: wineData.wineType || wineData.type || 'Red',
        wine_varietal: wineData.wineVarietal || wineData.varietal || null,
        wine_year: wineData.wineYear || wineData.year || null,
        overall_rating: wineData.overallRating || 0,
        sweetness: wineData.wineRatings?.sweetness || wineData.ratings?.sweetness || 0,
        tannin: wineData.wineRatings?.tannin || wineData.ratings?.tannin || wineData.ratings?.tannins || 0,
        acidity: wineData.wineRatings?.acidity || wineData.ratings?.acidity || 0,
        body: wineData.wineRatings?.body || wineData.ratings?.body || 0,
        alcohol: wineData.wineRatings?.alcohol || wineData.ratings?.alcohol || 0,
        additional_notes: wineData.additionalNotes || null,
        photo_url: wineData.photo || wineData.photoUri || null
      };

      // Create the wine record
      const { data: wine, error: wineError } = await supabase
        .from('wines')
        .insert(normalizedWine)
        .select()
        .single();

      if (wineError) {
        console.error('Wine creation error:', wineError);
        throw wineError;
      }

      // Handle flavor notes if they exist
      if (wineData.flavorNotes && wineData.flavorNotes.length > 0) {
        await this.addFlavorNotesToWine(wine.id, wineData.flavorNotes);
      }

      return wine;
    } catch (error) {
      console.error('Error creating wine:', error);
      throw error;
    }
  },

  // Add flavor notes to a wine
  async addFlavorNotesToWine(wineId, flavorNotes) {
    try {
      // For each flavor note, find or create it, then link it to the wine
      for (const noteName of flavorNotes) {
        // First, try to find existing flavor note
        let { data: flavorNote, error: findError } = await supabase
          .from('flavor_notes')
          .select('id')
          .eq('name', noteName)
          .single();

        // If not found, create it (assuming it's a custom note in "Other" category)
        if (findError && findError.code === 'PGRST116') {
          const { data: newFlavorNote, error: createError } = await supabase
            .from('flavor_notes')
            .insert({
              name: noteName,
              category: 'Other' // Default category for custom notes
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating flavor note:', createError);
            continue; // Skip this note and continue with others
          }
          
          flavorNote = newFlavorNote;
        } else if (findError) {
          console.error('Error finding flavor note:', findError);
          continue;
        }

        // Link the flavor note to the wine
        const { error: linkError } = await supabase
          .from('wine_flavor_notes')
          .insert({
            wine_id: wineId,
            flavor_note_id: flavorNote.id
          });

        if (linkError) {
          console.error('Error linking flavor note to wine:', linkError);
        }
      }
    } catch (error) {
      console.error('Error adding flavor notes:', error);
    }
  },

  // Get all visits for the current user
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
            address
          ),
          wines (
            *,
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

      return { success: true, visits };
    } catch (error) {
      console.error('Error getting user visits:', error);
      return { success: false, error: error.message };
    }
  },

  // Get a specific visit by ID
  async getVisit(visitId) {
    try {
      const { data: visit, error } = await supabase
        .from('visits')
        .select(`
          *,
          wineries (
            id,
            name,
            address
          ),
          wines (
            *,
            wine_flavor_notes (
              flavor_notes (
                name,
                category
              )
            )
          )
        `)
        .eq('id', visitId)
        .single();

      if (error) {
        console.error('Error fetching visit:', error);
        throw error;
      }

      return { success: true, visit };
    } catch (error) {
      console.error('Error getting visit:', error);
      return { success: false, error: error.message };
    }
  }
};