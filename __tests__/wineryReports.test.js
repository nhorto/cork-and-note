// Guards the "Report a problem" flow (#225): the client's reason list must
// stay in lockstep with the winery_reports check constraint — a drifted
// value would pass client validation and then fail the insert at the DB.
// lib/wineryReports pulls in lib/supabase, whose AsyncStorage dependency has
// no native module under jest — stub it; these tests only need the constants.
jest.mock('../lib/supabase', () => ({ supabase: {} }));

const fs = require('fs');
const path = require('path');
const { REPORT_REASONS } = require('../lib/wineryReports');

const MIGRATION = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260910120000_directory_freshness.sql'
);

test('every client reason value is allowed by the DB check constraint', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const m = sql.match(/reason text not null check \(reason in \(([^)]+)\)\)/);
  expect(m).not.toBeNull();
  const dbReasons = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(dbReasons.sort());
});

test('reasons have user-facing labels', () => {
  for (const r of REPORT_REASONS) {
    expect(typeof r.label).toBe('string');
    expect(r.label.length).toBeGreaterThan(0);
  }
});
