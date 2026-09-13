// Unit tests for visitsService.summarizeVisits — the pure aggregation behind
// Home's "Where you've been" card. Place-less logs (null winery_id) must never
// surface as a nameless place (#99) or crash a tap-through (#98), and neither
// must a cellar-origin tasting, which carries the producer's winery_id but was
// poured at home (#294).
jest.mock('../lib/supabase', () => ({
  supabase: {
    // lib/cache.js subscribes to auth changes at import time.
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));

import { isWineryVisit, visitsService } from '../lib/visits';

// place_type defaults the way a real logged visit reads: 'winery' when a place
// was tagged, null when it was not. Pass it explicitly for the cellar-origin
// case (a winery_id with no place_type).
const visit = (winery_id, name, visit_date, place_type = winery_id ? 'winery' : null) => ({
  id: `v-${winery_id}-${visit_date}`,
  winery_id,
  place_type,
  visit_date,
  wineries: name ? { name } : null,
});

// A bottle opened at home: the producer is linked, the place is not.
const openedAtHome = (winery_id, name, visit_date) =>
  visit(winery_id, name, visit_date, null);

describe('isWineryVisit', () => {
  it('needs both a winery and place_type winery', () => {
    expect(isWineryVisit(visit(1, 'Barrel Oak', '2026-01-01'))).toBe(true);
    expect(isWineryVisit(openedAtHome(1, 'Barrel Oak', '2026-01-01'))).toBe(false);
    expect(isWineryVisit(visit(null, null, '2026-01-01'))).toBe(false);
    expect(isWineryVisit({ winery_id: null, place_type: 'winery' })).toBe(false);
    expect(isWineryVisit(null)).toBe(false);
  });

  it('does not count a restaurant or other place as a winery', () => {
    expect(isWineryVisit(visit(1, 'Rappahannock', '2026-01-01', 'restaurant'))).toBe(false);
    expect(isWineryVisit(visit(1, 'A festival', '2026-01-01', 'other'))).toBe(false);
  });
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

  it('ignores a bottle opened at home, however recent (#294)', () => {
    const result = visitsService.summarizeVisits([
      visit(1, 'Barrel Oak', '2026-01-01'),
      openedAtHome(2, 'Hark', '2026-06-01'),
    ]);
    expect(result.totalPlaces).toBe(1);
    expect(result.mostRecentPlace).toEqual({ name: 'Barrel Oak', date: '2026-01-01' });
    expect(result.topWinery).toMatchObject({ name: 'Barrel Oak', visits: 1 });
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

describe('summarizeVisitStats', () => {
  it('returns zero counters for empty or invalid input', () => {
    const empty = { totalVisits: 0, totalWineries: 0, totalWines: 0 };

    expect(visitsService.summarizeVisitStats([])).toEqual(empty);
    expect(visitsService.summarizeVisitStats(null)).toEqual(empty);
  });

  it('matches the visit stats semantics without another authenticated request', () => {
    const visits = [
      { ...visit(1, 'Barrel Oak', '2026-01-01'), wines: [{ id: 'w1' }, { id: 'w2' }] },
      { ...visit(1, 'Barrel Oak', '2026-02-01'), wines: [{ id: 'w3' }] },
      { ...visit(2, 'Hark', '2026-03-01'), wines: [] },
    ];

    expect(visitsService.summarizeVisitStats(visits)).toEqual({
      totalVisits: 3,
      totalWineries: 2,
      totalWines: 3,
    });
  });

  it('counts location-less tasting wines without inventing a place', () => {
    expect(visitsService.summarizeVisitStats([
      { ...visit(null, null, '2026-04-01'), wines: [{ id: 'w1' }] },
    ])).toEqual({
      totalVisits: 1,
      totalWineries: 0,
      totalWines: 1,
    });
  });

  it('counts an opened bottle as a tasting, never as a winery (#294)', () => {
    expect(visitsService.summarizeVisitStats([
      { ...openedAtHome(1, 'Barrel Oak', '2026-04-01'), wines: [{ id: 'w1' }] },
    ])).toEqual({
      totalVisits: 1,
      totalWineries: 0,
      totalWines: 1,
    });
  });

  it('does not double count a winery you have both visited and opened at home', () => {
    expect(visitsService.summarizeVisitStats([
      { ...visit(1, 'Barrel Oak', '2026-01-01'), wines: [{ id: 'w1' }] },
      { ...openedAtHome(1, 'Barrel Oak', '2026-04-01'), wines: [{ id: 'w2' }] },
    ])).toEqual({
      totalVisits: 2,
      totalWineries: 1,
      totalWines: 2,
    });
  });

  it('treats a missing wines relation as an empty list', () => {
    expect(visitsService.summarizeVisitStats([
      visit(1, 'Barrel Oak', '2026-01-01'),
    ]).totalWines).toBe(0);
  });
});
