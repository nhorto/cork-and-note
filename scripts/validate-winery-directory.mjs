#!/usr/bin/env node
// scripts/validate-winery-directory.mjs — bulk freshness pass over the
// winery directory (#273 Tier 1, epic #268).
//
// The 14,482-row Overture seed says nothing about whether a winery is still
// open, and until now a row only learned its status when a Pro user opened
// its page. This script checks rows in batches against Google Places:
//
//   1. Text Search, IDs-only field mask (free, unlimited), RESTRICTED to a
//      5 km box around the row's coordinates, to find the Google place for
//      the name. (The app's per-page match only biases by location and once
//      attached a place 13 km away.)
//   2. Place Details with the mask `id,displayName,location,businessStatus`.
//      businessStatus is a Pro-SKU field ($17 per 1,000; 5,000 free calls a
//      month), so this is the one call that costs anything, and only past
//      the free allowance. The mask deliberately excludes every Enterprise
//      field (rating, hours), which would bill each call at $20+ per 1,000.
//   3. The match must AGREE ON NAME (shared distinctive words, allowing one
//      typo per word) and sit within MAX_MATCH_KM of our coordinates, or it
//      is treated as "no match" rather than trusted: text search is fuzzy
//      and will happily return the nearest other winery in the box. If a
//      row flagged as this row's duplicate sits nearer Google's location,
//      the two swap roles: Overture sometimes kept the wrong twin's
//      coordinates (Janemark). Google's location is used only in the
//      moment, never stored.
//
// Write-back per row (service role):
//   operating_status   open | temporarily_closed | permanently_closed
//   google_place_id    the matched id (makes the app's per-page write-back
//                      hit this row every time from now on)
//   validated_at       now(), also for unmatched rows so they are not
//                      re-spent on
//   validation_note    why a row was left unknown (unmatched / far), for a
//                      human pass later
//   duplicate          if the matched place id already belongs to another
//                      directory row, this row is flagged a duplicate of it
//                      (Nick, 2026-09-11: the Google pass catches the
//                      duplicates the exact-name pass could not).
//
// Pacing: DEFAULT_LIMIT rows per run, one run a day (see
// .github/workflows/validate-directory.yml) keeps a month under the free
// Pro allowance with headroom. The whole directory takes about three months
// at zero cost; a quarterly refresh (--refresh-older-than 90) stays free too.
//
// Usage:
//   GOOGLE_PLACES_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/validate-winery-directory.mjs [--limit 160] [--states VA,MD]
//     [--dry-run] [--refresh-older-than 90] [--ids 8191,14220]
import { createClient } from '@supabase/supabase-js';
import { haversineKm, namesAgree } from './lib/directory-match.mjs';

const DEFAULT_LIMIT = 160;
const MAX_MATCH_KM = 3;
// Search box half-size in degrees of latitude (~5 km).
const SEARCH_BOX_DEG = 0.045;
// States users are actually in first, then everywhere else by id.
const STATE_PRIORITY = ['VA', 'MD', 'PA', 'NC', 'CA', 'WA', 'OR', 'NY', 'TX', 'MI'];
const BUSINESS_STATUS_TO_OPERATING = {
  OPERATIONAL: 'open',
  CLOSED_TEMPORARILY: 'temporarily_closed',
  CLOSED_PERMANENTLY: 'permanently_closed',
};

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !supabaseUrl || !serviceKey) {
  console.error('Set GOOGLE_PLACES_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const rows = await selectBatch();
console.log(`${args.dryRun ? '[dry run] ' : ''}${rows.length} row(s) to validate`);
const tally = { open: 0, temporarily_closed: 0, permanently_closed: 0, duplicate: 0, swap: 0, unmatched: 0, mismatch: 0, far: 0, errors: 0 };

for (const row of rows) {
  try {
    const result = await validate(row);
    tally[result.outcome] += 1;
    const note = result.note ? ` (${result.note})` : '';
    console.log(`  ${String(row.id).padStart(6)}  ${row.name.slice(0, 44).padEnd(44)}  ${(row.state ?? '').padEnd(2)}  ${result.outcome}${note}`);
    if (!args.dryRun) await writeBack(row, result);
  } catch (error) {
    tally.errors += 1;
    console.error(`  ${String(row.id).padStart(6)}  ${row.name.slice(0, 44).padEnd(44)}  error: ${error.message}`);
    // A quota or network failure should stop the run, not burn the rest of
    // the batch on the same error.
    if (/quota|429|403/i.test(error.message)) break;
  }
}
console.log('done:', JSON.stringify(tally));

// ── Selection ─────────────────────────────────────────────────────────────

async function selectBatch() {
  if (args.ids.length) {
    const { data, error } = await supabase
      .from('winery_directory')
      .select('id, name, state, city, latitude, longitude, google_place_id, operating_status')
      .in('id', args.ids);
    if (error) throw error;
    return data ?? [];
  }
  const picked = [];
  const states = args.states.length ? args.states : [...STATE_PRIORITY, null];
  for (const state of states) {
    if (picked.length >= args.limit) break;
    let query = supabase
      .from('winery_directory')
      .select('id, name, state, city, latitude, longitude, google_place_id, operating_status')
      .or('operating_status.is.null,operating_status.not.in.(duplicate,permanently_closed)')
      .order('id', { ascending: true })
      .limit(args.limit - picked.length);
    query = args.refreshOlderThanDays
      ? query.or(`validated_at.is.null,validated_at.lt.${new Date(Date.now() - args.refreshOlderThanDays * 864e5).toISOString()}`)
      : query.is('validated_at', null);
    if (state) query = query.eq('state', state);
    else if (!args.states.length) query = query.not('state', 'in', `(${STATE_PRIORITY.join(',')})`);
    const { data, error } = await query;
    if (error) throw error;
    picked.push(...(data ?? []));
  }
  return picked.slice(0, args.limit);
}

// ── Google ────────────────────────────────────────────────────────────────

async function validate(row) {
  let placeId = row.google_place_id;
  let attachedByApp = Boolean(placeId);
  const hadAppPlace = attachedByApp;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!placeId) {
      placeId = await searchPlaceId(row);
      if (!placeId) {
        return {
          outcome: 'unmatched',
          clearPlaceId: hadAppPlace,
          note: hadAppPlace ? 'app-attached place was far; no match in box' : 'no match in box',
        };
      }
    }
    const place = await placeDetails(placeId);
    if (!place) return { outcome: 'unmatched', note: 'details empty' };
    const googleName = place.displayName?.text ?? '';
    if (!namesAgree(row.name, googleName)) {
      if (attachedByApp) {
        // The app attached a place whose name does not fit: search afresh.
        attachedByApp = false;
        placeId = null;
        continue;
      }
      return { outcome: 'mismatch', clearPlaceId: hadAppPlace, note: `name mismatch: ${googleName}` };
    }
    const km = place.location
      ? haversineKm(row.latitude, row.longitude, place.location.latitude, place.location.longitude)
      : 0;
    if (km > MAX_MATCH_KM && attachedByApp) {
      // The app's per-page match (location-biased, not restricted) attached
      // a place too far away to be this winery. Search afresh in the box.
      attachedByApp = false;
      placeId = null;
      continue;
    }
    // Overture sometimes kept the wrong twin's coordinates: if a row flagged
    // as this one's duplicate sits clearly nearer Google's location, the two
    // swap roles. Google's location is used only here, never stored.
    if (km > 0.5) {
      const twin = await nearerTwin(row, place.location, Math.min(km / 2, MAX_MATCH_KM));
      if (twin) {
        return {
          outcome: 'swap',
          placeId,
          twinId: twin.id,
          status: BUSINESS_STATUS_TO_OPERATING[place.businessStatus] ?? null,
          note: `kept twin ${twin.id} instead, ${twin.km.toFixed(1)} km from Google vs ${km.toFixed(1)}`,
        };
      }
    }
    if (km > MAX_MATCH_KM) {
      return { outcome: 'far', note: `${place.displayName?.text ?? '?'} ${km.toFixed(1)} km away` };
    }
    // Same Google place already on another row: this one is the duplicate.
    const { data: holder } = await supabase
      .from('winery_directory')
      .select('id')
      .eq('google_place_id', placeId)
      .neq('id', row.id)
      .limit(1)
      .maybeSingle();
    if (holder) return { outcome: 'duplicate', placeId, duplicateOf: holder.id, note: `of ${holder.id}` };
    const status = BUSINESS_STATUS_TO_OPERATING[place.businessStatus] ?? null;
    return {
      outcome: status ?? 'unmatched',
      placeId,
      status,
      note: status ? undefined : `businessStatus ${place.businessStatus ?? 'missing'}`,
    };
  }
  return { outcome: 'unmatched' };
}

// A row flagged as this row's duplicate that lies within `withinKm` of
// Google's location for the winery, nearest first.
async function nearerTwin(row, location, withinKm) {
  if (!location) return null;
  const { data } = await supabase
    .from('winery_directory')
    .select('id, latitude, longitude')
    .eq('duplicate_of', row.id);
  const twins = (data ?? [])
    .map((t) => ({ ...t, km: haversineKm(t.latitude, t.longitude, location.latitude, location.longitude) }))
    .filter((t) => t.km <= withinKm)
    .sort((a, b) => a.km - b.km);
  return twins[0] ?? null;
}

async function searchPlaceId(row) {
  const lngHalf = SEARCH_BOX_DEG / Math.max(0.2, Math.cos((row.latitude * Math.PI) / 180));
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: row.name,
      locationRestriction: {
        rectangle: {
          low: { latitude: row.latitude - SEARCH_BOX_DEG, longitude: row.longitude - lngHalf },
          high: { latitude: row.latitude + SEARCH_BOX_DEG, longitude: row.longitude + lngHalf },
        },
      },
      maxResultCount: 1,
      languageCode: 'en',
    }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.places?.[0]?.id ?? null;
}

async function placeDetails(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      // Pro SKU (businessStatus). Never add rating/hours/website here.
      'X-Goog-FieldMask': 'id,displayName,location,businessStatus',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`details ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── Write-back ────────────────────────────────────────────────────────────

async function writeBack(row, result) {
  const now = new Date().toISOString();
  const patch = { validated_at: now, updated_at: now, validation_note: result.note ?? null };
  if (result.outcome === 'duplicate') {
    Object.assign(patch, { operating_status: 'duplicate', duplicate_of: result.duplicateOf });
    // Saved wineries follow the kept row, as the exact-name pass did.
    await supabase.from('wineries').update({ directory_id: result.duplicateOf }).eq('directory_id', row.id);
  } else if (result.outcome === 'swap') {
    // The twin becomes the kept row and takes the match; this row becomes
    // its duplicate. Rows that pointed at this one follow the twin.
    const { error: twinError } = await supabase
      .from('winery_directory')
      .update({
        operating_status: result.status,
        duplicate_of: null,
        google_place_id: result.placeId,
        validated_at: now,
        updated_at: now,
        validation_note: null,
      })
      .eq('id', result.twinId);
    if (twinError) throw twinError;
    await supabase.from('winery_directory').update({ duplicate_of: result.twinId }).eq('duplicate_of', row.id).neq('id', result.twinId);
    await supabase.from('wineries').update({ directory_id: result.twinId }).eq('directory_id', row.id);
    Object.assign(patch, { operating_status: 'duplicate', duplicate_of: result.twinId, google_place_id: null });
  } else if (result.status) {
    Object.assign(patch, { operating_status: result.status, google_place_id: result.placeId });
  } else if (result.clearPlaceId) {
    // The app had attached a place too far away to be this winery; forget
    // it and the status it brought, so the next pass searches afresh.
    Object.assign(patch, { google_place_id: null, operating_status: null });
  } else if (result.placeId) {
    patch.google_place_id = result.placeId;
  }
  const { error } = await supabase.from('winery_directory').update(patch).eq('id', row.id);
  if (error) throw error;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { limit: DEFAULT_LIMIT, states: [], ids: [], dryRun: false, refreshOlderThanDays: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--limit') out.limit = Math.max(1, Number(argv[++i]) || DEFAULT_LIMIT);
    else if (arg === '--states') out.states = String(argv[++i]).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (arg === '--ids') out.ids = String(argv[++i]).split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
    else if (arg === '--refresh-older-than') out.refreshOlderThanDays = Number(argv[++i]) || 0;
    else throw new Error(`Unknown argument ${arg}`);
  }
  return out;
}
