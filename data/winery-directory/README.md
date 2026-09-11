# US winery directory seed

**Status: DATA LOADED (2026-09-09).** `us-wineries.csv.gz` in this directory
contains 14,482 US wineries extracted from **Overture Maps' `places` theme**
(Option B from the original blocker — see "History: the FSQ OS Places
blocker" below). This is a source swap from the original plan (Foursquare's
FSQ OS Places, Apache-2.0), which is documented in that section for context.
The **license for this data is CDLA-Permissive-2.0**, not Apache-2.0 — see
"License / attribution" below before distributing or modifying it further.

## 2026-09-09: extracted from Overture Maps

### Release used

`2026-08-19.0` — the latest release in `s3://overturemaps-us-west-2/release/`
as of 2026-09-09 (the other available release at extraction time was the
prior `2026-07-22.0`). Source theme/type: `theme=places/type=place`, 16
zstd-compressed parquet part files, anonymous S3 access, region `us-west-2`,
no credentials required.

### Exact query

Run with DuckDB (`httpfs` + `spatial` extensions). This queries the parquet
files remotely — DuckDB's column pruning means only the columns selected
below (plus the `categories`/`confidence`/`operating_status` filter columns)
are actually fetched, not the full ~10 GB dataset:

```sql
INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
SET s3_region = 'us-west-2';
PRAGMA threads = 8;

CREATE OR REPLACE TABLE us_wineries AS
WITH places AS (
  SELECT
    id AS gers_id,
    names.primary AS name,
    ST_Y(geometry) AS latitude,
    ST_X(geometry) AS longitude,
    addresses[1].freeform AS address,
    addresses[1].locality AS city,
    addresses[1].region AS state,
    addresses[1].postcode AS postcode,
    addresses[1].country AS country,
    (CASE WHEN len(websites) > 0 THEN websites[1] ELSE NULL END) AS website,
    confidence,
    operating_status,
    categories.primary AS category
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*.parquet'
  )
  WHERE categories.primary = 'winery'
),
wineries AS (
  SELECT *
  FROM places
  WHERE country = 'US'
    AND confidence >= 0.5
    AND (operating_status IS NULL OR operating_status != 'permanently_closed')
),
deduped AS (
  -- Same name + ~same coordinates (3 decimal places, ~110m) counts as a
  -- duplicate; keep the lowest gers_id deterministically. Overture still
  -- has near-duplicate entries under slightly different names/coordinates
  -- for the same physical winery (e.g. multiple "Robert Mondavi Winery"
  -- rows in different Napa-area towns) that this pass does not catch —
  -- that's a data-quality property of the source, not a bug in this query.
  SELECT *,
    row_number() OVER (
      PARTITION BY lower(name), round(latitude, 3), round(longitude, 3)
      ORDER BY gers_id
    ) AS rn
  FROM wineries
)
SELECT gers_id, name, latitude, longitude, address, city, state, postcode, website
FROM deduped
WHERE rn = 1;

SELECT count(*) AS total FROM us_wineries;

COPY us_wineries TO 'us-wineries.csv' (HEADER, DELIMITER ',');
```

Then: `gzip -9 us-wineries.csv` and the `gers_id` CSV header was renamed to
`fsq_place_id` (see "Column naming mismatch" below) before committing.

### Category taxonomy value

Verified directly against the data (not just docs): `categories.primary`
values under the wine umbrella in this release are `winery`,
`beer_wine_and_spirits`, `wine_bar`, `wine_wholesaler`,
`wine_tasting_room`, `wine_tours`, and `wine_tasting_classes`. Only
`winery` was selected — `wine_bar` and the other adjacent categories are
explicitly excluded per the task brief (they are not wineries).

### Confidence threshold

**`confidence >= 0.5`.** Checked the distribution of `confidence` for
`categories.primary = 'winery' AND addresses[1].country = 'US'` on a sample
partition before deciding: values ranged ~0.05–1.0 with a mean of ~0.82, and
only a small minority (~4% in the sample) fell below 0.5. 0.5 drops the
low-confidence tail without cutting meaningfully into the real winery count.

### Closed-place filter

Rows with `operating_status = 'permanently_closed'` were excluded. Rows with
`operating_status IS NULL` (the overwhelming majority — Overture doesn't
populate this field for most places) were kept, since NULL means "unknown,"
not "closed."

### Total row count

**14,482** US wineries after the country/category/confidence/closed filters
and exact-duplicate collapse. This is within the task's expected range
(4,000–25,000); no filter-correctness investigation was needed.

### Per-state counts (VA / CA / NY / OR / WA)

| State | Count |
|-------|------:|
| CA    | 5,374 |
| NY    |   657 |
| OR    |   956 |
| VA    |   484 |
| WA    | 1,106 |

### 5 sample Virginia rows

| name | city | postcode | website |
|------|------|----------|---------|
| 12 Ridges Vineyard | Vesuvius | 24483-2116 | http://www.12ridges.com/ |
| 2 Witches Winery & Brewing Company | Danville | 24541-3545 | http://www.2witcheswinebrew.com |
| 50 West Vineyards | Middleburg | 20117-2918 | http://50westvineyards.com/ |
| 8 Chains North Winery | Waterford | 20197 | https://8chainsnorth.com/ |
| 868 Estate Vineyards | Purcellville | 20132 | https://868estatevineyards.com/ |

(Full rows, including lat/lon and street address, are in the CSV.)

### Spot-checks

All 3 requested famous wineries are present (plus corporate/related-entity
duplicates Overture carries separately, e.g. multiple Ste Michelle Wine
Estates and Robert Mondavi rows across nearby cities):

- **Robert Mondavi** — `Robert Mondavi Winery` (Napa, Oakville-area/Napa,
  Lodi), `Robert Mondavi Wineries,Napa Valley` (St Helena), etc.
- **Chateau Ste Michelle** — `Chateau Ste Michelle Canoe Ridge Estate
  winery` and `Chateau Ste Michelle River Ridge Estate Winery` (both
  Paterson, WA), `Ste Michelle Wine Estates` (Grandview / Paterson, WA).
- **Barboursville Vineyards** — `Barboursville Vineyards` (Barboursville
  and Charlottesville, VA), `Barboursville Winery` (Barboursville, VA;
  older/alternate naming for the same operation).

### Column naming mismatch (read before running the loader)

`scripts/load-winery-directory.mjs` and
`supabase/migrations/20260910000000_winery_directory.sql` both use the
column name `fsq_place_id`, inherited from the original FSQ OS Places plan.
Since this data comes from Overture instead, the "id" is actually an
**Overture GERS id** (a UUID, e.g.
`7a825350-02f5-4e17-aac6-ed0c0fd408ca`), not a Foursquare place id. Rather
than change the table/loader schema in this data-only PR, the CSV's id
column is still **named `fsq_place_id`** (the DuckDB query above produces
it as `gers_id` and the header is renamed before commit) so the existing
loader works unmodified. A follow-up PR should rename the column (in the
migration, the loader, and this CSV) to something source-neutral like
`external_place_id`, plus record which source produced each row if we ever
blend sources.

## Quarterly re-ingest procedure (#225)

Overture publishes a new `places` release roughly monthly; re-running this
extract about once a quarter keeps the directory from fossilizing. The
freshness columns involved (`updated_at`, `source_release`,
`operating_status`) come from
`supabase/migrations/20260910120000_directory_freshness.sql`.

1. **Find the latest release.** List
   `s3://overturemaps-us-west-2/release/` (anonymous access, `us-west-2`)
   and note the newest version, e.g. `2026-11-18.0`.
2. **Re-run the DuckDB extract** from "Exact query" above, changing only the
   release in the `read_parquet` path. Re-verify that
   `categories.primary = 'winery'` is still the right taxonomy value for the
   new release (Overture has changed category schemas before).
3. **Rename the header + compress** exactly as before: the `gers_id` column
   header becomes `fsq_place_id`, then `gzip -9 us-wineries.csv`.
4. **Commit the new CSV** to this directory (replacing the old one) with the
   release noted in the commit message, and update the row counts in this
   README if they moved meaningfully.
5. **Load with the release stamp** (owner-run, service role — never in CI):

   ```bash
   SUPABASE_URL=https://<project-ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   node scripts/load-winery-directory.mjs --release <release> \
     data/winery-directory/us-wineries.csv.gz
   ```

What the loader now does on a re-run:

- **Upserts** every CSV row on `fsq_place_id`, stamping
  `source_release = <release>` and `updated_at = now`. The upsert does NOT
  touch `operating_status`, so a Google-confirmed `permanently_closed` (set
  by the `places` Edge Function from `businessStatus`) survives re-ingest
  even if Overture still lists the place.
- **Flags rows that vanished** from the new extract as
  `operating_status = 'possibly_closed'` — never hard-deletes them (users
  may have promoted them into their own wineries, and Overture churn is not
  proof of closure). Rows already `permanently_closed` keep that stronger
  flag.
- **Heals `possibly_closed` rows that reappear** in the new extract back to
  `NULL` (unknown/assumed open).

Client behavior: discovery queries (`lib/wineryDirectory.js`) exclude only
`permanently_closed` rows; `possibly_closed` rows still show, and a Google
`details` call (Pro winery page open) or a user report
(`public.winery_reports`) settles their fate later.

## Freshness: duplicates and the Google validation pass (#271, #273, epic #268)

Two more `operating_status` values and three bookkeeping columns landed on
2026-09-11 (migrations `20260912010000_directory_duplicates` and
`20260912020000_directory_validated_at`):

| column | meaning |
|---|---|
| `operating_status = 'duplicate'` | this row is the same winery as `duplicate_of`; hidden from discovery, never deleted |
| `duplicate_of` | the kept row's id |
| `validated_at` | when `scripts/validate-winery-directory.mjs` last checked the row against Google |
| `validation_note` | why a checked row stayed unknown (`no match in box`, `name mismatch: …`, `… km away`) |

**Exact-name pass (one-off, in the migration):** rows with the same
normalised name in the same state within 3 km are one winery; the kept row
prefers Google-confirmed open, then a website, then an address, then the
lowest id, never a permanently closed row over an open one. 342 rows flagged
on 2026-09-11; spot-check list in `docs/audits/directory-duplicates-2026-09-11.csv`.

**Google pass (daily, `.github/workflows/validate-directory.yml`):**
`scripts/validate-winery-directory.mjs` takes 160 unvalidated rows a day
(priority states first), finds each on Google with a free IDs-only text
search restricted to a 5 km box, then fetches `id,displayName,location,businessStatus`
(Place Details Pro SKU, 5,000 free calls a month; the mask must never grow
to include rating or hours). A match is trusted only if the names share
distinctive words and it lies within 3 km; then `operating_status` and
`google_place_id` are written. A place id already held by another row makes
this row a `duplicate`; a flagged twin nearer Google's location than the kept
row swaps roles (Overture sometimes kept the wrong twin's coordinates).
Google's location is used in the moment and never stored. About three months
covers the directory at $0; after that run it with `--refresh-older-than 90`.

Review bucket: `select id, name, city, state, validation_note from
winery_directory where validation_note is not null` lists rows Google could
not confirm (no place in the box, or a different-named winery there, which
often means Overture's coordinates are off).

## License / attribution

This data is licensed under **CDLA-Permissive-2.0** (Community Data License
Agreement – Permissive – Version 2.0), Overture Maps Foundation's license
for the `places` theme — **not** Apache-2.0, which was the license that
would have applied under the original FSQ OS Places plan. Per
https://docs.overturemaps.org/attribution/:

- **General citation** (recommended for any publication/use of Overture
  data): *"Overture Maps Foundation, overturemaps.org"*
- **Places theme sources**, each themselves under CDLA-Permissive-2.0: Meta,
  Microsoft, PinMeTo, Krick, RenderSEO, DAC, BrightQuery.
- **Foursquare-sourced places within the Places theme** are a special case:
  Apache-2.0, copyright "2024 Foursquare Labs, Inc. All rights reserved,"
  with attribution requirements per Foursquare's own NOTICE.txt
  (https://opensource.foursquare.com/places-notice-txt/). Since this
  extract does not carry a per-row `sources` column through to the CSV, we
  cannot cheaply identify which individual winery rows originated from
  Foursquare vs. another provider — treat the whole extract as subject to
  **both** CDLA-Permissive-2.0 (the theme's overall license) **and** the
  Foursquare NOTICE.txt attribution requirement, to be safe.
- **AllThePlaces-sourced places**: CC0 1.0 (public domain) — no obligation,
  mentioned for completeness.
- If any underlying contribution includes OpenStreetMap data (some Places
  theme sources do), also include: *"© OpenStreetMap contributors, Overture
  Maps Foundation."*

Practical implication once this data is loaded: our developer docs (or this
README, since we're distributing derived flat-file data) must carry the
"Overture Maps Foundation, overturemaps.org" citation, the CDLA-Permissive-2.0
license reference (https://cdla.dev/permissive-2-0/), and the OSM +
Foursquare attribution lines above, alongside the dataset.

## Apply steps

```bash
# 1. Apply the schema (already on main; skip if already applied)
supabase db push   # or: apply supabase/migrations/20260910000000_winery_directory.sql
                     # against the target project

# 2. Load the data (service role key required; never ship this key in the app)
npm install @supabase/supabase-js   # if not already a project dependency
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/load-winery-directory.mjs --release 2026-08-19.0 \
  data/winery-directory/us-wineries.csv.gz
```

`--release` is required (#225): it stamps `winery_directory.source_release`
so re-ingests are auditable per row. Use the Overture release the CSV was
extracted from.

## Files in this PR

- `data/winery-directory/README.md` — this file.
- `data/winery-directory/us-wineries.csv.gz` — 14,482 US wineries, columns
  `fsq_place_id` (actually an Overture GERS id — see "Column naming
  mismatch" above), `name`, `latitude`, `longitude`, `address`, `city`,
  `state`, `postcode`, `website`. Gzipped, ~1.0 MB.
- `supabase/migrations/20260910000000_winery_directory.sql` — unchanged
  from main; creates `public.winery_directory` (empty until loaded), RLS:
  `select` for `authenticated` only, no client-writable policies. Indexes
  on `state` and `(latitude, longitude)`.
- `scripts/load-winery-directory.mjs` — unchanged from main; batched (500
  rows) upsert on `fsq_place_id` into `winery_directory`, via
  `@supabase/supabase-js`.

This PR does **not** run the loader or touch any live Supabase project —
only files are added. Applying the migration/load is a separate,
owner-run step (see "Apply steps").

## History: the FSQ OS Places blocker (2026-09-09, resolved via source swap)

The original plan (per
`docs/research/winery-enrichment-google-places.md` §2.5) was to seed this
table from Foursquare's free, open **FSQ OS Places** dataset. Both of that
dataset's documented free/anonymous access paths were found to be shut off:

1. **Anonymous S3 mirror** (`s3://fsq-os-places-us-east-1/release/...`,
   `us-east-1`, no credentials). As of 2026-09-09 this bucket contains only
   `LICENSE.txt` and `NOTICE.txt` at its root — the `release/` prefix that
   used to hold the parquet data no longer exists.
2. **Hugging Face mirror** (`foursquare/fsq-os-places`). Now a gated
   dataset requiring an account, an access-request form, and Foursquare's
   approval — resolving any parquet file anonymously returns HTTP 401
   (`x-error-code: GatedRepo`).

No AWS credentials or Hugging Face token were available in that session, and
HF's gated-dataset approval is an interactive step that couldn't be
completed non-interactively. That PR (#212) shipped the schema and loader
only, with three documented options for unblocking: (A) get FSQ OS Places
HF access, (B) swap to Overture Maps' openly-accessible `places` theme, or
(C) defer. **This extraction executes Option B.** Overture's `places` theme
is itself partly built from Foursquare's own open places contribution plus
other providers (see "License / attribution" above), so this is a related
but distinct dataset — different license (CDLA-Permissive-2.0, not
Apache-2.0), different schema (Overture's `categories`/`confidence`
instead of FSQ's category id list), and a different id space (Overture GERS
ids instead of FSQ place ids — see "Column naming mismatch" above).

FSQ OS Places' own license/attribution text (Apache-2.0), preserved here in
case a future PR blends in FSQ data directly:

```
© 2025 Foursquare Labs, Inc. All rights reserved.

The Foursquare OS Places dataset (the "Data") is licensed under the Apache License, Version 2.0 (the "License"). You may not use, modify, or distribute the Data except in compliance with the License.

As set forth more fully in the License, if you use, modify, or distribute the Data, you must:
* provide recipients with a copy of the License.
* if applicable, include prominent notices to the extent you've changed the Data.
* preserve attribution to Foursquare, including preserving the full content of this NOTICE.txt file.

To ensure appropriate attribution to Foursquare, we recommend the following:
* if using/distributing the Data in flat file form as-is or after making changes/modifications: include this NOTICE.txt file, which may be modified to include an additional notice of your changes/modifications, if any.
* if using/distributing the Data in API form as-is or after making changes/modifications: include a copy of the content from this NOTICE.txt file prominently in your developer documentation for such API, which may be modified to include an additional notice of your changes/modifications, if any.

You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, the Data distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.

We also encourage you to join our Placemaker community (https://opensource.foursquare.com/placemaker/)—where you can contribute and provide suggestions to improve the accuracy of the Data for future releases for yourself and others.
```
