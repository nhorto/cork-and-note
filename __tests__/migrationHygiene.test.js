// Migration hygiene, checked offline on every CI run.
//
// The live database has drifted from the repo twice (see docs/audits and the
// varietal corruption of 2026-07-16), and both times the first symptom was a
// table or column the client wrote to that no migration described. These
// checks cannot see the live database (scripts/verify-backend-parity.mjs
// does that) but they keep the repo's own story straight: every migration is
// named so it sorts by time, no two collide, and every table the client
// touches is either created in a migration or explicitly listed as restored
// from the 2026-06-08 backup.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

// Tables that predate the migrations directory: they came back with the
// 2026-06-08 restore and have no CREATE TABLE in this repo. Adding a table
// here is a deliberate act; a new table belongs in a migration.
const RESTORED_TABLES = new Set([
  'users', 'wineries', 'visits', 'wines', 'flavor_notes', 'wine_flavor_notes',
  'wishlist', 'favorites', 'feedback', 'bug_reports', 'contact_messages',
]);

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const sqlAll = files.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')).join('\n').toLowerCase();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('every migration file is named <timestamp>_<snake_case>.sql', () => {
  // The first two migrations predate the CLI convention and carry an 8-digit
  // day stamp. They are recorded live under those versions, so they keep
  // their names; everything since uses the full 14 digits.
  const bad = files.filter((f) => !/^(\d{8}|\d{14})_[a-z0-9_]+\.sql$/.test(f));
  expect(bad).toEqual([]);
  expect(files.length).toBeGreaterThan(20);
});

test('timestamps are unique and strictly increasing in directory order', () => {
  const versions = files.map((f) => f.split('_')[0]);
  expect(new Set(versions).size).toBe(versions.length);
  for (let i = 1; i < versions.length; i++) {
    expect(versions[i] > versions[i - 1]).toBe(true);
  }
});

test('every timestamp is a real date in the past, so a typo cannot sort a migration into the future', () => {
  const now = new Date();
  for (const f of files) {
    const v = f.split('_')[0].padEnd(14, '0');
    const date = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12), +v.slice(12, 14)));
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(date.getTime()).toBeLessThan(now.getTime() + 24 * 3_600_000);
    expect(+v.slice(4, 6)).toBeLessThanOrEqual(12);
    expect(+v.slice(6, 8)).toBeLessThanOrEqual(31);
  }
});

test('every table the client reads or writes is created in a migration or listed as restored', () => {
  const referenced = new Set();
  for (const file of ['lib', 'app', 'components', 'hooks'].flatMap((d) => walk(path.join(ROOT, d)))) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) referenced.add(m[1]);
  }
  expect(referenced.size).toBeGreaterThan(15);
  const unexplained = [...referenced].filter((table) => {
    if (RESTORED_TABLES.has(table)) return false;
    return !new RegExp(`create table (if not exists )?(public\\.)?${table}\\b`).test(sqlAll);
  });
  expect(unexplained).toEqual([]);
});

test('every table a migration creates has row-level security switched on in some migration', () => {
  const created = [...sqlAll.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)].map((m) => m[1]);
  const missing = created.filter((table) => !new RegExp(`alter table (?:public\\.)?${table}\\s+enable row level security`).test(sqlAll));
  expect(missing).toEqual([]);
});

test('every storage bucket policy in a migration names a bucket the code uses', () => {
  const buckets = new Set();
  for (const m of sqlAll.matchAll(/bucket_id = '([a-z-]+)'/g)) buckets.add(m[1]);
  const used = new Set();
  for (const file of ['lib', 'app', 'components'].flatMap((d) => walk(path.join(ROOT, d)))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/storage\s*\.from\(\s*['"]([a-z-]+)['"]/g)) used.add(m[1]);
    for (const m of src.matchAll(/uploadPhotos\([^,]+,\s*['"]([a-z-]+)['"]/g)) used.add(m[1]);
  }
  for (const b of used) expect(buckets.has(b)).toBe(true);
});
