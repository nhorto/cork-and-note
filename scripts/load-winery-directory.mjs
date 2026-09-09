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
//   node scripts/load-winery-directory.mjs [path/to/us-wineries.csv.gz]
//
// Prerequisites:
//   npm install @supabase/supabase-js
//   supabase db push   (applies supabase/migrations/20260910000000_winery_directory.sql)
//
// See data/winery-directory/README.md for how the CSV is produced and its
// current status (as of this branch, extraction is blocked — see that
// file before running this script against an empty/missing CSV).

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

function toRow(header, fields) {
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
  };
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.",
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
    batch.push(toRow(header, fields));
    if (batch.length >= BATCH_SIZE) {
      await flush();
      process.stdout.write(`\r${total} rows read, ${upserted} upserted...`);
    }
  }
  await flush();

  console.log(`\nDone. ${total} rows read, ${upserted} upserted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
