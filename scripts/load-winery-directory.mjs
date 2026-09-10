#!/usr/bin/env node
// Loads data/winery-directory/us-wineries.csv.gz into public.winery_directory,
// upserting on fsq_place_id in batches of 500.
//
// This script is NOT run by CI or by this repo's automation — it's a
// one-off, owner-run server-side load (needs the service role key, which
// must never ship in the app or run in a PR check).
//
// Usage:
//   SUPABASE_URL=https://<project-ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/load-winery-directory.mjs --release <overture-release> \
//     [path/to/us-wineries.csv.gz]
//
// e.g. --release 2026-08-19.0 — the Overture Maps release the CSV was
// extracted from. Stamped into winery_directory.source_release (#225) so a
// quarterly re-ingest is auditable per row.
//
// Freshness pass (#225): after the upsert, rows whose fsq_place_id was NOT
// in this extract are flagged operating_status = 'possibly_closed' — never
// hard-deleted (users may have promoted them into their own wineries, and
// Overture churn isn't proof of closure). Rows already marked
// 'permanently_closed' (from Google businessStatus via the places Edge
// Function) keep that stronger flag. Rows that ARE in the extract keep
// whatever operating_status they had — the upsert deliberately does not
// touch that column, so a Google-confirmed closure survives a re-ingest.
//
// Prerequisites:
//   npm install @supabase/supabase-js
//   supabase db push   (applies supabase/migrations/20260910000000_winery_directory.sql
//                       and 20260910120000_directory_freshness.sql)
//
// See data/winery-directory/README.md for how the CSV is produced and for
// the quarterly re-run procedure.

import { createClient } from "@supabase/supabase-js";
import { createReadStream, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(
  __dirname,
  "..",
  "data",
  "winery-directory",
  "us-wineries.csv.gz",
);
const BATCH_SIZE = 500;

function parseCsvLine(line) {
  // Minimal RFC4180 parser: handles quoted fields with embedded commas,
  // quotes, and newlines were already joined upstream. Good enough for the
  // fixed, known-shape export this script consumes.
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function toRow(header, fields, { release, loadedAt }) {
  const raw = Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ""]));
  const nullIfEmpty = (v) => (v === "" ? null : v);
  return {
    fsq_place_id: raw.fsq_place_id,
    name: raw.name,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    address: nullIfEmpty(raw.address),
    city: nullIfEmpty(raw.city),
    state: nullIfEmpty(raw.state),
    postcode: nullIfEmpty(raw.postcode),
    website: nullIfEmpty(raw.website),
    source_release: release,
    updated_at: loadedAt,
    // operating_status deliberately omitted: the upsert must not clobber a
    // Google-confirmed 'permanently_closed' just because Overture still
    // lists the place.
  };
}

function parseArgs(argv) {
  let release = null;
  let csvPath = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--release") {
      release = argv[++i] ?? null;
    } else if (a.startsWith("--release=")) {
      release = a.slice("--release=".length);
    } else if (!a.startsWith("--")) {
      csvPath = a;
    } else {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
  }
  return { release, csvPath: csvPath ?? DEFAULT_CSV };
}

async function main() {
  const { release, csvPath } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
    process.exit(1);
  }
  if (!release) {
    console.error(
      "Missing --release <overture-release> (e.g. --release 2026-08-19.0).\n" +
        "Every load must stamp winery_directory.source_release so the\n" +
        "freshness pass can tell which rows the current extract covered.",
    );
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}.`);
    console.error(
      "See data/winery-directory/README.md — as of this branch the FSQ OS " +
        "Places extraction is blocked (dataset gated), so no CSV has been " +
        "produced yet. Do not point this script at a fabricated file.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const rl = readline.createInterface({
    input: createReadStream(csvPath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let header = null;
  let batch = [];
  let total = 0;
  let upserted = 0;
  const loadedAt = new Date().toISOString();
  const seenIds = new Set(); // every fsq_place_id in THIS extract

  const flush = async () => {
    if (batch.length === 0) return;
    const { error, count } = await supabase
      .from("winery_directory")
      .upsert(batch, { onConflict: "fsq_place_id", count: "exact" });
    if (error) {
      console.error(`Upsert failed at row ~${total}:`, error.message);
      process.exit(1);
    }
    upserted += count ?? batch.length;
    batch = [];
  };

  for await (const line of rl) {
    if (line.trim() === "") continue;
    const fields = parseCsvLine(line);
    if (!header) {
      header = fields;
      continue;
    }
    total++;
    const row = toRow(header, fields, { release, loadedAt });
    seenIds.add(row.fsq_place_id);
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await flush();
      process.stdout.write(`\r${total} rows read, ${upserted} upserted...`);
    }
  }
  await flush();

  console.log(`\n${total} rows read, ${upserted} upserted (release ${release}).`);

  // ── Freshness pass (#225): flag rows that vanished from this extract ──
  // Never hard-delete — flag as 'possibly_closed'. A row already marked
  // 'permanently_closed' (Google businessStatus, the stronger signal) keeps
  // that flag. A previously-'possibly_closed' row that REappears in this
  // extract is healed back to null (Overture filters permanently-closed
  // places at extract time, so reappearing is evidence of life). Rows are
  // paged because PostgREST caps a single select.
  const missing = [];
  const reappeared = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("winery_directory")
      .select("id, fsq_place_id, operating_status")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Freshness pass read failed:", error.message);
      process.exit(1);
    }
    for (const row of data ?? []) {
      if (!seenIds.has(row.fsq_place_id)) {
        if (row.operating_status !== "permanently_closed") missing.push(row.id);
      } else if (row.operating_status === "possibly_closed") {
        reappeared.push(row.id);
      }
    }
    if ((data ?? []).length < PAGE) break;
  }

  const updateInBatches = async (ids, patch, label) => {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const { error } = await supabase
        .from("winery_directory")
        .update(patch)
        .in("id", ids.slice(i, i + BATCH_SIZE));
      if (error) {
        console.error(`Freshness pass ${label} failed:`, error.message);
        process.exit(1);
      }
    }
  };

  await updateInBatches(
    missing,
    { operating_status: "possibly_closed", updated_at: loadedAt },
    "flagging",
  );
  await updateInBatches(
    reappeared,
    { operating_status: null, updated_at: loadedAt },
    "unflagging",
  );

  console.log(
    `Done. ${missing.length} row(s) missing from release ${release} flagged ` +
      `'possibly_closed'; ${reappeared.length} reappeared row(s) unflagged.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
