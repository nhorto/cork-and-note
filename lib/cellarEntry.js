// lib/cellarEntry.js - Read-only suggestion data for faster cellar entry (#53, Epic #6)
//
// Powers the producer/wine autocomplete on the "Add a bottle" form so an enthusiast
// can REUSE the wineries & wines already in the app instead of retyping (and creating
// duplicate "Opus One" / "Opus One Winery" records). This module is read-only: it never
// writes — the create path stays in lib/cellar.js (cellarService.addBottle).
//
// Data sources (all owner-scoped via RLS):
//   - wineries the user has touched, via visits + wishlist (mirrors wineriesService.getUserWineries)
//   - wines the user has logged, via their visits (wines.visit_id -> visits.user_id)
//
// A picked producer carries its `winery_id` so the bottle can be linked (dedupe). A picked
// wine carries the producer/type/varietal we already know, so those fields prefill.
import { supabase } from './supabase';
import { varietalText } from './varietals';

// Normalize a name for case/space-insensitive de-duplication.
const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Known producers = the wineries the user has interacted with (visits + wishlist).
// Each suggestion exposes { id (winery_id), name } so a pick can link winery_id.
export async function getKnownProducers() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { success: false, producers: [] };

    const [visitsResult, wishlistResult] = await Promise.all([
      supabase
        .from('visits')
        .select('wineries ( id, name )')
        .eq('user_id', user.id),
      supabase
        .from('wishlist')
        .select('wineries ( id, name )')
        .eq('user_id', user.id),
    ]);

    const byId = new Map();
    const collect = (rows) => {
      (rows || []).forEach((row) => {
        const w = row.wineries;
        if (w && w.id != null && w.name) byId.set(w.id, w);
      });
    };
    collect(visitsResult.data);
    collect(wishlistResult.data);

    const producers = Array.from(byId.values())
      .map((w) => ({ id: w.id, name: w.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, producers };
  } catch (error) {
    console.error('Error getting known producers:', error);
    return { success: false, error: error.message, producers: [] };
  }
}

// Known wines = the distinct wines the user has logged across their visits.
// Each suggestion carries everything we can prefill on the cellar form:
//   { name, producer, wine_type, varietal, winery_id }
// Wines join to a winery indirectly through their visit, so we read the visit's
// winery to recover producer + winery_id for linking/dedupe.
export async function getKnownWines() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { success: false, wines: [] };

    const { data, error } = await supabase
      .from('visits')
      .select(`
        wineries ( id, name ),
        wines ( wine_name, winemaker, wine_type, wine_varietal, wine_year )
      `)
      .eq('user_id', user.id);
    if (error) throw error;

    // De-dupe by (name + producer); keep the first non-empty value seen per field.
    const byKey = new Map();
    (data || []).forEach((visit) => {
      const winery = visit.wineries || null;
      (visit.wines || []).forEach((w) => {
        const name = (w.wine_name || '').trim();
        if (!name) return;
        const producer = (w.winemaker || winery?.name || '').trim() || null;
        const key = `${norm(name)}|${norm(producer)}`;
        const prev = byKey.get(key);
        const merged = {
          name,
          producer: prev?.producer || producer,
          wine_type: prev?.wine_type || (w.wine_type || '').trim() || null,
          varietal: prev?.varietal || varietalText(w.wine_varietal) || null,
          winery_id: prev?.winery_id ?? winery?.id ?? null,
        };
        byKey.set(key, merged);
      });
    });

    const wines = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, wines };
  } catch (error) {
    console.error('Error getting known wines:', error);
    return { success: false, error: error.message, wines: [] };
  }
}

// Convenience: load both lists in parallel for the add-bottle form.
export async function getEntrySuggestions() {
  const [producersRes, winesRes] = await Promise.all([getKnownProducers(), getKnownWines()]);
  return {
    producers: producersRes.producers || [],
    wines: winesRes.wines || [],
  };
}
