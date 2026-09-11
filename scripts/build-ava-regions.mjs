#!/usr/bin/env node
// scripts/build-ava-regions.mjs: regenerate assets/data/avas.json, the
// "Wine regions" map layer (US American Viticultural Areas).
//
//   npm run build:avas            rebuild assets/data/avas.json
//   npm run build:avas -- --check  compare the asset's names with TTB's current
//                                  list (names only, no geometry) and exit 1
//                                  on drift, e.g. after a new AVA is established
//
// Source: TTB's own AVA Map Explorer feature service (US Government work,
// public domain), the layer behind ttb.gov/ava. It carries every established
// AVA plus proposed ones (Status), the establishment date, CFR section and
// containment. It replaced the UC Davis Library snapshot on 2026-09-11: that
// project's last commit (2025-12-10) lacked the four AVAs established in 2026
// (Tryon Foothills, Nashoba Valley, Nine Lakes of East Tennessee, Columbia
// Hills), while TTB had all 280.
//
// The nationwide set is ~46 MB of geometry; the app only needs display-grade
// shapes and a handful of properties, so this script:
//   1. downloads the established AVAs as GeoJSON in pages to a temp dir (set
//      AVA_SOURCE_FILE to reuse a local copy while iterating),
//   2. drops TTB's helper rows (a duplicated feature, "... Outline" polygons),
//   3. simplifies with mapshaper (5%, keep-shapes, 4-decimal precision),
//   4. keeps only the properties the sheet shows, normalizes states into an
//      array of two-letter codes and computes a bbox per feature,
//   5. writes the result compact (no whitespace) so Metro bundles a ~2 MB asset.
//
// Simplification moves edges. The asset is informational, for display and
// on-device "which region is this point in" checks; 27 CFR part 9 governs.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://services7.arcgis.com/ykuAbKu9MbV93nAe/arcgis/rest/services/AVAs_Production/FeatureServer/0/query';
const PAGE = 100;
const SIMPLIFY = '5%';
// TTB's list page spells this one out; the service uses the short form.
const NAME_ALIASES = { 'SLO Coast': { name: 'San Luis Obispo Coast', aka: 'SLO Coast' } };
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'data', 'avas.json');

// The service's `States` column is "CA" or "OR, WA"; a spelled-out state is
// tolerated too. Everything is normalized to USPS codes.
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
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : STATE_CODES[s.toLowerCase()]))
    .filter(Boolean);
  return [...new Set(codes)];
}

function splitList(raw) {
  if (!raw || raw === 'None') return [];
  return String(raw).split(/,\s*/).map((s) => s.trim()).filter(Boolean);
}

// TTB's ids are slugs of the name, like the old asset's (napa_valley).
const slug = (name) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const isoDate = (epochMs) => (epochMs ? new Date(epochMs).toISOString().slice(0, 10) : null);

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

// Page through the feature service (it caps a query at 1,000 rows and a
// transfer size) and write one FeatureCollection of the established AVAs.
async function download(dest) {
  const features = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      where: "Status='Established'",
      outFields: 'Name,States,Established,Status,CFR_Section,Contains_,Within,Counties',
      outSR: '4326',
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
    });
    const res = await fetch(`${SOURCE}?${params}`);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    const page = await res.json();
    if (page.error) throw new Error(`Feature service error: ${JSON.stringify(page.error)}`);
    features.push(...(page.features ?? []));
    console.log(`  page ${offset / PAGE + 1}: ${page.features?.length ?? 0} features`);
    if (!page.features?.length || !page.properties?.exceededTransferLimit) break;
  }
  writeFileSync(dest, Buffer.from(JSON.stringify({ type: 'FeatureCollection', features })));
}

// TTB's name column, after the same cleanup the build applies.
function establishedNames(features) {
  const seen = new Set();
  return features
    .map((f) => String(f.properties?.Name ?? f.Name ?? '').trim())
    .filter((name, i) => {
      const status = features[i].properties?.Status ?? features[i].Status;
      return status === 'Established' && !/\(?outline\)?$/i.test(name) && !seen.has(name) && seen.add(name);
    })
    .map((name) => NAME_ALIASES[name]?.name ?? name);
}

async function check() {
  const params = new URLSearchParams({
    where: "Status='Established'",
    outFields: 'Name,Status',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${SOURCE}?${params}`);
  if (!res.ok) throw new Error(`Check failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const ttb = new Set(establishedNames((data.features ?? []).map((f) => f.attributes)));
  const asset = new Set(JSON.parse(readFileSync(OUT, 'utf8')).features.map((f) => f.name));
  const missing = [...ttb].filter((n) => !asset.has(n)).sort();
  const extra = [...asset].filter((n) => !ttb.has(n)).sort();
  console.log(`TTB lists ${ttb.size} established AVAs; the asset has ${asset.size}.`);
  if (missing.length) console.log(`Missing from the asset: ${missing.join(', ')}`);
  if (extra.length) console.log(`In the asset but not at TTB: ${extra.join(', ')}`);
  if (missing.length || extra.length) {
    console.log('Run `npm run build:avas` to refresh.');
    process.exit(1);
  }
  console.log('In sync.');
}

async function main() {
  if (process.argv.includes('--check')) return check();
  const work = mkdtempSync(join(tmpdir(), 'ava-'));
  let source = process.env.AVA_SOURCE_FILE;
  if (source) {
    console.log(`Using local source ${source}`);
  } else {
    source = join(work, 'avas.geojson');
    console.log(`Downloading established AVAs from ${SOURCE}`);
    await download(source);
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
  const seen = new Set();
  const features = geo.features
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    // TTB helper rows: "<AVA> Outline" is the outer envelope of an
    // elevation-defined AVA whose real polygon is a separate row, and one
    // feature is simply listed twice.
    .map((f) => ({ ...f, properties: { ...f.properties, Name: String(f.properties?.Name ?? '').trim() } }))
    .filter((f) => f.properties.Status === 'Established' && !/\(?outline\)?$/i.test(f.properties.Name))
    .filter((f) => !seen.has(f.properties.Name) && seen.add(f.properties.Name))
    .map((f) => {
      const p = f.properties;
      const alias = NAME_ALIASES[p.Name] ?? {};
      const name = alias.name ?? p.Name;
      return {
        id: slug(name),
        name,
        aka: alias.aka ?? null,
        states: normalizeStates(p.States),
        created: isoDate(p.Established),
        removed: null,
        within: splitList(p.Within),
        contains: splitList(p.Contains_),
        cfr: (p.CFR_Section ?? '').replace(/^27 CFR\s*/, '') || null,
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
      publisher: 'Alcohol and Tobacco Tax and Trade Bureau (TTB), AVA Map Explorer',
      license: 'US Government work (public domain)',
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
