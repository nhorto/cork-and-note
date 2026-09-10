// __tests__/accountDeletion.test.js
//
// Guards the account-deletion path (#161, App Store Guideline 5.1.1(v) — and the
// promise the privacy policy makes: deleting your account removes your data).
//
// Coverage is currently held together by convention. A user-scoped table is
// cleared either because public.delete_user_data() names it, or because its
// user_id carries ON DELETE CASCADE and the edge function deletes the auth.users
// row last. Nothing enforces that a NEW table gets one of the two — and this is
// exactly the kind of gap that is invisible until someone audits it, because
// deletion still returns success with rows left behind.
//
// So: parse the migrations, work out how each user-scoped table would be
// cleared, and fail if any of them would not be.
//
// This reads the repo, not the database, so it runs offline in CI. The trade-off
// is that it trusts the migrations to describe the schema — true for anything
// added since 2026-06-08, but the tables restored from the backup that day have
// no CREATE TABLE here and are pinned in LEGACY_USER_TABLES below.
// scripts/verify-deletion-coverage.mjs re-checks the whole thing against the
// live database when the schema changes.
//
// The path itself was verified end-to-end against production on 2026-09-10:
// a throwaway account with rows seeded across places_usage, winery_reports,
// visits and chat_usage was deleted through the real edge function, and every
// table came back empty. This test exists to keep that true, not to establish it.
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const EDGE_FN = path.join(__dirname, '..', 'supabase', 'functions', 'delete-account', 'index.ts');

/**
 * User-scoped tables that predate the migration history — they arrived with the
 * 2026-06-08 backup restore, so no CREATE TABLE for them exists in this repo.
 * Values say how each one is cleared. Verified against production 2026-09-10.
 */
const LEGACY_USER_TABLES = {
  users: 'function', // the profile row; deleted last, before the auth.users row
  visits: 'function',
  wishlist: 'function',
  favorites: 'function',
  feedback: 'function',
  bug_reports: 'function',
  contact_messages: 'function',
};

/**
 * Tables with no user_id of their own. They hold user data but are cleared when
 * the parent row goes, via ON DELETE CASCADE. Value = the parent table.
 */
const CASCADE_CHILDREN = {
  wines: 'visits',
  wine_flavor_notes: 'wines',
  messages: 'conversations',
};

/** Shared reference data — no user-scoped rows, nothing to delete. */
const SHARED_CATALOGS = ['flavor_notes', 'winery_directory'];

function migrationSql() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }));
}

/**
 * Every table the migrations give a `user_id` column, and whether that column
 * cascades. Covers both `create table (... user_id ...)` and the
 * `alter table ... add column user_id ...` route (how wineries got one).
 */
function userScopedTablesFromMigrations() {
  const found = new Map();

  for (const { file, sql } of migrationSql()) {
    // create table [if not exists] public.<name> ( <body> );
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\);/gi;
    let m;
    while ((m = createRe.exec(sql)) !== null) {
      const [, table, body] = m;
      const userIdLine = body
        .split('\n')
        .find((line) => /^\s*user_id\s/i.test(line));
      if (!userIdLine) continue;
      found.set(table, { cascade: /on\s+delete\s+cascade/i.test(userIdLine), file });
    }

    // alter table public.<name> add column [if not exists] user_id ... ;
    const alterRe = /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?user_id\b([^;]*);/gi;
    while ((m = alterRe.exec(sql)) !== null) {
      const [, table, rest] = m;
      found.set(table, { cascade: /on\s+delete\s+cascade/i.test(rest), file });
    }
  }

  return found;
}

/** The tables the newest definition of delete_user_data() deletes from. */
function tablesDeletedByFunction() {
  let body = null;
  for (const { sql } of migrationSql()) {
    const m = /create\s+or\s+replace\s+function\s+public\.delete_user_data\(\)[\s\S]*?\n\$\$;/i.exec(sql);
    if (m) body = m[0]; // later migrations win — the function can be redefined
  }
  if (!body) throw new Error('No definition of public.delete_user_data() found in supabase/migrations');

  const tables = [];
  const re = /delete\s+from\s+(?:public\.)?(\w+)/gi;
  let m;
  while ((m = re.exec(body)) !== null) tables.push(m[1]);
  return tables;
}

describe('account deletion coverage', () => {
  const migrationTables = userScopedTablesFromMigrations();
  const deletedByFunction = tablesDeletedByFunction();

  it('finds the delete_user_data() definition and the tables it clears', () => {
    expect(deletedByFunction.length).toBeGreaterThan(5);
    expect(deletedByFunction).toContain('visits');
    expect(deletedByFunction).toContain('users');
  });

  it('clears every user-scoped table declared in a migration', () => {
    const uncovered = [];

    for (const [table, { cascade, file }] of migrationTables) {
      if (deletedByFunction.includes(table)) continue; // named in the function
      if (cascade) continue; // goes with the auth.users / users row
      uncovered.push(`${table} (added in ${file})`);
    }

    expect(uncovered).toEqual([]);
  });

  it('clears every user-scoped table that predates the migration history', () => {
    const uncovered = Object.entries(LEGACY_USER_TABLES)
      .filter(([table, how]) => how === 'function' && !deletedByFunction.includes(table))
      .map(([table]) => table);

    expect(uncovered).toEqual([]);
  });

  it('only deletes from tables that exist', () => {
    const known = new Set([
      ...migrationTables.keys(),
      ...Object.keys(LEGACY_USER_TABLES),
      ...Object.keys(CASCADE_CHILDREN),
      ...SHARED_CATALOGS,
    ]);
    const unknown = deletedByFunction.filter((t) => !known.has(t));

    expect(unknown).toEqual([]);
  });

  it('deletes the profile row last', () => {
    // public.users.id -> auth.users is NO ACTION and the child tables point at
    // public.users, so removing the profile first would fail on the FKs behind
    // it — and the edge function deletes the auth.users row only afterwards.
    expect(deletedByFunction[deletedByFunction.length - 1]).toBe('users');
  });

  it('runs the edge function steps in an order that can succeed', () => {
    const src = fs.readFileSync(EDGE_FN, 'utf8');
    const storage = src.indexOf('list_user_storage_objects');
    const rows = src.indexOf('rpc("delete_user_data")');
    const authUser = src.indexOf('admin.deleteUser');

    expect(storage).toBeGreaterThan(-1);
    expect(rows).toBeGreaterThan(-1);
    expect(authUser).toBeGreaterThan(-1);

    // Storage first (the rows naming the files are about to go), then the rows,
    // then the auth user — which is what cascades the auth.users-parented
    // tables. Deleting the auth user earlier fails on public.users' NO ACTION FK.
    expect(storage).toBeLessThan(rows);
    expect(rows).toBeLessThan(authUser);
  });
});
