// Tests for lib/flavorNotes.js — the library behind the rebuilt flavor picker
// (#216). Pins the two behaviors the redesign depends on: flat ranked search
// (the fix for "type st, open four collapsed categories") and a Popular tab
// that can never drift out of the real library.
import {
  FLAVOR_CATEGORIES,
  POPULAR_FLAVORS,
  flavorCategoryOf,
  searchFlavorNotes,
} from '../lib/flavorNotes';

describe('searchFlavorNotes', () => {
  it('returns one flat list across every category', () => {
    const results = searchFlavorNotes('st');
    // Spans at least Fruit (Strawberry), Earth & Mineral (Wet Stone), Other (Toast)
    const cats = new Set(results.map(flavorCategoryOf));
    expect(results).toContain('Strawberry');
    expect(results).toContain('Wet Stone');
    expect(cats.size).toBeGreaterThanOrEqual(3);
  });

  it('ranks exact, then prefix, then substring matches', () => {
    const results = searchFlavorNotes('cherry');
    expect(results[0]).toBe('Cherry'); // exact beats "Black Cherry" etc.
    const prefixless = searchFlavorNotes('oak');
    expect(prefixless[0]).toBe('Oak');
    expect(prefixless).toContain('Toasted Oak');
  });

  it('is case-insensitive and trims', () => {
    expect(searchFlavorNotes('  STRAW ')).toContain('Strawberry');
  });

  it('returns an empty list for blank queries', () => {
    expect(searchFlavorNotes('')).toEqual([]);
    expect(searchFlavorNotes(null)).toEqual([]);
  });
});

describe('flavorCategoryOf', () => {
  it('maps a library note to its category and unknowns to null', () => {
    expect(flavorCategoryOf('Strawberry')).toBe('Fruit');
    expect(flavorCategoryOf('Minerality')).toBe('Earth & Mineral');
    expect(flavorCategoryOf('Totally Custom')).toBeNull();
  });
});

describe('library integrity', () => {
  it('every Popular note exists in the category library', () => {
    const all = new Set(Object.values(FLAVOR_CATEGORIES).flat());
    const missing = POPULAR_FLAVORS.filter((t) => !all.has(t));
    expect(missing).toEqual([]);
  });

  it('has no duplicate notes across categories', () => {
    const all = Object.values(FLAVOR_CATEGORIES).flat();
    const dupes = all.filter((t, i) => all.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });
});
