#!/usr/bin/env node
// scripts/build-ava-regions.mjs: regenerate assets/data/avas.json, the
// "Wine regions" map layer (US American Viticultural Areas).
//
//   npm run build:avas
//
// Source: UC Davis Library AVA project (CC0), pinned to one commit so a rebuild
// is reproducible. The nationwide file is ~43 MB of legal-precision geometry
// plus long text fields; the app only needs display-grade shapes and a handful
// of properties, so this script:
//   1. downloads the pinned GeoJSON to a temp dir (set AVA_SOURCE_FILE to reuse
//      a local copy while iterating),
//   2. simplifies it with mapshaper (5%, keep-shapes, 4-decimal precision),
//   3. keeps only the properties the sheet shows, normalizes `state` into an
//      array of two-letter codes and computes a bbox per feature,
//   4. writes the result compact (no whitespace) so Metro bundles a ~2 MB asset.
//
// Simplification moves edges. The asset is informational, for display and
// on-device "which region is this point in" checks; 27 CFR part 9 governs.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = '5208ac65eeb9c3250945f1fa182b4f2ebb7756a9';
const SOURCE = `https://raw.githubusercontent.com/UCDavisLibrary/ava/${COMMIT}/avas_aggregated_files/avas.geojson`;
const SIMPLIFY = '5%';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'data', 'avas.json');

// The source's `state` column is mostly "CA" or "OR|WA", but a couple of rows
// spell the state out. Everything is normalized to USPS codes.
const STATE_CODES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

function normalizeStates(raw) {
  if (!raw) return [];
  const codes = String(raw)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : STATE_CODES[s.toLowerCase()]))
    .filter(Boolean);
  return [...new Set(codes)];
}

function splitList(raw) {
  if (!raw) return [];
  return String(raw).split('|').map((s) => s.trim()).filter(Boolean);
}

function bboxOf(geometry) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }
  return [west, south, east, north].map((n) => Math.round(n * 10000) / 10000);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'ava-'));
  let source = process.env.AVA_SOURCE_FILE;
  if (source) {
    console.log(`Using local source ${source}`);
  } else {
    source = join(work, 'avas.geojson');
    console.log(`Downloading ${SOURCE}`);
    await download(SOURCE, source);
    console.log(`  ${(statSync(source).size / 1e6).toFixed(1)} MB`);
  }

  const simplified = join(work, 'avas.simplified.geojson');
  console.log(`Simplifying with mapshaper (${SIMPLIFY}, keep-shapes)`);
  const run = spawnSync(
    'npx',
    ['--yes', 'mapshaper', source, '-simplify', SIMPLIFY, 'keep-shapes', '-o', 'precision=0.0001', 'force', simplified],
    { stdio: 'inherit' }
  );
  if (run.status !== 0) throw new Error(`mapshaper exited with ${run.status}`);

  const geo = JSON.parse(readFileSync(simplified, 'utf8'));
  const features = geo.features
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    .map((f) => {
      const p = f.properties ?? {};
      return {
        id: p.ava_id,
        name: p.name,
        aka: p.aka || null,
        states: normalizeStates(p.state),
        created: p.created || null,
        removed: p.removed || null,
        within: splitList(p.within),
        contains: splitList(p.contains),
        cfr: p.cfr_index || null,
        bbox: bboxOf(f.geometry),
        geometry: { type: f.geometry.type, coordinates: f.geometry.coordinates },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const missingState = features.filter((f) => f.states.length === 0).map((f) => f.id);
  if (missingState.length) console.warn(`No state code resolved for: ${missingState.join(', ')}`);

  const out = {
    meta: {
      source: SOURCE,
      commit: COMMIT,
      license: 'CC0-1.0',
      fetchedAt: new Date().toISOString().slice(0, 10),
      count: features.length,
      simplify: SIMPLIFY,
    },
    features,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const coords = features.reduce((n, f) => {
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    return n + polys.reduce((m, rings) => m + rings.reduce((k, ring) => k + ring.length, 0), 0);
  }, 0);
  console.log(`Wrote ${OUT}: ${features.length} regions, ${coords} coordinates, ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
