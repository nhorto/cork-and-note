// lib/cellar.js - Wine Cellar (inventory) data layer — Epic #6
// Mirrors the visits/wishlist service pattern: each method authenticates, scopes
// to the current user, and returns { success, ... } or { success: false, error }.
import { supabase } from './supabase';
import { visitsService } from './visits';

// Columns a client is allowed to write to cellar_bottles. Anything else is ignored.
const BOTTLE_FIELDS = [
  'winery_id', 'producer', 'wine_name', 'vintage', 'wine_type', 'varietal', 'region',
  'quantity', 'bottle_size', 'location', 'bin',
  'purchase_date', 'purchase_price', 'currency', 'store', 'current_value',
  'drink_from', 'drink_by', 'rating', 'notes',
];

function pickBottleFields(data) {
  const out = {};
  for (const key of BOTTLE_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

// Derived drink-window status (no stored column — see cellar-schema.md §4).
// Returns one of 'too_young' | 'ready' | 'drink_up' | 'past_peak' | null (unknown).
export function drinkWindowStatus(drinkFrom, drinkBy, year) {
  const y = year ?? new Date().getFullYear();
  const from = drinkFrom ? Number(drinkFrom) : null;
  const by = drinkBy ? Number(drinkBy) : null;
  if (!from && !by) return null;
  if (from && y < from) return 'too_young';
  if (by && y > by) return 'past_peak';
  if (by && y >= by - 1) return 'drink_up'; // final stretch of the window
  return 'ready';
}

export const READY_STATUSES = ['ready', 'drink_up'];

// ── Canonical drink-window taxonomy (R4, issue #54) ─────────────────────────
// ONE source of truth for how the four derived statuses (plus the unknown/null
// case) are presented app-wide: the human label, badge color, a terse "short"
// label for tight chips, the AI-prompt phrasing, and a stable sort `order`
// (soonest-to-act first). Every consumer — the cellar list badge, the detail
// badge, the browse filter facet, the sommelier prompt, the Home "Ready to
// Drink" strip — reads from here so the wording never drifts. The enum VALUES
// returned by drinkWindowStatus() are unchanged; this only centralizes display.
//
// Color note: these reference styles/theme.js, but lib/ is theme-agnostic, so we
// inline the hex values (kept in sync with colors.status / colors.gold). UI code
// may map a status to a theme token instead via DRINK_WINDOW_META keys.
export const DRINK_WINDOW_META = {
  too_young: {
    status: 'too_young',
    label: 'Too young',
    short: 'Too young',
    color: '#6B7B8B', // colors.status.wishlist (slate)
    prompt: 'still too young',
    order: 3,
  },
  ready: {
    status: 'ready',
    label: 'Ready',
    short: 'Ready',
    color: '#5B7B5B', // colors.status.visited (sage)
    prompt: 'ready to drink',
    order: 2,
  },
  drink_up: {
    status: 'drink_up',
    label: 'Drink soon',
    short: 'Drink soon',
    color: '#B8976A', // colors.gold.shimmer
    prompt: 'drink up soon (final stretch)',
    order: 1,
  },
  past_peak: {
    status: 'past_peak',
    label: 'Past peak',
    short: 'Past peak',
    color: '#9B3B3B', // colors.status.error
    prompt: 'likely past peak',
    order: 0,
  },
};

// Presentation for the "unknown" (null status — no window set) case.
export const DRINK_WINDOW_UNKNOWN = {
  status: null,
  label: 'No window',
  short: 'No window',
  color: '#7A7A7A', // colors.neutral.pewter
  prompt: 'drink window unknown',
  order: 4,
};

// The four real statuses ordered soonest-to-act first (past peak → drink soon →
// ready → too young) — handy for the Home strip and any status iteration.
export const DRINK_WINDOW_STATUSES = ['past_peak', 'drink_up', 'ready', 'too_young'];

// Canonical meta for a status (accepts a status string, the 'Unknown' sentinel
// used by the browse filter, or null/undefined → the unknown case).
export function drinkWindowMeta(status) {
  if (status && DRINK_WINDOW_META[status]) return DRINK_WINDOW_META[status];
  return DRINK_WINDOW_UNKNOWN;
}

// Convenience label/prompt accessors used by consumers that only need the text.
export function drinkWindowLabel(status) {
  return drinkWindowMeta(status).label;
}
export function drinkWindowPrompt(status) {
  return drinkWindowMeta(status).prompt;
}

// Derive the heuristic "peak" year from the window. There is NO peak column
// (see cellar-schema.md §4) — we estimate it as ~2/3 of the way into
// [drink_from, drink_by], the point where most wines are showing their best.
// Returns an integer year or null when the window is incomplete.
export function peakYear(drinkFrom, drinkBy) {
  const from = drinkFrom != null && drinkFrom !== '' ? Number(drinkFrom) : null;
  const by = drinkBy != null && drinkBy !== '' ? Number(drinkBy) : null;
  if (!Number.isFinite(from) || !Number.isFinite(by) || by < from) return null;
  return Math.round(from + (by - from) * (2 / 3));
}

function annotate(bottle) {
  return { ...bottle, drinkStatus: drinkWindowStatus(bottle.drink_from, bottle.drink_by) };
}

export const cellarService = {
  // List the user's lots. By default only what's still in the cellar.
  async getCellar({ includeRemoved = false } = {}) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      let query = supabase
        .from('cellar_bottles')
        .select(`*, wineries ( id, name )`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!includeRemoved) query = query.eq('status', 'in_cellar');

      const { data, error } = await query;
      if (error) throw error;

      return { success: true, bottles: (data || []).map(annotate) };
    } catch (error) {
      console.error('Error getting cellar:', error);
      return { success: false, error: error.message };
    }
  },

  // A single lot (with its consumption history).
  async getBottle(bottleId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('cellar_bottles')
        .select(`*, wineries ( id, name ), cellar_consumptions ( * )`)
        .eq('id', bottleId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return { success: true, bottle: annotate(data) };
    } catch (error) {
      console.error('Error getting bottle:', error);
      return { success: false, error: error.message };
    }
  },

  async addBottle(data) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const fields = pickBottleFields(data);
      if (!fields.wine_name) throw new Error('A wine name is required');

      const { data: bottle, error } = await supabase
        .from('cellar_bottles')
        .insert({ ...fields, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return { success: true, bottle: annotate(bottle) };
    } catch (error) {
      console.error('Error adding bottle:', error);
      return { success: false, error: error.message };
    }
  },

  async updateBottle(bottleId, data) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data: bottle, error } = await supabase
        .from('cellar_bottles')
        .update(pickBottleFields(data))
        .eq('id', bottleId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, bottle: annotate(bottle) };
    } catch (error) {
      console.error('Error updating bottle:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteBottle(bottleId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('cellar_bottles')
        .delete()
        .eq('id', bottleId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting bottle:', error);
      return { success: false, error: error.message };
    }
  },

  // Open / remove a lot. Decrements quantity, records a consumption, and — when
  // logTasting is true — auto-creates a location-optional logging session with one
  // wine prefilled from the bottle (the Epic #6 ⇄ #5 marquee integration, #26).
  async openBottle(bottleId, {
    quantity = 1,
    reason = 'consumed',
    note,
    logTasting = false,
    tastingDate,
  } = {}) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Load the lot (and confirm ownership).
      const { data: bottle, error: loadError } = await supabase
        .from('cellar_bottles')
        .select('*, wineries ( name )')
        .eq('id', bottleId)
        .eq('user_id', user.id)
        .single();
      if (loadError) throw loadError;

      const qty = Math.max(1, Number(quantity) || 1);
      if (qty > bottle.quantity) {
        throw new Error(`Only ${bottle.quantity} left in this lot`);
      }

      // Optionally log a tasting (auto one-wine, no-location session).
      let wineId = null;
      if (logTasting) {
        const { data: visit, error: visitError } = await supabase
          .from('visits')
          .insert({
            user_id: user.id,
            winery_id: bottle.winery_id ?? null,
            place_type: bottle.winery_id ? 'winery' : null,
            visit_date: tastingDate || new Date().toISOString().slice(0, 10),
            notes: note ?? null,
            photo_url: JSON.stringify([]),
          })
          .select()
          .single();
        if (visitError) throw visitError;

        const wine = await visitsService.createWineForVisit(visit.id, {
          winemaker: bottle.producer ?? bottle.wineries?.name ?? null,
          name: bottle.wine_name,
          varietal: bottle.varietal,
          type: bottle.wine_type,
          year: bottle.vintage,
        }, user.id);
        wineId = wine?.id ?? null;
      }

      // Record the consumption.
      const { error: consumptionError } = await supabase
        .from('cellar_consumptions')
        .insert({
          user_id: user.id,
          bottle_id: bottleId,
          consumed_date: tastingDate || new Date().toISOString().slice(0, 10),
          reason,
          quantity: qty,
          note: note ?? null,
          wine_id: wineId,
        });
      if (consumptionError) throw consumptionError;

      // Decrement the lot; when it hits zero, retire it with the given reason.
      const remaining = bottle.quantity - qty;
      const { data: updated, error: updateError } = await supabase
        .from('cellar_bottles')
        .update({
          quantity: remaining,
          status: remaining <= 0 ? reason : 'in_cellar',
        })
        .eq('id', bottleId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (updateError) throw updateError;

      return { success: true, bottle: annotate(updated), wineId };
    } catch (error) {
      console.error('Error opening bottle:', error);
      return { success: false, error: error.message };
    }
  },

  // Summary for the Home tab (#27).
  async getCellarStats() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('cellar_bottles')
        .select('quantity, drink_from, drink_by')
        .eq('user_id', user.id)
        .eq('status', 'in_cellar');
      if (error) throw error;

      const rows = data || [];
      const totalBottles = rows.reduce((sum, b) => sum + (b.quantity || 0), 0);

      // Count LOTS per derived drink-window status (drives the Home "Ready to
      // Drink" strip, R4/#54). `unknown` collects lots with no window set.
      const byStatus = { too_young: 0, ready: 0, drink_up: 0, past_peak: 0, unknown: 0 };
      for (const b of rows) {
        const status = drinkWindowStatus(b.drink_from, b.drink_by);
        byStatus[status ?? 'unknown'] += 1;
      }
      const readyToDrink = byStatus.ready + byStatus.drink_up;

      return {
        success: true,
        stats: { lots: rows.length, totalBottles, readyToDrink, byStatus },
      };
    } catch (error) {
      console.error('Error getting cellar stats:', error);
      return { success: false, error: error.message };
    }
  },
};
