// lib/cellarLocation.js - Pure helpers for the cellar's storage location & shelf/slot (#62)
//
// Surfaces the existing free-text `location` column plus the previously-unused `bin`
// column (a shelf/slot like "Rack A3") so the cellar can answer "where is this bottle
// physically?" — InVintory's "virtual Dewey Decimal System", minus the 3D rack maps
// (an explicit non-goal). Every export is a small pure function over bottle rows: no
// Supabase, no writes, easy to unit-test. Persistence already works via lib/cellar.js
// (`location` + `bin` are both in BOTTLE_FIELDS), so this file never touches the service.

// Distinct, non-empty, case-insensitively-deduped storage locations the user has already
// typed, sorted alphabetically. Backs the add/edit form's location autocomplete so the
// same place ("Wine fridge") isn't re-typed three slightly different ways.
export function knownLocations(bottles = []) {
  const byKey = new Map(); // lower-case key -> first-seen original casing
  for (const b of bottles) {
    const raw = (b?.location ?? '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, raw);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

// One-line display of where a bottle lives: "Wine fridge · Rack A3". Gracefully handles
// a missing half (location only, bin only) and returns null when neither is set so callers
// can skip the row entirely.
export function locationLabel(bottle) {
  const location = (bottle?.location ?? '').trim();
  const bin = (bottle?.bin ?? '').trim();
  const parts = [location, bin].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
