// lib/cellarRegion.js - Free-text region hygiene for the cellar (#88, Stage 1)
//
// docs/research/region-model.md decided AGAINST a country -> region -> AVA
// hierarchy: only four deterministic consumers care about the exact string
// (filter facets, group-by, and two insights counts) — the three AI consumers
// read it as prose and are indifferent to structure. So the whole problem is
// "stop the filter chips listing Napa Valley three times", and the cheapest
// place to fix that is at the point of entry.
//
// This mirrors lib/cellarLocation.js, which already solved the identical
// problem for storage locations ("so the same spot isn't spelled three ways").
// Pure functions over bottle rows: no Supabase, no writes.

// Trim + collapse internal whitespace. Deliberately does NOT touch the user's
// words or their casing — canonicalizeRegion is the only thing allowed to change
// a spelling, and only to one the user themselves already used.
export function normalizeRegion(value) {
  return (value == null ? '' : String(value)).trim().replace(/\s+/g, ' ');
}

// Distinct regions already in the cellar, case-insensitively deduped, sorted.
// Backs the add/edit form's region autocomplete.
//
// Unlike knownLocations (first-seen casing) this keeps the spelling the user
// uses MOST, so one stray lowercase entry can't rename the suggestion. Ties fall
// to first-seen, since Map preserves insertion order.
export function knownRegions(bottles = []) {
  const byKey = new Map(); // lower-case key -> Map(spelling -> count)
  for (const b of bottles) {
    const raw = normalizeRegion(b?.region);
    if (!raw) continue;
    const key = raw.toLowerCase();
    let spellings = byKey.get(key);
    if (!spellings) {
      spellings = new Map();
      byKey.set(key, spellings);
    }
    spellings.set(raw, (spellings.get(raw) || 0) + 1);
  }
  return [...byKey.values()]
    .map((s) => [...s.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0])
    .sort((a, b) => a.localeCompare(b));
}

// If the typed value case-insensitively matches a region the user has already
// used, adopt THAT spelling. This is the whole trick: "napa valley" collapses
// into the existing "Napa Valley" without ever second-guessing the words chosen.
// An unrecognised region passes through normalised but otherwise untouched —
// free text stays fully valid.
export function canonicalizeRegion(value, known = []) {
  const v = normalizeRegion(value);
  if (!v) return null;
  const lower = v.toLowerCase();
  const hit = known.find((k) => normalizeRegion(k).toLowerCase() === lower);
  return hit ? normalizeRegion(hit) : v;
}
