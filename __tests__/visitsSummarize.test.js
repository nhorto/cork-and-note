// Unit tests for visitsService.summarizeVisits — the pure aggregation behind
// Home's "Where you've been" card. Place-less logs (null winery_id) must never
// surface as a nameless place (#99) or crash a tap-through (#98).
jest.mock('../lib/supabase', () => ({
  supabase: {
    // lib/cache.js subscribes to auth changes at import time.
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));

import { visitsService } from '../lib/visits';

const visit = (winery_id, name, visit_date) => ({
  id: `v-${winery_id}-${visit_date}`,
  winery_id,
  visit_date,
  wineries: name ? { name } : null,
});

describe('summarizeVisits', () => {
  it('handles empty and missing input', () => {
    expect(visitsService.summarizeVisits([])).toEqual({
      totalPlaces: 0,
      mostRecentPlace: null,
      topWinery: null,
    });
    expect(visitsService.summarizeVisits(null).totalPlaces).toBe(0);
  });

  it('counts distinct places, not visits', () => {
    const result = visitsService.summarizeVisits([
      visit(1, 'Barrel Oak', '2026-01-01'),
      visit(1, 'Barrel Oak', '2026-02-01'),
      visit(2, 'Hark', '2026-03-01'),
    ]);
    expect(result.totalPlaces).toBe(2);
  });

  it('ignores place-less logs entirely (#99)', () => {
    const result = visitsService.summarizeVisits([
      visit(null, null, '2026-05-01'),
      visit(1, 'Barrel Oak', '2026-01-01'),
    ]);
    expect(result.totalPlaces).toBe(1);
    expect(result.mostRecentPlace.name).toBe('Barrel Oak');
  });

  it('ignores a linked winery with no name rather than showing a blank row', () => {
    const result = visitsService.summarizeVisits([visit(7, null, '2026-05-01')]);
    expect(result.totalPlaces).toBe(0);
    expect(result.mostRecentPlace).toBeNull();
  });

  it('reports the most recent place regardless of input order', () => {
    const result = visitsService.summarizeVisits([
      visit(1, 'Barrel Oak', '2026-01-01'),
      visit(2, 'Hark', '2026-06-01'),
      visit(3, 'Chisolm', '2026-03-01'),
    ]);
    expect(result.mostRecentPlace).toEqual({ name: 'Hark', date: '2026-06-01' });
  });

  it('picks the most-visited winery as the top winery', () => {
    const result = visitsService.summarizeVisits([
      visit(1, 'Barrel Oak', '2026-01-01'),
      visit(1, 'Barrel Oak', '2026-02-01'),
      visit(2, 'Hark', '2026-06-01'),
    ]);
    expect(result.topWinery).toMatchObject({ name: 'Barrel Oak', visits: 2 });
  });

  it('breaks a visit-count tie with the more recent visit', () => {
    const result = visitsService.summarizeVisits([
      visit(1, 'Barrel Oak', '2026-01-01'),
      visit(2, 'Hark', '2026-06-01'),
    ]);
    expect(result.topWinery.name).toBe('Hark');
  });
});
