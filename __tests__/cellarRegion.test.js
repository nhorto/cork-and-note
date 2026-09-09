// Unit tests for lib/cellarRegion.js (#88 Stage 1). The point of the module is
// "stop the filter chips listing Napa Valley three times" without ever
// second-guessing the user's own words, so the invariants pinned here are the
// dedupe/adoption rules, not the exact strings.
import {
  canonicalizeRegion,
  knownRegions,
  normalizeRegion,
  regionSuggestions,
} from '../lib/cellarRegion';

describe('normalizeRegion', () => {
  it('trims and collapses internal whitespace but never edits words or casing', () => {
    expect(normalizeRegion('  Napa   Valley ')).toBe('Napa Valley');
    expect(normalizeRegion('willamette valley')).toBe('willamette valley');
  });

  it('maps null/undefined/blank to an empty string rather than throwing', () => {
    expect(normalizeRegion(null)).toBe('');
    expect(normalizeRegion(undefined)).toBe('');
    expect(normalizeRegion('   ')).toBe('');
  });
});

describe('knownRegions', () => {
  const bottle = (region) => ({ region });

  it('dedupes case-insensitively and returns a sorted list', () => {
    const regions = knownRegions([
      bottle('Napa Valley'),
      bottle('napa valley'),
      bottle('Alsace'),
    ]);
    expect(regions).toEqual(['Alsace', 'Napa Valley']);
  });

  it('keeps the majority spelling, so one stray entry cannot rename the suggestion', () => {
    const regions = knownRegions([
      bottle('napa valley'), // stray lowercase, seen first
      bottle('Napa Valley'),
      bottle('Napa Valley'),
    ]);
    expect(regions).toEqual(['Napa Valley']);
  });

  it('falls back to first-seen spelling on a tie', () => {
    const regions = knownRegions([bottle('Rioja'), bottle('RIOJA')]);
    expect(regions).toEqual(['Rioja']);
  });

  it('skips bottles with no usable region', () => {
    expect(knownRegions([bottle(null), bottle('  '), null, bottle('Chablis')])).toEqual([
      'Chablis',
    ]);
    expect(knownRegions()).toEqual([]);
  });
});

describe('canonicalizeRegion', () => {
  const known = ['Napa Valley', 'Willamette Valley'];

  it('adopts the existing spelling on a case-insensitive match', () => {
    expect(canonicalizeRegion('napa valley', known)).toBe('Napa Valley');
    expect(canonicalizeRegion('  NAPA   VALLEY ', known)).toBe('Napa Valley');
  });

  it('passes an unrecognised region through normalised but otherwise untouched', () => {
    expect(canonicalizeRegion('  Monticello  AVA ', known)).toBe('Monticello AVA');
  });

  it('returns null for empty input so callers can store SQL NULL', () => {
    expect(canonicalizeRegion('', known)).toBeNull();
    expect(canonicalizeRegion('   ', known)).toBeNull();
    expect(canonicalizeRegion(null, known)).toBeNull();
  });
});

describe('regionSuggestions', () => {
  const names = (list) => list.map((r) => r.name);

  it('suggests reference regions to a cellar that has none of its own', () => {
    // The whole point: before this, an empty cellar suggested nothing at all,
    // and the first Virginia bottle had nothing to normalise toward.
    const suggestions = regionSuggestions([]);
    expect(names(suggestions)).toEqual(expect.arrayContaining(['Monticello', 'Napa Valley']));
    expect(suggestions.find((r) => r.name === 'Monticello')).toMatchObject({
      subtitle: 'Virginia · United States',
      source: 'reference',
    });
  });

  it("puts the user's own regions first — it is the strongest signal of what they log", () => {
    const suggestions = regionSuggestions(['Rocky Knob', 'Backyard Vines']);
    expect(names(suggestions).slice(0, 2)).toEqual(['Rocky Knob', 'Backyard Vines']);
    expect(suggestions.slice(0, 2).map((r) => r.source)).toEqual(['cellar', 'cellar']);
  });

  it('folds a region the user already has into one suggestion, spelled the reference way', () => {
    const suggestions = regionSuggestions(['monticello ava']);
    const monticello = suggestions.filter((r) => r.name === 'Monticello');
    expect(monticello).toHaveLength(1);
    expect(monticello[0].source).toBe('cellar');
    expect(names(suggestions)).not.toContain('monticello ava');
  });

  it('keeps a region the reference list has never heard of, verbatim', () => {
    const suggestions = regionSuggestions(['Honah Lee Hollow']);
    expect(suggestions[0]).toMatchObject({ name: 'Honah Lee Hollow', subtitle: null });
  });

  it('skips blanks and survives junk rows', () => {
    const suggestions = regionSuggestions(['  ', null, undefined, 'Rioja']);
    expect(suggestions[0].name).toBe('Rioja');
  });
});

describe('canonicalizeRegion against the reference list', () => {
  const suggestions = regionSuggestions(['Backyard Vines']);

  it('adopts the reference spelling, which is the point of having one', () => {
    expect(canonicalizeRegion('napa valley', suggestions)).toBe('Napa Valley');
    expect(canonicalizeRegion('cote rotie', suggestions)).toBe('Côte-Rôtie');
    expect(canonicalizeRegion('VA', suggestions)).toBe('Virginia');
  });

  it('collapses the label transcriptions that produced duplicate chips', () => {
    // docs/research/region-model.md §11: a Virginia estate wine says
    // "Monticello AVA" and the scanner reads "Barolo DOCG" straight off a label.
    expect(canonicalizeRegion('Monticello AVA', suggestions)).toBe('Monticello');
    expect(canonicalizeRegion('barolo docg', suggestions)).toBe('Barolo');
    expect(canonicalizeRegion('Napa Valley, California', suggestions)).toBe('Napa Valley');
  });

  it("still adopts the user's own spelling for a place the list has never heard of", () => {
    expect(canonicalizeRegion('backyard vines', suggestions)).toBe('Backyard Vines');
  });

  it('never relabels a wine — an unknown region passes straight through', () => {
    expect(canonicalizeRegion('Honah Lee Hollow', suggestions)).toBe('Honah Lee Hollow');
    // Virginia and Monticello are genuinely different appellations. Knowing that
    // one is inside the other must not turn either into the other.
    expect(canonicalizeRegion('Virginia', suggestions)).toBe('Virginia');
    expect(canonicalizeRegion('Monticello', suggestions)).toBe('Monticello');
  });
});
