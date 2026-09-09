// Unit tests for lib/varietals.js. parseVarietals is the function at the heart
// of the 2026-07 JSON-corruption incident (an array shape written into a text
// column), so the shapes it must tolerate are pinned here deliberately.
import {
  WINE_VARIETALS,
  inferTypeFromVarietal,
  matchVarietal,
  parseVarietals,
  searchVarietals,
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
  it.each([
    ['Petit Manseng', 'White'], ['Traminette', 'White'], ['Rkatsiteli', 'White'],
    ['Marquette', 'Red'], ['Baco Noir', 'Red'], ['Nerello Mascalese', 'Red'],
    ['Touriga Franca', 'Red'], ['Xarel·lo', 'White'], ['Narince', 'White'],
    ['Frontenac', 'Red'], ['Frontenac Blanc', 'White'], ['Frontenac Gris', 'White'],
    ['Durif', 'Red'], ['Alvarinho', 'White'], ['shiraz', 'Red'],
  ])('recognises %s as %s', (grape, type) => {
    expect(inferTypeFromVarietal(grape)).toBe(type);
    expect(searchVarietals(grape)).toContain(matchVarietal(grape));
  });

  it('keeps named blends ambiguous and existing styles available', () => {
    expect(inferTypeFromVarietal('Bordeaux Blend')).toBeNull();
    expect(inferTypeFromVarietal('Field Blend')).toBeNull();
    expect(inferTypeFromVarietal('Champagne')).toBe('Sparkling');
    expect(inferTypeFromVarietal('Port')).toBe('Dessert');
  });

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
  it.each([
    ['  petit   manseng ', 'Petit Manseng'],
    ['gruner veltliner', 'Grüner Veltliner'],
    ['nero d’avola', "Nero d'Avola"],
    ['xarel-lo', 'Xarel·lo'],
    ['spatburgunder', 'Pinot Noir'],
    ['syrah', 'Syrah/Shiraz'],
    ['monastrell', 'Mourvèdre'],
  ])('matches spelling or alias %s', (input, expected) => {
    expect(matchVarietal(input)).toBe(expected);
  });

  it('preserves existing display names that share grape identities', () => {
    for (const name of WINE_VARIETALS) expect(matchVarietal(name)).toBe(name);
  });

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

describe('searchVarietals', () => {
  it('finds accented grapes without needing an accented keyboard', () => {
    expect(searchVarietals('albarino')[0]).toBe('Albariño');
    expect(searchVarietals('gewurz')).toContain('Gewürztraminer');
    expect(searchVarietals('leon millot')).toContain('Léon Millot');
  });

  it('finds alternate label names and ranks exact matches before prefixes', () => {
    expect(searchVarietals('shiraz')[0]).toBe('Syrah/Shiraz');
    expect(searchVarietals('alvarinho')[0]).toBe('Albariño');
    expect(searchVarietals('frontenac')).toEqual([
      'Frontenac', 'Frontenac Blanc', 'Frontenac Gris',
    ]);
    expect(searchVarietals('muscat')[0]).toBe('Muscat');
  });

  it('keeps every match reachable instead of truncating to five results', () => {
    const matches = searchVarietals('blanc');
    expect(matches.length).toBeGreaterThan(5);
    expect(matches).toContain('Sauvignon Blanc');
    expect(matches).toContain('Blanc du Bois');
    expect(matches).toContain('Muscat Blanc à Petits Grains');
    expect(new Set(matches).size).toBe(matches.length);
  });

  it('returns no suggestions for empty or unknown input and permits custom grapes', () => {
    for (const input of [null, '', '  ', '---', 'My Local Grape']) {
      expect(searchVarietals(input)).toEqual([]);
    }
    expect(parseVarietals(['My Local Grape'])).toEqual(['My Local Grape']);
    expect(matchVarietal('My Local Grape')).toBeNull();
  });

  it('has no duplicate catalogue labels', () => {
    const keys = WINE_VARIETALS.map((name) => name.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
