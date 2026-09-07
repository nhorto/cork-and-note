// Unit tests for lib/winesBrowse.js — the filter/sort logic behind the
// "Your tastings" screen (#170 Layer C). Pure functions, no mocks needed.
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  applySort,
  facetOptions,
  hasActiveFilters,
} from '../lib/winesBrowse';

const wine = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  wine_name: 'Test Red',
  wine_type: 'Red',
  wineryName: 'Test Estate',
  wine_varietal: ['Merlot'],
  overall_rating: 4,
  visitDate: '2026-01-01',
  ...over,
});

describe('hasActiveFilters / activeFilterCount', () => {
  it('treats the empty filter set as inactive', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('counts each selected facet value and a rating floor', () => {
    const filters = { ...EMPTY_FILTERS, types: ['Red', 'White'], minRating: 4 };
    expect(hasActiveFilters(filters)).toBe(true);
    expect(activeFilterCount(filters)).toBe(3);
  });
});

describe('facetOptions', () => {
  it('dedupes case-insensitively and keeps the most-used spelling (#88/#151)', () => {
    const wines = [
      wine({ wineryName: 'Barrel Oak' }),
      wine({ wineryName: 'barrel oak' }),
      wine({ wineryName: 'Barrel Oak' }),
    ];
    expect(facetOptions(wines).wineries).toEqual([{ value: 'Barrel Oak', count: 3 }]);
  });

  it('emits one facet per grape of a multi-varietal wine (#135)', () => {
    const varietals = facetOptions([
      wine({ wine_varietal: ['Cabernet Sauvignon', 'Merlot'] }),
      wine({ wine_varietal: ['Merlot'] }),
    ]).varietals;
    expect(varietals).toEqual([
      { value: 'Cabernet Sauvignon', count: 1 },
      { value: 'Merlot', count: 2 },
    ]);
  });

  it('ignores blank and missing values rather than creating an empty chip', () => {
    const types = facetOptions([
      wine({ wine_type: 'Red' }),
      wine({ wine_type: '   ' }),
      wine({ wine_type: null }),
    ]).types;
    expect(types).toEqual([{ value: 'Red', count: 1 }]);
  });
});

describe('applyFilters', () => {
  it('returns the input untouched when nothing is selected', () => {
    const wines = [wine(), wine()];
    expect(applyFilters(wines, EMPTY_FILTERS)).toBe(wines);
  });

  it('ORs within a facet and ANDs across facets', () => {
    const red = wine({ wine_type: 'Red', wineryName: 'A' });
    const white = wine({ wine_type: 'White', wineryName: 'A' });
    const otherRed = wine({ wine_type: 'Red', wineryName: 'B' });
    const result = applyFilters([red, white, otherRed], {
      ...EMPTY_FILTERS,
      types: ['Red', 'White'],
      wineries: ['A'],
    });
    expect(result).toEqual([red, white]);
  });

  it('matches a wine when ANY of its grapes is selected', () => {
    const blend = wine({ wine_varietal: ['Cabernet Sauvignon', 'Merlot'] });
    const other = wine({ wine_varietal: ['Chardonnay'] });
    expect(
      applyFilters([blend, other], { ...EMPTY_FILTERS, varietals: ['Merlot'] })
    ).toEqual([blend]);
  });

  it('matches facet values regardless of case', () => {
    const w = wine({ wine_type: 'red' });
    expect(applyFilters([w], { ...EMPTY_FILTERS, types: ['Red'] })).toEqual([w]);
  });

  it('excludes unrated wines from a minimum-rating filter', () => {
    const good = wine({ overall_rating: 4.5 });
    const weak = wine({ overall_rating: 3 });
    const unrated = wine({ overall_rating: null });
    expect(
      applyFilters([good, weak, unrated], { ...EMPTY_FILTERS, minRating: 4 })
    ).toEqual([good]);
  });
});

describe('applySort', () => {
  it('orders by most recent tasting by default', () => {
    const older = wine({ visitDate: '2026-01-01' });
    const newer = wine({ visitDate: '2026-06-01' });
    expect(applySort([older, newer], 'recent')).toEqual([newer, older]);
  });

  it('sorts by rating in both directions, treating missing ratings as lowest', () => {
    const five = wine({ overall_rating: 5 });
    const three = wine({ overall_rating: 3 });
    const none = wine({ overall_rating: null });
    expect(applySort([three, none, five], 'rating_desc')).toEqual([five, three, none]);
    expect(applySort([three, none, five], 'rating_asc')).toEqual([none, three, five]);
  });

  it('does not mutate the array it is given', () => {
    const input = [wine({ visitDate: '2026-01-01' }), wine({ visitDate: '2026-06-01' })];
    const snapshot = [...input];
    applySort(input, 'recent');
    expect(input).toEqual(snapshot);
  });
});
