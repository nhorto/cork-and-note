// Unit tests for lib/varietals.js. parseVarietals is the function at the heart
// of the 2026-07 JSON-corruption incident (an array shape written into a text
// column), so the shapes it must tolerate are pinned here deliberately.
import {
  inferTypeFromVarietal,
  matchVarietal,
  parseVarietals,
  varietalText,
} from '../lib/varietals';

describe('parseVarietals', () => {
  it('passes an array through, trimmed', () => {
    expect(parseVarietals(['Merlot', ' Syrah '])).toEqual(['Merlot', 'Syrah']);
  });

  it('splits legacy comma-joined text', () => {
    expect(parseVarietals('Cabernet Sauvignon, Merlot')).toEqual([
      'Cabernet Sauvignon',
      'Merlot',
    ]);
  });

  it('returns an empty array for null/undefined/empty rather than throwing', () => {
    expect(parseVarietals(null)).toEqual([]);
    expect(parseVarietals(undefined)).toEqual([]);
    expect(parseVarietals('')).toEqual([]);
  });

  it('drops empty segments from ragged input', () => {
    expect(parseVarietals('Merlot,,  , Syrah')).toEqual(['Merlot', 'Syrah']);
  });
});

describe('varietalText', () => {
  it('renders any accepted shape as a display string', () => {
    expect(varietalText(['Merlot', 'Syrah'])).toBe('Merlot, Syrah');
    expect(varietalText('Merlot')).toBe('Merlot');
    expect(varietalText(null)).toBe('');
  });

  it('honours a custom separator', () => {
    expect(varietalText(['Merlot', 'Syrah'], ' · ')).toBe('Merlot · Syrah');
  });
});

describe('inferTypeFromVarietal', () => {
  it('infers from the first recognised grape', () => {
    expect(inferTypeFromVarietal('Chardonnay')).toBe('White');
    expect(inferTypeFromVarietal(['Merlot'])).toBe('Red');
  });

  it('returns null for grapes it does not recognise', () => {
    expect(inferTypeFromVarietal('Nonexistent Grape')).toBeNull();
    expect(inferTypeFromVarietal(null)).toBeNull();
  });
});

describe('matchVarietal', () => {
  it('canonicalises an exact grape name regardless of case', () => {
    expect(matchVarietal('merlot')).toBe('Merlot');
  });

  it('does not fire on a wine name that merely contains a grape', () => {
    expect(matchVarietal('Barrel Oak Cabernet')).toBeNull();
  });

  it('handles empty input', () => {
    expect(matchVarietal('')).toBeNull();
    expect(matchVarietal(null)).toBeNull();
  });
});
