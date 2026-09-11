// Name agreement for the directory validation pass (#273): a Google text
// search is fuzzy and returns the nearest winery in the box for any query,
// so a match must share distinctive words before its status is trusted.
import { haversineKm, namesAgree } from '../scripts/lib/directory-match.mjs';

describe('namesAgree', () => {
  test.each([
    ['Barrel Oak Winery', 'Barrel Oak Winery and Brewery'],
    ['Davesté Vineyards', 'Daveste Vineyards'],
    ['Chisolm Winery', 'Chisholm Vineyards at Adventure Farm'], // one typo in a distinctive word
    ['Hark', 'Hark Vineyards'],
    ['Prince Michel Vinyard and Winery', 'Prince Michel Vineyard & Winery'],
    ['Janemark Winery & Vineyard', 'Janemark Winery & Vineyard'],
    ['Sonoma-cutrer Vineyards', 'Sonoma-Cutrer Vineyards'],
  ])('agrees: %s ~ %s', (a, b) => {
    expect(namesAgree(a, b)).toBe(true);
  });

  test.each([
    ['Aspen Dale Winery at the Barn', 'Naked Mountain Winery'],
    ['Smithfield Winery', 'Summerwind Vineyard'],
    ['Great Shoals Winery', 'Chain Bridge Cellars'],
    ['Virginia Wine Country', 'Old Farm Winery at Hartland'],
  ])('disagrees: %s vs %s', (a, b) => {
    expect(namesAgree(a, b)).toBe(false);
  });

  test('a name made only of generic words leaves the decision to distance', () => {
    expect(namesAgree('The Winery', 'Naked Mountain Winery')).toBe(true);
  });
});

test('haversineKm: Delaplane to Marshall is about 10 km', () => {
  expect(haversineKm(38.9166, -77.953, 38.865, -77.855)).toBeCloseTo(10.3, 0);
});
