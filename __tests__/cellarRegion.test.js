// Unit tests for lib/cellarRegion.js (#88 Stage 1). The point of the module is
// "stop the filter chips listing Napa Valley three times" without ever
// second-guessing the user's own words, so the invariants pinned here are the
// dedupe/adoption rules, not the exact strings.
import {
  canonicalizeRegion,
  knownRegions,
  normalizeRegion,
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
