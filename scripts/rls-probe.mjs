// scripts/rls-probe.mjs: can one user reach another user's data on the LIVE
// backend?
//
// Every read the app makes relies on row-level security to scope it (the
// chat-usage counters and per-conversation reads carry no user filter at
// all), so a policy gap is a data leak with nothing in the client to stop
// it. This script proves the policies the hard way: it creates two throwaway
// accounts through the same sign-up the app uses, has user A write one row in
// every user-scoped table and one object in every bucket, then tries as user
// B to read, change and delete each of them, and to open A's bottle through
// the transactional RPC. Every attempt must come back empty or refused.
//
// Then both accounts are deleted through the delete-account edge function,
// the app's own path, and the database is checked for residue.
//
//   node scripts/rls-probe.mjs
//
// Needs .env (EXPO_PUBLIC_SUPABASE_URL + anon key) and a Supabase access
// token (SUPABASE_ACCESS_TOKEN or ~/.supabase/access-token) for the residue
// check, which runs read-only SQL through the Management API. Writes only the
// throwaway users' own rows and removes them. Prints no secrets.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const envText = readFileSync(join(ROOT, '.env'), 'utf8');
const env = (k) => process.env[k] ?? envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL');
const ANON = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON) throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required');
const REF = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim() || (existsSync(join(homedir(), '.supabase', 'access-token')) ? readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim() : null);
if (!TOKEN) throw new Error('A Supabase access token is required for the residue check');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`sql -> ${res.status} ${await res.text()}`);
  return res.json();
}

const stamp = Date.now().toString(36);
const results = [];
let leaks = 0;
const record = (surface, operation, ok, detail = '') => {
  results.push({ surface, operation, ok, detail });
  if (!ok) leaks += 1;
};

/** A fresh, signed-in client for a throwaway account. */
async function throwaway(label) {
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `rls-probe-${stamp}-${label}@example.com`;
  const password = `Probe-${stamp}-${label}-Aa1!`;
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { name: `Probe ${label}` } } });
  if (error) throw new Error(`signUp ${label}: ${error.message}`);
  if (!data.session) throw new Error(`signUp ${label}: no session (is auto-confirm off?)`);
  return { client, id: data.user.id, email, jwt: data.session.access_token };
}

/** Delete an account through the app's own edge function, then verify nothing is left. */
async function deleteAccount(user) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const A = await throwaway('a');
const B = await throwaway('b');
console.log(`\nProject ${REF}\nUser A ${A.id}\nUser B ${B.id}\n`);

try {
  // ── A writes one of everything ──────────────────────────────────────
  const a = A.client;
  const own = {};

  const winery = await a.from('wineries').insert({ name: `Probe Estate ${stamp}`, latitude: 38.17, longitude: -78.28 }).select().single();
  if (winery.error) throw new Error(`wineries insert: ${winery.error.message}`);
  own.wineries = winery.data.id;

  const visit = await a.rpc('create_visit_with_wines', {
    p_visit: { winery_id: own.wineries, place_type: 'winery', place_name: `Probe Estate ${stamp}`, visit_date: '2026-09-11', notes: 'probe', photo_url: '[]' },
    p_wines: [{ wine_name: 'Probe Red', wine_type: 'red', wine_varietal: ['Merlot'], overall_rating: 4, photo_url: '[]', flavor_notes: ['cherry'] }],
  });
  if (visit.error) throw new Error(`create_visit_with_wines: ${visit.error.message}`);
  own.visits = visit.data.visit_id;
  const wine = await a.from('wines').select('id').eq('visit_id', own.visits).single();
  own.wines = wine.data?.id;

  const bottle = await a.from('cellar_bottles').insert({ user_id: A.id, wine_name: 'Probe Bottle', quantity: 2, vintage: 2019 }).select().single();
  if (bottle.error) throw new Error(`cellar_bottles insert: ${bottle.error.message}`);
  own.cellar_bottles = bottle.data.id;

  const opened = await a.rpc('open_bottle', { p_bottle_id: own.cellar_bottles, p_quantity: 1, p_reason: 'consumed', p_note: null, p_wine_id: null, p_consumed_date: '2026-09-11' });
  if (opened.error) throw new Error(`open_bottle as owner: ${opened.error.message}`);
  const consumption = await a.from('cellar_consumptions').select('id').eq('bottle_id', own.cellar_bottles).limit(1).single();
  own.cellar_consumptions = consumption.data?.id;

  const convo = await a.from('conversations').insert({ user_id: A.id, title: 'probe', context_type: 'general', context_metadata: {} }).select().single();
  if (convo.error) throw new Error(`conversations insert: ${convo.error.message}`);
  own.conversations = convo.data.id;
  const msg = await a.from('messages').insert({ conversation_id: own.conversations, role: 'user', content: 'probe', image_urls: [] }).select().single();
  if (msg.error) throw new Error(`messages insert: ${msg.error.message}`);
  own.messages = msg.data.id;

  const wish = await a.from('wishlist').insert({ user_id: A.id, winery_id: own.wineries }).select().single();
  if (wish.error) throw new Error(`wishlist insert: ${wish.error.message}`);
  own.wishlist = wish.data.id;

  const usage = await a.from('chat_usage').insert({ user_id: A.id, task: 'chat' }).select().single();
  if (usage.error) throw new Error(`chat_usage insert: ${usage.error.message}`);
  own.chat_usage = usage.data.id;

  const taste = await a.from('taste_reports').insert({ source_revision: 'probe', tier: 'first_impressions', aggregates: {}, report: { headline: 'probe' } }).select().single();
  if (taste.error) throw new Error(`taste_reports insert: ${taste.error.message}`);
  own.taste_reports = taste.data.id;

  const trip = await a.from('trip_plans').insert({ user_id: A.id, stops: [], settings: {} }).select().single();
  if (trip.error) throw new Error(`trip_plans insert: ${trip.error.message}`);
  own.trip_plans = trip.data.id;

  const list = await a.from('wine_list_sessions').insert({ user_id: A.id, title: 'probe', entries: [], picks: [] }).select().single();
  if (list.error) throw new Error(`wine_list_sessions insert: ${list.error.message}`);
  own.wine_list_sessions = list.data.id;

  const report = await a.from('winery_reports').insert({ winery_id: own.wineries, reason: 'other', details: 'probe' }).select().single();
  if (report.error) throw new Error(`winery_reports insert: ${report.error.message}`);
  own.winery_reports = report.data.id;

  const objects = {};
  for (const bucket of ['visit-photos', 'wine-photos', 'chat-photos']) {
    const path = `probe_${A.id}_${stamp}.jpg`;
    const up = await a.storage.from(bucket).upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
    if (up.error) throw new Error(`${bucket} upload: ${up.error.message}`);
    objects[bucket] = path;
  }
  console.log('User A wrote one row in each of ' + Object.keys(own).length + ' tables and one object in each of 3 buckets.\n');

  // ── B tries to reach every one of them ──────────────────────────────
  const b = B.client;
  // A column that exists on each table, so an update reaches the policy
  // instead of dying on the schema (a column-not-found error proves nothing).
  const tamper = {
    wineries: { name: 'HACKED' }, visits: { notes: 'HACKED' }, wines: { wine_name: 'HACKED' },
    cellar_bottles: { wine_name: 'HACKED' }, cellar_consumptions: { note: 'HACKED' },
    conversations: { title: 'HACKED' }, messages: { content: 'HACKED' }, wishlist: { created_at: new Date().toISOString() },
    chat_usage: { task: 'label_scan' }, taste_reports: { source_revision: 'HACKED' }, trip_plans: { settings: { hacked: true } },
    wine_list_sessions: { title: 'HACKED' }, winery_reports: { details: 'HACKED' },
  };
  for (const [table, id] of Object.entries(own)) {
    if (id == null) { record(table, 'setup', false, 'no id captured'); continue; }
    const sel = await b.from(table).select('*').eq('id', id);
    record(table, 'select', !sel.error && (sel.data ?? []).length === 0, sel.error ? `error: ${sel.error.message}` : `${(sel.data ?? []).length} rows`);
    const upd = await b.from(table).update(tamper[table]).eq('id', id).select();
    const updOk = (!upd.error && (upd.data ?? []).length === 0) || upd.error?.code === '42501';
    record(table, 'update', updOk, upd.error ? `${upd.error.code === '42501' ? 'refused' : 'ERROR'}: ${upd.error.code ?? upd.error.message}` : `${(upd.data ?? []).length} rows changed`);
    const del = await b.from(table).delete().eq('id', id).select();
    const delOk = (!del.error && (del.data ?? []).length === 0) || del.error?.code === '42501';
    record(table, 'delete', delOk, del.error ? `${del.error.code === '42501' ? 'refused' : 'ERROR'}: ${del.error.code ?? del.error.message}` : `${(del.data ?? []).length} rows deleted`);
  }
  // A's row must still be intact after all that.
  const intact = await a.from('wineries').select('name').eq('id', own.wineries).single();
  record('wineries', "A's row intact after B's attempts", intact.data?.name === `Probe Estate ${stamp}`, intact.data?.name ?? 'missing');

  // A count with no user filter, the way the edge functions and ProProvider count.
  const count = await b.from('chat_usage').select('id', { count: 'exact', head: true }).eq('task', 'chat');
  record('chat_usage', 'unfiltered count', !count.error && count.count === 0, `B sees ${count.count} rows`);

  // The transactional open on A's lot.
  const steal = await b.rpc('open_bottle', { p_bottle_id: own.cellar_bottles, p_quantity: 1, p_reason: 'consumed', p_note: null, p_wine_id: null, p_consumed_date: '2026-09-11' });
  const still = await a.from('cellar_bottles').select('quantity').eq('id', own.cellar_bottles).single();
  record('open_bottle RPC', "B opens A's lot", !!steal.error && still.data?.quantity === 1, steal.error ? `refused: ${steal.error.message.slice(0, 60)}` : `succeeded; quantity now ${still.data?.quantity}`);

  // A's wine through the visit join B cannot see.
  const joined = await b.from('visits').select('id, wines(id)').eq('id', own.visits);
  record('visits->wines join', 'select', !joined.error && (joined.data ?? []).length === 0, `${(joined.data ?? []).length} rows`);

  // Storage: B lists, downloads, and removes A's objects.
  for (const [bucket, path] of Object.entries(objects)) {
    const listed = await b.storage.from(bucket).list('', { search: path });
    record(`bucket ${bucket}`, 'list', !!listed.error || !(listed.data ?? []).some((o) => o.name === path), listed.error ? `refused` : `${(listed.data ?? []).length} matches`);
    const removed = await b.storage.from(bucket).remove([path]);
    const gone = removed.error ? false : (removed.data ?? []).some((o) => o.name === path);
    record(`bucket ${bucket}`, 'remove', !gone, removed.error ? 'refused' : gone ? 'REMOVED A\'S OBJECT' : 'no-op');
    if (bucket === 'chat-photos') {
      const dl = await b.storage.from(bucket).download(path);
      record(`bucket ${bucket}`, 'download (private)', !!dl.error, dl.error ? 'refused' : 'DOWNLOADED');
    }
  }
  // The anon key ships inside the app binary, so a signed-out client is the
  // weakest caller there is. Listing must be refused for it too.
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  for (const [bucket, path] of Object.entries(objects)) {
    const listed = await anon.storage.from(bucket).list('', { search: path });
    record(`bucket ${bucket}`, 'list (signed out)', !!listed.error || !(listed.data ?? []).some((o) => o.name === path), listed.error ? 'refused' : `${(listed.data ?? []).length} matches`);
  }
  // Public buckets still serve bytes by URL by design; the owner-scoped read
  // policy is what stops the URL from being discoverable.

  // The entitlements row is read-only to clients even for the owner.
  const grant = await a.from('entitlements').upsert({ user_id: A.id, is_pro: true, expires_at: null, source: 'probe' }).select();
  record('entitlements', 'self-grant Pro', !!grant.error || (grant.data ?? []).length === 0, grant.error ? `refused: ${grant.error.code ?? ''}` : 'GRANTED');
  const probeUsage = await a.from('chat_usage').delete().eq('id', own.chat_usage).select();
  record('chat_usage', 'owner delete (tamper)', !!probeUsage.error || (probeUsage.data ?? []).length === 0, probeUsage.error ? 'refused' : `${(probeUsage.data ?? []).length} deleted`);
} finally {
  // ── Clean up through the app's own path, then check for residue ─────
  console.log('\nCleanup');
  for (const u of [A, B]) {
    const { status, body } = await deleteAccount(u);
    console.log(`  delete-account ${u.id.slice(0, 8)}: ${status} ${JSON.stringify(body)}`);
  }
  const ids = `'${A.id}','${B.id}'`;
  const residue = await sql(`
    select 'auth.users' as t, count(*) from auth.users where id in (${ids})
    union all select 'public.users', count(*) from public.users where id in (${ids})
    union all select 'visits', count(*) from public.visits where user_id in (${ids})
    union all select 'wines', count(*) from public.wines w join public.visits v on v.id=w.visit_id where v.user_id in (${ids})
    union all select 'cellar_bottles', count(*) from public.cellar_bottles where user_id in (${ids})
    union all select 'cellar_consumptions', count(*) from public.cellar_consumptions c join public.cellar_bottles b on b.id=c.bottle_id where b.user_id in (${ids})
    union all select 'conversations', count(*) from public.conversations where user_id in (${ids})
    union all select 'wishlist', count(*) from public.wishlist where user_id in (${ids})
    union all select 'wineries', count(*) from public.wineries where user_id in (${ids})
    union all select 'chat_usage', count(*) from public.chat_usage where user_id in (${ids})
    union all select 'taste_reports', count(*) from public.taste_reports where user_id in (${ids})
    union all select 'trip_plans', count(*) from public.trip_plans where user_id in (${ids})
    union all select 'wine_list_sessions', count(*) from public.wine_list_sessions where user_id in (${ids})
    union all select 'winery_reports', count(*) from public.winery_reports where user_id in (${ids})
    union all select 'storage.objects', count(*) from storage.objects where name like '%${stamp}%'`);
  const left = residue.filter((r) => Number(r.count) > 0);
  console.log(left.length ? `  RESIDUE: ${left.map((r) => `${r.t}=${r.count}`).join(', ')}` : '  no residue: both accounts and every row and object are gone');
  if (left.length) leaks += 1;
}

// ── Report ──────────────────────────────────────────────────────────────
console.log('\nUser B against user A\'s data');
const width = Math.max(...results.map((r) => r.surface.length));
for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'LEAK'} ${r.surface.padEnd(width)}  ${r.operation.padEnd(22)} ${r.detail}`);
console.log('');
if (leaks) {
  console.log(`${leaks} problem${leaks === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('No leaks: row-level security held on every table and bucket.');
