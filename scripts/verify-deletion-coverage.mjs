// scripts/verify-deletion-coverage.mjs — check the account-deletion path against
// the LIVE database.
//
// __tests__/accountDeletion.test.js enforces the same rule offline by reading
// the migrations, which is what belongs in CI. But two things it cannot see:
// tables restored from the 2026-06-08 backup (no CREATE TABLE in this repo), and
// anything applied to the project outside a migration. This closes that gap —
// run it whenever the schema changes, or when the test's LEGACY_USER_TABLES
// constant needs re-verifying.
//
//   node scripts/verify-deletion-coverage.mjs
//
// Needs a Supabase personal access token in SUPABASE_ACCESS_TOKEN or
// ~/.supabase/access-token. Read-only: it runs SELECTs against the catalog.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = 'ixecayqpogkiawempzgc';

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    return readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
  } catch {
    return null;
  }
}

const token = accessToken();
if (!token) {
  console.error('No Supabase access token (SUPABASE_ACCESS_TOKEN or ~/.supabase/access-token).');
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Every public table, and whether it has a user_id column.
const tables = await sql(`
  select t.table_name,
         exists (
           select 1 from information_schema.columns c
           where c.table_schema = 'public' and c.table_name = t.table_name
             and c.column_name = 'user_id'
         ) as has_user_id
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  order by t.table_name;
`);

// Foreign keys, with their ON DELETE rule ('c' = cascade), so we can see both
// user_id parents and the parent chains that clear child tables.
const fks = await sql(`
  select cl.relname as child,
         a.attname as col,
         ns.nspname || '.' || pcl.relname as parent,
         con.confdeltype as del_rule
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid
  join pg_namespace cns on cns.oid = cl.relnamespace
  join pg_class pcl on pcl.oid = con.confrelid
  join pg_namespace ns on ns.oid = pcl.relnamespace
  join unnest(con.conkey) k(attnum) on true
  join pg_attribute a on a.attrelid = cl.oid and a.attnum = k.attnum
  where con.contype = 'f' and cns.nspname = 'public'
  order by cl.relname;
`);

const [{ prosrc }] = await sql(
  `select prosrc from pg_proc where proname = 'delete_user_data';`
);
const deletedByFunction = new Set(
  [...prosrc.matchAll(/delete\s+from\s+(?:public\.)?(\w+)/gi)].map((m) => m[1])
);

const cascadesToUser = new Map(); // table -> parent, for user_id FKs that cascade
const cascadeParents = new Map(); // table -> parent, for any other cascading FK
for (const fk of fks) {
  if (fk.del_rule !== 'c') continue;
  if (fk.col === 'user_id') cascadesToUser.set(fk.child, fk.parent);
  else if (!cascadeParents.has(fk.child)) cascadeParents.set(fk.child, fk.parent);
}

const rows = [];
const uncovered = [];

for (const { table_name: table, has_user_id: hasUserId } of tables) {
  let how;
  if (deletedByFunction.has(table)) how = 'delete_user_data()';
  else if (cascadesToUser.has(table)) how = `cascade from ${cascadesToUser.get(table)}`;
  else if (hasUserId) how = null;
  else if (cascadeParents.has(table)) how = `cascade from ${cascadeParents.get(table)}`;
  else how = 'no user-scoped rows';

  if (how === null) uncovered.push(table);
  rows.push({ table, user_scoped: hasUserId ? 'yes' : 'no', cleared_by: how ?? '❌ NOTHING' });
}

console.table(rows);

if (uncovered.length) {
  console.error(
    `\n❌ ${uncovered.length} table(s) hold user_id rows that account deletion would leave behind:\n` +
      uncovered.map((t) => `   - ${t}`).join('\n') +
      `\n\nFix by either adding a "delete from public.<table>" to delete_user_data()\n` +
      `(new migration), or giving user_id an ON DELETE CASCADE reference to\n` +
      `public.users / auth.users.\n`
  );
  process.exit(1);
}

console.log('\n✅ Every user-scoped table is cleared by the account-deletion path.');
