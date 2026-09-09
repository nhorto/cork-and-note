// Unit tests for the pure half of lib/exportTastings.js — the Pro-only CSV
// export (launch plan §4.2).
//
// The failure mode worth guarding is silent corruption: tasting notes are free
// text full of commas, quotes and newlines, and a file that opens but shifts
// every column is worse than one that fails loudly. The other is silent LOSS —
// a visit logged with no wines is still a journal entry.
// The module's share step reaches lib/visits → lib/supabase; the CSV building
// under test does not. Same stub the other lib suites use.
jest.mock('../lib/supabase', () => ({
  supabase: {
    // lib/cache.js subscribes to auth changes at import time.
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));

import {
  CSV_COLUMNS,
  csvEscape,
  exportFileName,
  toCsv,
  visitsToRows,
} from '../lib/exportTastings';

const visit = (overrides = {}) => ({
  visit_date: '2026-09-01',
  notes: 'Sunny afternoon',
  wineries: { name: 'Barboursville', address: '17655 Winery Rd' },
  wines: [],
  ...overrides,
});

const wine = (overrides = {}) => ({
  wine_name: 'Octagon',
  winemaker: 'Barboursville',
  wine_year: '2019',
  wine_type: 'Red',
  wine_varietal: ['Merlot', 'Cabernet Franc'],
  overall_rating: 4.5,
  sweetness: 1,
  tannin: 3.5,
  acidity: 3,
  body: 4,
  alcohol: 14.1,
  additional_notes: 'Needs another year',
  wine_flavor_notes: [
    { flavor_notes: { name: 'Black cherry', category: 'fruit' } },
    { flavor_notes: { name: 'Cedar', category: 'oak' } },
  ],
  ...overrides,
});

describe('csvEscape', () => {
  it('quotes everything, so a comma in a note cannot shift a column', () => {
    expect(csvEscape('Cherry, cedar')).toBe('"Cherry, cedar"');
    expect(csvEscape('plain')).toBe('"plain"');
  });

  it('doubles embedded quotes rather than ending the field early', () => {
    expect(csvEscape('the "good" one')).toBe('"the ""good"" one"');
  });

  it('keeps newlines inside the quoted field instead of breaking the row', () => {
    expect(csvEscape('line one\nline two')).toBe('"line one\nline two"');
  });

  it('renders null, undefined and zero without inventing text', () => {
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
    expect(csvEscape(0)).toBe('"0"');
  });
});

describe('visitsToRows', () => {
  it('emits one row per wine, repeating the visit columns', () => {
    const rows = visitsToRows([
      visit({ wines: [wine(), wine({ wine_name: 'Vermentino Reserve' })] }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('2026-09-01');
    expect(rows[1][0]).toBe('2026-09-01');
    expect(rows[1][3]).toBe('Vermentino Reserve');
  });

  it('keeps a visit that logged no wines, which is still a journal entry', () => {
    const rows = visitsToRows([visit({ wines: [] })]);
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe('Barboursville');
    expect(rows[0][rows[0].length - 1]).toBe('Sunny afternoon');
  });

  it('produces exactly one value per column, on every row shape', () => {
    // A short row silently shifts every later column in the spreadsheet.
    const rows = visitsToRows([visit({ wines: [wine()] }), visit({ wines: [] })]);
    for (const row of rows) {
      expect(row).toHaveLength(CSV_COLUMNS.length);
    }
  });

  it('flattens the varietal array and the nested flavor-note join', () => {
    const [row] = visitsToRows([visit({ wines: [wine()] })]);
    expect(row[7]).toBe('Merlot, Cabernet Franc');
    expect(row[14]).toBe('Black cherry; Cedar');
  });

  it('survives the half-empty records a real journal contains', () => {
    const [row] = visitsToRows([
      {
        visit_date: '2026-08-02',
        wineries: null,
        wines: [{ wine_name: 'Unknown pour' }],
      },
    ]);
    expect(row).toHaveLength(CSV_COLUMNS.length);
    expect(row[1]).toBe('');
    expect(row[14]).toBe('');
  });

  it('ignores junk instead of throwing mid-export', () => {
    expect(visitsToRows(null)).toEqual([]);
    expect(visitsToRows(undefined)).toEqual([]);
    expect(visitsToRows([null, undefined])).toEqual([]);
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and a header row', () => {
    const csv = toCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Date","Winery"');
  });

  it('separates rows with CRLF, which is what Excel expects', () => {
    const csv = toCsv([visit({ wines: [wine()] })]);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
  });

  it('round-trips a note containing a comma, a quote and a newline', () => {
    const csv = toCsv([
      visit({ notes: 'Rained,\nthen "cleared"', wines: [] }),
    ]);
    expect(csv).toContain('"Rained,\nthen ""cleared"""');
  });
});

describe('exportFileName', () => {
  it('is dated, so successive exports do not overwrite each other', () => {
    expect(exportFileName(new Date('2026-09-08T15:00:00Z'))).toBe(
      'cork-and-note-tastings-2026-09-08.csv'
    );
  });
});
