// Unit tests for the derived drink-window logic in lib/cellar.js (#54).
// The module reaches Supabase at import time, so the client is stubbed — these
// tests exercise only the pure, derived-status helpers.
jest.mock('../lib/supabase', () => ({
  supabase: {
    // lib/cache.js subscribes to auth changes at import time.
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));

import {
  DRINK_WINDOW_STATUSES,
  READY_STATUSES,
  drinkWindowMeta,
  drinkWindowStatus,
  peakYear,
} from '../lib/cellar';

describe('drinkWindowStatus', () => {
  it('is unknown when neither bound is set', () => {
    expect(drinkWindowStatus(null, null, 2026)).toBeNull();
    expect(drinkWindowStatus('', '', 2026)).toBeNull();
  });

  it('is too_young before the window opens', () => {
    expect(drinkWindowStatus(2030, 2040, 2026)).toBe('too_young');
  });

  it('is ready in the middle of the window', () => {
    expect(drinkWindowStatus(2020, 2030, 2026)).toBe('ready');
  });

  it('is drink_up in the final stretch, including the closing year', () => {
    expect(drinkWindowStatus(2020, 2027, 2026)).toBe('drink_up');
    expect(drinkWindowStatus(2020, 2026, 2026)).toBe('drink_up');
  });

  it('is past_peak after the window closes', () => {
    expect(drinkWindowStatus(2010, 2020, 2026)).toBe('past_peak');
  });

  it('works with only one bound set', () => {
    expect(drinkWindowStatus(2030, null, 2026)).toBe('too_young');
    expect(drinkWindowStatus(null, 2020, 2026)).toBe('past_peak');
  });

  it('defaults to the current year when none is supplied', () => {
    const thisYear = new Date().getFullYear();
    expect(drinkWindowStatus(thisYear + 5, thisYear + 10)).toBe('too_young');
  });
});

describe('peakYear', () => {
  it('lands two thirds through the window', () => {
    expect(peakYear(2020, 2026)).toBe(2024);
  });

  it('returns null for incomplete or inverted windows', () => {
    expect(peakYear(2020, null)).toBeNull();
    expect(peakYear(null, 2026)).toBeNull();
    expect(peakYear(2030, 2020)).toBeNull();
  });
});

describe('drinkWindowMeta', () => {
  it('describes every status the taxonomy declares', () => {
    for (const status of DRINK_WINDOW_STATUSES) {
      const meta = drinkWindowMeta(status);
      expect(typeof meta.label).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(typeof meta.order).toBe('number');
    }
  });

  it('has a distinct sort order per status so grouping is stable', () => {
    const orders = DRINK_WINDOW_STATUSES.map((s) => drinkWindowMeta(s).order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('falls back to the unknown entry, sorted last', () => {
    const unknown = drinkWindowMeta(null);
    expect(unknown.label.length).toBeGreaterThan(0);
    for (const status of DRINK_WINDOW_STATUSES) {
      expect(unknown.order).toBeGreaterThan(drinkWindowMeta(status).order);
    }
  });

  it('counts only ready and drink_up as ready-to-drink', () => {
    expect(READY_STATUSES).toEqual(expect.arrayContaining(['ready', 'drink_up']));
    expect(READY_STATUSES).not.toContain('too_young');
    expect(READY_STATUSES).not.toContain('past_peak');
  });
});
