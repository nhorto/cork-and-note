// lib/cellarRegion.js - Region hygiene for the cellar (#88)
//
// Stage 1 (#154) kept region free text and fixed the duplicates it could reach
// from the user's own data: autocomplete over regions they had already typed,
// plus "adopt the spelling you used last time" on write. That works, but it is
// blind on the first bottle from a place — a brand-new cellar has nothing to
// suggest and nothing to normalise toward.
//
// So the suggestion list is now the user's own regions UNIONED with the curated
// reference list in lib/wineRegions.js (docs/research/region-model.md §5.2,
// scoped down as §11.3 option 1 proposes). The user's own regions come first:
// what they have already logged is the strongest signal of what they log next.
//
// Still free text, still no schema change, still no migration. The reference
// list only ever suggests and re-spells; it never rejects a region and never
// invents one.
//
// Mirrors lib/cellarLocation.js, which solved the identical problem for storage
// locations. Pure functions over bottle rows: no Supabase, no writes.
import {
  WINE_REGIONS,
  findRegion,
  regionCandidates,
  regionKey,
  regionSubtitle,
} from './wineRegions';

// Trim + collapse internal whitespace. Deliberately does NOT touch the user's
// words or their casing — canonicalizeRegion is the only thing allowed to change
// a spelling, and only to one that is already on offer.
export function normalizeRegion(value) {
  return (value == null ? '' : String(value)).trim().replace(/\s+/g, ' ');
}

// Distinct regions already in the cellar, case-insensitively deduped, sorted.
// This is the user's own history only — regionSuggestions() is what the form
// shows, and it folds the reference list in on top.
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

// What the region autocomplete offers: the user's own regions first, then every
// reference region they haven't used yet. Suggestions carry the parent chain as
// a subtitle, which is what tells a Virginia collector that the Shenandoah
// Valley on offer is the one in Virginia and not the one in the Sierra
// Foothills.
//
// De-duplication is by reference identity, not by string: a user who typed
// "monticello ava" and the reference "Monticello" are one suggestion, spelled
// the reference way. A region the list has never heard of is kept verbatim —
// obscure appellations are exactly what free text is for.
//
// Order is load-bearing. AutocompleteInput shows the first few substring
// matches in list order, so the user's own regions have to come first.
export function regionSuggestions(userRegions = []) {
  const out = [];
  const seen = new Set();

  for (const entry of userRegions) {
    const typed = normalizeRegion(typeof entry === 'string' ? entry : entry?.name);
    if (!typed) continue;
    const reference = findRegion(typed);
    const name = reference ? reference.name : typed;
    const key = regionKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      aliases: reference ? reference.aliases : [],
      subtitle: reference ? regionSubtitle(name) : null,
      source: 'cellar',
    });
  }
  for (const suggestion of referenceSuggestions()) {
    if (!seen.has(regionKey(suggestion.name))) out.push(suggestion);
  }

  return out;
}

// The reference half of every suggestion list, built once on first use rather
// than on every mount of the form. The records are read-only and shared.
let REFERENCE_SUGGESTIONS = null;
function referenceSuggestions() {
  if (!REFERENCE_SUGGESTIONS) {
    REFERENCE_SUGGESTIONS = WINE_REGIONS.map((region) => ({
      name: region.name,
      aliases: region.aliases,
      subtitle: regionSubtitle(region.name),
      source: 'reference',
    }));
  }
  return REFERENCE_SUGGESTIONS;
}

// Re-spell a typed region as one of the suggestions on offer, so the same place
// can't land in the cellar under two spellings and split into two filter chips.
//
// `known` is the suggestion list — plain strings (the user's own regions) or
// records from regionSuggestions(). Matching ignores case, accents and
// punctuation, and will drop an appellation tier or a trailing ", Country" if
// that is what it takes to recognise the place: "barolo docg" and
// "Napa Valley, California" are the reference regions Barolo and Napa Valley.
//
// Everything else passes through normalised but otherwise untouched. Nothing is
// ever rewritten into a region that isn't already being suggested, so this can
// only ever collapse a duplicate — it can't relabel a wine.
export function canonicalizeRegion(value, known = []) {
  const v = normalizeRegion(value);
  if (!v) return null;

  const entries = [];
  for (const entry of known) {
    const name = normalizeRegion(typeof entry === 'string' ? entry : entry?.name);
    if (!name) continue;
    entries.push({ name, aliases: (typeof entry === 'string' ? null : entry?.aliases) || [] });
  }

  // Most literal candidate first, and a real name always beats someone's alias.
  for (const candidate of regionCandidates(v)) {
    const key = regionKey(candidate);
    const byName = entries.find((e) => regionKey(e.name) === key);
    if (byName) return byName.name;
    const byAlias = entries.find((e) => e.aliases.some((a) => regionKey(a) === key));
    if (byAlias) return byAlias.name;
  }
  return v;
}
