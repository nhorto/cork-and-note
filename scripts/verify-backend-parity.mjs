// scripts/verify-backend-parity.mjs: is the LIVE backend what the repo says it is?
//
// Three things drift silently between a merge and a release, and each has
// bitten this project once:
//   1. A committed migration that was never applied (the 2026-07-16 varietal
//      corruption: the app wrote arrays into a column that was still text).
//   2. An edge function whose source changed after its last deploy (the
//      2026-09-10 uncapped task: the fix sat in main while v13 kept running).
//   3. A storage bucket the code uploads to that does not exist or has the
//      wrong visibility (the 2026-06-08 restore recreated none of them).
//
// This script checks all three against the live project and exits non-zero on
// any gap. Read-only: it runs SELECTs through the Management API and lists
// functions and buckets. No secrets are printed.
//
//   node scripts/verify-backend-parity.mjs
//
// Needs a Supabase personal access token in SUPABASE_ACCESS_TOKEN or
// ~/.supabase/access-token, and the project URL in .env (EXPO_PUBLIC_SUPABASE_URL)
// or SUPABASE_PROJECT_REF.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const file = join(homedir(), '.supabase', 'access-token');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  throw new Error('No Supabase access token: set SUPABASE_ACCESS_TOKEN or run `supabase login`.');
}

function readProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/EXPO_PUBLIC_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (m) return m[1];
  }
  throw new Error('No project ref: set SUPABASE_PROJECT_REF or put EXPO_PUBLIC_SUPABASE_URL in .env.');
}

const TOKEN = readToken();
const REF = readProjectRef();
const API = `https://api.supabase.com/v1/projects/${REF}`;

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const sql = (query) => api('/database/query', { method: 'POST', body: JSON.stringify({ query }) });

const problems = [];
const note = (ok, message) => {
  console.log(`${ok ? '  ok ' : ' GAP '} ${message}`);
  if (!ok) problems.push(message);
};

// ── 1. Migrations ────────────────────────────────────────────────────────
console.log(`\nProject ${REF}\n\nMigrations`);
const repoVersions = readdirSync(join(ROOT, 'supabase', 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.split('_')[0])
  .sort();
const liveRows = await sql('select version from supabase_migrations.schema_migrations order by version');
const liveVersions = liveRows.map((r) => String(r.version)).sort();

const missingOnLive = repoVersions.filter((v) => !liveVersions.includes(v));
const liveNotInRepo = liveVersions.filter((v) => !repoVersions.includes(v));
note(missingOnLive.length === 0, `every committed migration is recorded as applied on the live database (${repoVersions.length} files, ${liveVersions.length} applied)`);
for (const v of missingOnLive) note(false, `migration ${v} is committed but NOT applied live`);
for (const v of liveNotInRepo) note(false, `migration ${v} is applied live but has no file in the repo`);

// A recorded version is not proof the schema is right (history was repaired by
// hand once). Spot-check a sentinel column or object from each migration that
// introduced one, so a repaired-but-unapplied migration still shows.
const sentinels = [
  ['20260608010000', "select 1 from information_schema.columns where table_name='visits' and column_name='place_type'"],
  ['20260609000000', "select 1 from information_schema.tables where table_name='cellar_bottles'"],
  ['20260609020000', "select 1 from information_schema.tables where table_name='chat_usage'"],
  ['20260622000000', "select 1 from information_schema.columns where table_name='wines' and column_name='wine_varietal' and data_type='ARRAY'"],
  ['20260624000000', "select 1 from information_schema.columns where table_name='cellar_bottles' and column_name='tasting_wine_id'"],
  ['20260907000000', "select 1 from pg_proc where proname='list_user_storage_objects'"],
  ['20260907020000', "select 1 from pg_proc where proname='open_bottle'"],
  ['20260907030000', "select 1 from pg_proc where proname='create_visit_with_wines'"],
  ['20260908000000', "select 1 from information_schema.tables where table_name='entitlements'"],
  ['20260909000000', "select 1 from information_schema.columns where table_name='chat_usage' and column_name='web_searches'"],
  ['20260909230000', "select 1 from information_schema.tables where table_name='places_usage'"],
  ['20260910000000', "select 1 from information_schema.tables where table_name='winery_directory'"],
  ['20260910120000', "select 1 from information_schema.columns where table_name='winery_directory' and column_name='operating_status'"],
  ['20260910130000', "select 1 from information_schema.tables where table_name='ai_response_reports'"],
  ['20260911100000', "select 1 from information_schema.tables where table_name='wine_list_sessions'"],
  ['20260911110000', "select 1 from information_schema.tables where table_name='taste_reports'"],
  ['20260911120000', "select 1 from pg_constraint where conname like 'places_usage_mode%' and pg_get_constraintdef(oid) like '%route%'"],
  ['20260911121000', "select 1 from information_schema.tables where table_name='trip_plans'"],
];
for (const [version, probe] of sentinels) {
  if (!repoVersions.includes(version)) continue;
  const rows = await sql(probe);
  note(rows.length > 0, `schema object from ${version} exists live`);
}

// Newer migrations without a sentinel above still need one: fail loudly so the
// list cannot silently go stale.
const latestSentinel = sentinels.map(([v]) => v).sort().at(-1);
const newerThanSentinels = repoVersions.filter((v) => v > latestSentinel);
note(newerThanSentinels.length === 0, `every migration newer than the last sentinel has a schema probe in this script${newerThanSentinels.length ? ` (add one for: ${newerThanSentinels.join(', ')})` : ''}`);

// ── 2. Edge functions ────────────────────────────────────────────────────
console.log('\nEdge functions');
const functionsDir = join(ROOT, 'supabase', 'functions');
const repoFunctions = readdirSync(functionsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(functionsDir, d.name, 'index.ts')))
  .map((d) => d.name)
  .sort();
const live = await api('/functions');
const liveBySlug = Object.fromEntries(live.map((f) => [f.slug, f]));

function sharedImports(name, seen = new Set()) {
  // The _shared files this function's bundle actually contains: its direct
  // imports and theirs, transitively. A change to a shared file the function
  // never imports is not a reason to redeploy it.
  const out = [];
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s+["'](\.\.?\/[^"']+\.ts)["']/g)) {
      const target = join(file, '..', m[1]);
      if (target.includes('/_shared/')) out.push(target);
      visit(target);
    }
  };
  visit(join(functionsDir, name, 'index.ts'));
  return [...new Set(out)].map((f) => f.replace(ROOT, '').replace(/^\/+/, ''));
}

function lastSourceChange(name) {
  // The newest commit on main touching this function or a _shared file it
  // imports. Deploys bundle the imports, so a change there ships only with
  // a redeploy of every function that uses it.
  const paths = [`supabase/functions/${name}`, ...sharedImports(name)];
  const out = execFileSync('git', ['log', '-1', '--format=%ct %h %s', 'origin/main', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!out) return null;
  const [ts, hash, ...subject] = out.split(' ');
  return { at: Number(ts) * 1000, hash, subject: subject.join(' ') };
}

for (const name of repoFunctions) {
  const fn = liveBySlug[name];
  if (!fn) {
    note(false, `${name}: in the repo but NOT deployed`);
    continue;
  }
  note(fn.status === 'ACTIVE', `${name}: deployed v${fn.version}, status ${fn.status}`);
  const change = lastSourceChange(name);
  if (change) {
    // The usual flow deploys from the branch and merges minutes later, so a
    // commit shortly AFTER the deploy is the same code. Anything beyond that
    // window is a change the live function does not have.
    const DEPLOY_THEN_COMMIT_GRACE_MS = 15 * 60_000;
    const stale = change.at > fn.updated_at + DEPLOY_THEN_COMMIT_GRACE_MS;
    const when = new Date(fn.updated_at).toISOString().slice(0, 16);
    const changed = new Date(change.at).toISOString().slice(0, 16);
    note(!stale, `${name}: deployed ${when}Z, source last changed ${changed}Z (${change.hash} ${change.subject.slice(0, 60)})${stale ? ': REDEPLOY' : ''}`);
  }
}
for (const slug of Object.keys(liveBySlug)) {
  if (!repoFunctions.includes(slug)) note(false, `${slug}: deployed but has no source in the repo`);
}

// ── 3. Storage buckets ───────────────────────────────────────────────────
console.log('\nStorage buckets');
const expectedBuckets = { 'visit-photos': true, 'wine-photos': true, 'chat-photos': false };
// Cross-check the list against what the code actually uploads to.
const referenced = new Set();
for (const dir of ['lib', 'components', 'app']) {
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/storage\s*\.from\(\s*['"]([a-z-]+)['"]/g)) referenced.add(m[1]);
        for (const m of readFileSync(p, 'utf8').matchAll(/uploadPhotos\([^,]+,\s*['"]([a-z-]+)['"]/g)) referenced.add(m[1]);
      }
    }
  };
  walk(join(ROOT, dir));
}
for (const b of referenced) note(b in expectedBuckets, `bucket "${b}" referenced in code is in this script's expected list`);

const buckets = await sql('select id, public from storage.buckets order by id');
const byId = Object.fromEntries(buckets.map((b) => [b.id, b]));
for (const [id, isPublic] of Object.entries(expectedBuckets)) {
  const b = byId[id];
  if (!b) note(false, `bucket "${id}" is missing live`);
  else note(b.public === isPublic, `bucket "${id}" is ${b.public ? 'public' : 'private'} (expected ${isPublic ? 'public' : 'private'})`);
}

// ── 4. Row-level security is ON for every user table ────────────────────
console.log('\nRow-level security');
const rls = await sql(`
  select c.relname as table_name, c.relrowsecurity as enabled,
         (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' order by 1`);
const userTableHint = /user_id|conversation|message|visit|wine|cellar|wishlist|favorite|entitlement|usage|report|trip|taste/i;
for (const t of rls) {
  const looksUserScoped = userTableHint.test(t.table_name);
  if (!looksUserScoped) continue;
  note(t.enabled && Number(t.policies) > 0, `${t.table_name}: RLS ${t.enabled ? 'on' : 'OFF'}, ${t.policies} policies`);
}

// ── Summary ─────────────────────────────────────────────────────────────
console.log('');
if (problems.length) {
  console.log(`${problems.length} gap${problems.length === 1 ? '' : 's'} found.`);
  process.exit(1);
}
console.log('Live backend matches the repo.');
