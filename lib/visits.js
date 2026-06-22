// Updated lib/visits.js - Multiple photos support
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { cached, CACHE_KEYS, invalidate } from './cache';
import { supabase } from './supabase';

export const visitsService = {
  // Upload multiple photos to Supabase storage.
  //
  // Returns only the successfully-resolved URLs. Callers detect drops by
  // comparing the input length to the result length (see #128) and surface a
  // warning rather than silently losing a photo. Already-uploaded https URLs are
  // passed through untouched so this is safe to call on a mixed local/remote
  // list too.
  async uploadPhotos(photos, bucketName, folderPrefix = '') {
    if (!photos || photos.length === 0) return [];

    const uploadPromises = photos.map(async (photoUri, index) => {
      try {
        // Already in storage (e.g. editing an existing wine): keep as-is.
        if (typeof photoUri === 'string' && /^https?:\/\//i.test(photoUri)) {
          return photoUri;
        }
        if (!photoUri || typeof photoUri !== 'string') {
          throw new Error('Missing photo URI');
        }

        // Create unique filename
        const timestamp = new Date().getTime();
        const randomId = Math.random().toString(36).substring(2);
        const fileName = `${folderPrefix}${timestamp}_${randomId}_${index}.jpg`;

        // Confirm the local file actually exists and has bytes BEFORE reading.
        // On iOS some picker/camera URIs would otherwise fail the base64 read and
        // get swallowed, silently dropping the photo while the save "succeeded"
        // (#128). A missing or 0-byte file now raises a real, logged error.
        const info = await FileSystem.getInfoAsync(photoUri, { size: true });
        if (!info.exists) {
          throw new Error(`Local photo not found: ${photoUri}`);
        }
        if (info.size === 0) {
          throw new Error(`Local photo is empty (0 bytes): ${photoUri}`);
        }

        // Read the local file as base64, then upload the decoded bytes.
        // NOTE: fetch(localUri).blob() returns an EMPTY blob for file:// URIs in
        // Expo/RN, which silently uploaded 0-byte images. Reading via
        // expo-file-system + base64-arraybuffer uploads the real bytes.
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) {
          throw new Error(`Read empty image data: ${photoUri}`);
        }

        // Upload to Supabase storage
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, decode(base64), {
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

      // Upload winery photos if any. Track any that fail to upload so we can
      // warn the user instead of silently dropping them (#128).
      let wineryPhotoUrls = [];
      let photosFailed = 0;
      if (visitData.wineryPhotos && visitData.wineryPhotos.length > 0) {
        wineryPhotoUrls = await this.uploadPhotos(
          visitData.wineryPhotos,
          'visit-photos',
          `visit_${user.id}_`
        );
        photosFailed += visitData.wineryPhotos.length - wineryPhotoUrls.length;
      }

      // Create visit record with photos as JSON array
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          winery_id: visitData.wineryId ?? null,
          place_type: visitData.placeType ?? (visitData.wineryId ? 'winery' : null),
          place_name: visitData.placeName ?? null,
          latitude: visitData.latitude ?? null,
          longitude: visitData.longitude ?? null,
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
        photosFailed += wineResults.reduce((n, r) => n + (r?.photosFailed || 0), 0);
        console.log('Wines created:', wineResults.length);
      }

      // A new tasting changes the visits list AND the derived stats.
      invalidate(CACHE_KEYS.visits, CACHE_KEYS.visitStats);
      return { success: true, visit, photosFailed };
    } catch (error) {
      console.error('Error creating visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Create wine for visit with photos.
  // Returns { wine, photosFailed } so the caller can warn when a photo upload
  // was dropped instead of silently losing it (#128).
  async createWineForVisit(visitId, wineData, userId) {
    try {
      // Upload wine photos if any
      let winePhotoUrls = [];
      let photosFailed = 0;
      if (wineData.photos && wineData.photos.length > 0) {
        winePhotoUrls = await this.uploadPhotos(
          wineData.photos,
          'wine-photos',
          `wine_${userId}_`
        );
        photosFailed = wineData.photos.length - winePhotoUrls.length;
      }

      // Insert wine record
      const { data: wine, error: wineError } = await supabase
        .from('wines')
        .insert({
          visit_id: visitId,
          winemaker: wineData.winemaker ?? null,
          wine_name: wineData.name || wineData.varietal || 'Wine',
          wine_type: wineData.type ?? null,
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

      return { wine, photosFailed };
    } catch (error) {
      console.error('Error creating wine:', error);
      throw error;
    }
  },

  // Link a wine to flavor notes by name.
  // Selected names that aren't in the shared `flavor_notes` catalog yet — i.e.
  // custom notes the user typed in — are added to the catalog first, then linked.
  // Previously these custom notes were silently dropped (the lookup only matched
  // existing rows), and the catalog insert was blocked by a missing RLS policy.
  async createWineFlavorNotes(wineId, flavorNotes) {
    try {
      if (!flavorNotes || flavorNotes.length === 0) {
        return;
      }

      // Which of the selected notes already exist in the catalog?
      const { data: existingNotes, error: flavorError } = await supabase
        .from('flavor_notes')
        .select('id, name')
        .in('name', flavorNotes);

      if (flavorError) {
        console.error('Error fetching flavor notes:', flavorError);
        return;
      }

      let allNotes = existingNotes || [];
      const existingNames = new Set(allNotes.map(note => note.name));
      const missingNames = flavorNotes.filter(name => !existingNames.has(name));

      // Add any custom notes that aren't in the catalog yet. They're shared
      // entries (the table has no per-user ownership) and `name` is UNIQUE, so
      // ignore conflicts in case the same note was added concurrently elsewhere.
      if (missingNames.length > 0) {
        const { error: insertNotesError } = await supabase
          .from('flavor_notes')
          .upsert(
            missingNames.map(name => ({ name, category: 'Custom' })),
            { onConflict: 'name', ignoreDuplicates: true }
          );

        if (insertNotesError) {
          console.error('Error creating custom flavor notes:', insertNotesError);
        }

        // Re-fetch so we have ids for both pre-existing and newly added notes.
        const { data: refetchedNotes, error: refetchError } = await supabase
          .from('flavor_notes')
          .select('id, name')
          .in('name', flavorNotes);

        if (refetchError) {
          console.error('Error fetching flavor notes:', refetchError);
          return;
        }

        allNotes = refetchedNotes || [];
      }

      // Link the wine to each flavor note.
      const connections = allNotes.map(note => ({
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
    return cached(CACHE_KEYS.visits, () => this._getUserVisits());
  },

  async _getUserVisits() {
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
            winemaker,
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

  // Get a single logging session (same nested shape as getUserVisits), scoped
  // to the current user. Used by the edit flow to hydrate the form.
  async getVisit(visitId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: visit, error } = await supabase
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
            winemaker,
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
        .eq('id', visitId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching visit:', error);
        throw error;
      }

      // Parse photo URLs from JSON strings (mirror getUserVisits)
      const visitWithPhotos = {
        ...visit,
        photos: this.parsePhotoUrls(visit.photo_url),
        wines: visit.wines?.map(wine => ({
          ...wine,
          photos: this.parsePhotoUrls(wine.photo_url)
        })) || []
      };

      return { success: true, visit: visitWithPhotos };
    } catch (error) {
      console.error('Error getting visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Split a photo list into already-uploaded Supabase URLs (keep as-is) and new
  // local URIs that still need uploading. On edit we must NOT re-fetch/re-upload
  // remote https URLs — they're already in storage.
  partitionPhotos(photos) {
    const existing = [];
    const toUpload = [];
    (photos || []).forEach((p) => {
      if (typeof p === 'string' && /^https?:\/\//i.test(p)) {
        existing.push(p);
      } else if (p) {
        toUpload.push(p);
      }
    });
    return { existing, toUpload };
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

      // Handle photo updates if provided. Only upload NEW local URIs; keep
      // already-uploaded Supabase https URLs as-is (don't re-fetch/re-upload).
      let photoUpdate = {};
      let photosFailed = 0;
      if (visitData.wineryPhotos !== undefined) {
        const { existing, toUpload } = this.partitionPhotos(visitData.wineryPhotos);
        const uploaded = await this.uploadPhotos(
          toUpload,
          'visit-photos',
          `visit_${user.id}_`
        );
        photosFailed = toUpload.length - uploaded.length;

        photoUpdate = {
          photo_url: JSON.stringify([...existing, ...uploaded])
        };
      }

      // Mirror createVisit's place fields so editing can add/change/clear a place.
      const placeUpdate = {};
      if (visitData.wineryId !== undefined) placeUpdate.winery_id = visitData.wineryId ?? null;
      if (visitData.placeType !== undefined) placeUpdate.place_type = visitData.placeType ?? null;
      if (visitData.placeName !== undefined) placeUpdate.place_name = visitData.placeName ?? null;
      if (visitData.latitude !== undefined) placeUpdate.latitude = visitData.latitude ?? null;
      if (visitData.longitude !== undefined) placeUpdate.longitude = visitData.longitude ?? null;

      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .update({
          visit_date: visitData.date,
          notes: visitData.notes,
          ...placeUpdate,
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

      invalidate(CACHE_KEYS.visits, CACHE_KEYS.visitStats);
      return { success: true, visit, photosFailed };
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

      // Handle photo updates if provided. Only upload NEW local URIs; keep
      // already-uploaded Supabase https URLs as-is (don't re-fetch/re-upload).
      let photoUpdate = {};
      let photosFailed = 0;
      if (wineData.photos !== undefined) {
        const { existing, toUpload } = this.partitionPhotos(wineData.photos);
        const uploaded = await this.uploadPhotos(
          toUpload,
          'wine-photos',
          `wine_${user.id}_`
        );
        photosFailed = toUpload.length - uploaded.length;

        photoUpdate = {
          photo_url: JSON.stringify([...existing, ...uploaded])
        };
      }

      const { data: wine, error: wineError } = await supabase
        .from('wines')
        .update({
          winemaker: wineData.winemaker ?? null,
          wine_name: wineData.name || wineData.varietal || 'Wine',
          wine_type: wineData.type ?? null,
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

      // Wine data is nested inside the cached visits list.
      invalidate(CACHE_KEYS.visits);
      return { success: true, wine, photosFailed };
    } catch (error) {
      console.error('Error updating wine:', error);
      return { success: false, error: error.message };
    }
  },

  // Remove a single wine from a session (used when editing a saved log).
  // Cleans up storage + dependent rows explicitly: the wine_flavor_notes FK has
  // NO ON DELETE CASCADE, so we delete those rows ourselves rather than relying
  // on a cascade. (cellar_consumptions.wine_id is ON DELETE SET NULL, so a
  // cellar-linked tasting simply has its link nulled — acceptable.)
  async removeWine(wineId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Clean up wine photos from storage first.
      const { data: wineRow } = await supabase
        .from('wines')
        .select('photo_url')
        .eq('id', wineId)
        .single();

      if (wineRow?.photo_url) {
        const winePhotos = this.parsePhotoUrls(wineRow.photo_url);
        await this.deletePhotos(winePhotos, 'wine-photos');
      }

      // Explicitly delete flavor-note links (no ON DELETE CASCADE on this FK).
      const { error: notesError } = await supabase
        .from('wine_flavor_notes')
        .delete()
        .eq('wine_id', wineId);

      if (notesError) {
        console.error('Error deleting wine flavor notes:', notesError);
        throw notesError;
      }

      // Delete the wine row itself.
      const { error: wineError } = await supabase
        .from('wines')
        .delete()
        .eq('id', wineId);

      if (wineError) {
        console.error('Error deleting wine:', wineError);
        throw wineError;
      }

      // Removing a wine changes the visits list and the wine count.
      invalidate(CACHE_KEYS.visits, CACHE_KEYS.visitStats);
      return { success: true };
    } catch (error) {
      console.error('Error removing wine:', error);
      return { success: false, error: error.message };
    }
  },

  // Orchestrate a full edit of a saved logging session:
  //  - update the session/place fields (extended updateVisit),
  //  - diff the wines against the originals: matching id → updateWine,
  //    new (no id) → createWineForVisit, original id no longer present → removeWine.
  // Returns { success, visit, errors } aggregating any per-wine failures.
  async updateSession(visitId, sessionData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const errors = [];
      let photosFailed = 0;

      // 1. Session + place fields. Map the form's `wines[]` photos field is not
      //    used here — only the visit-level fields. (Form sends visit photos
      //    via wineryPhotos when present.)
      const visitResult = await this.updateVisit(visitId, sessionData);
      if (!visitResult.success) {
        return { success: false, error: visitResult.error };
      }
      photosFailed += visitResult.photosFailed || 0;

      // 2. Determine the original set of wine ids for this session.
      let originalWineIds = sessionData.originalWineIds;
      if (!Array.isArray(originalWineIds)) {
        const { data: existingWines } = await supabase
          .from('wines')
          .select('id')
          .eq('visit_id', visitId);
        originalWineIds = (existingWines || []).map(w => w.id);
      }

      const incomingWines = sessionData.wines || [];
      const incomingIds = new Set(
        incomingWines.filter(w => w.id).map(w => w.id)
      );

      // 3. Removed wines: present originally, absent now.
      const removedIds = originalWineIds.filter(id => !incomingIds.has(id));
      for (const removedId of removedIds) {
        const res = await this.removeWine(removedId);
        if (!res.success) errors.push(res.error);
      }

      // 4. Existing wines → update; new wines → create.
      for (const wine of incomingWines) {
        if (wine.id) {
          const res = await this.updateWine(wine.id, wine);
          if (!res.success) errors.push(res.error);
          else photosFailed += res.photosFailed || 0;
        } else {
          try {
            const created = await this.createWineForVisit(visitId, wine, user.id);
            photosFailed += created?.photosFailed || 0;
          } catch (e) {
            errors.push(e.message);
          }
        }
      }

      // Belt-and-suspenders: new wines are added via createWineForVisit (which
      // doesn't invalidate on its own), so refresh the visits slice here too.
      invalidate(CACHE_KEYS.visits, CACHE_KEYS.visitStats);
      return {
        success: errors.length === 0,
        visit: visitResult.visit,
        photosFailed,
        errors: errors.length ? errors : undefined,
        error: errors.length ? errors.join('; ') : undefined,
      };
    } catch (error) {
      console.error('Error updating session:', error);
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

      invalidate(CACHE_KEYS.visits, CACHE_KEYS.visitStats);
      return { success: true };
    } catch (error) {
      console.error('Error deleting visit:', error);
      return { success: false, error: error.message };
    }
  },

  // Get visit statistics
  async getVisitStats() {
    return cached(CACHE_KEYS.visitStats, () => this._getVisitStats());
  },

  async _getVisitStats() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Fetch the user's visits (id + winery_id), then count wines by visit id.
      // NOTE: .in() needs a real array — passing a query builder as a subquery
      // throws a TypeError, which previously broke this whole call.
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('id, winery_id')
        .eq('user_id', user.id);
      if (visitsError) throw visitsError;

      const visitIds = (visits || []).map(v => v.id);
      const totalVisits = visitIds.length;
      // "Places" = distinct wineries actually attached. Location-optional logs
      // have a null winery_id and must not be counted as a place.
      const totalWineries = new Set(
        (visits || []).map(v => v.winery_id).filter(Boolean)
      ).size;

      let totalWines = 0;
      if (visitIds.length > 0) {
        const { count, error: winesError } = await supabase
          .from('wines')
          .select('id', { count: 'exact', head: true })
          .in('visit_id', visitIds);
        if (winesError) throw winesError;
        totalWines = count || 0;
      }

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
  },

  // Derive at-a-glance "where you've been" highlights from a visits array
  // (the shape getUserVisits returns). Pure — no network — so a caller that
  // already has the visits can reuse them. Place-less logs (null winery_id) are
  // ignored for place/winery aggregates so they never surface as a nameless
  // place (see #99).
  summarizeVisits(visits) {
    const placed = (visits || []).filter(v => v.winery_id && v.wineries?.name);

    // Distinct places visited.
    const totalPlaces = new Set(placed.map(v => v.winery_id)).size;

    // Most-recent place by visit date.
    let mostRecentPlace = null;
    for (const v of placed) {
      if (!mostRecentPlace || new Date(v.visit_date) > new Date(mostRecentPlace.date)) {
        mostRecentPlace = { name: v.wineries.name, date: v.visit_date };
      }
    }

    // Top / most-visited winery by visit count (ties broken by most recent).
    const counts = new Map(); // winery_id -> { name, visits, lastDate }
    for (const v of placed) {
      const cur =
        counts.get(v.winery_id) ||
        { name: v.wineries.name, visits: 0, lastDate: v.visit_date };
      cur.visits += 1;
      if (new Date(v.visit_date) > new Date(cur.lastDate)) cur.lastDate = v.visit_date;
      counts.set(v.winery_id, cur);
    }
    let topWinery = null;
    for (const c of counts.values()) {
      if (
        !topWinery ||
        c.visits > topWinery.visits ||
        (c.visits === topWinery.visits && new Date(c.lastDate) > new Date(topWinery.lastDate))
      ) {
        topWinery = c;
      }
    }

    return { totalPlaces, mostRecentPlace, topWinery };
  }
};