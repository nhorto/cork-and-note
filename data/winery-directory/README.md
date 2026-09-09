# US winery directory seed — status: BLOCKED, no CSV shipped in this PR

**tl;dr:** this branch ships the `winery_directory` table (migration) and the
loader script, but **not** `us-wineries.csv.gz`. FSQ OS Places' two
documented free/anonymous distribution channels have both been shut off
since `docs/research/winery-enrichment-google-places.md` was written, and no
credentials for the remaining (gated) channel were available in this
sandboxed session. See "The blocker" below, then "What we need from Nick" for
the unblock options.

## What was supposed to happen

Per `docs/research/winery-enrichment-google-places.md` §2.5, discovery pins
for the Wineries tab come from our own `winery_directory` table, seeded once
from Foursquare's free, open **FSQ OS Places** dataset — not from Google
Nearby Search. The intended extraction: DuckDB querying the dataset's
parquet remotely (no full download), filtered to US wineries, written out as
a CSV for a one-time server-side load into Supabase.

## The blocker

Both documented free access paths for FSQ OS Places are no longer usable
without an approved account:

1. **Anonymous S3 mirror** (`s3://fsq-os-places-us-east-1/release/...`,
   `us-east-1`, no credentials). As of 2026-09-09 this bucket contains only
   `LICENSE.txt` and `NOTICE.txt` at its root — the `release/` prefix that
   used to hold the parquet data no longer exists:

   ```
   $ curl -s "https://fsq-os-places-us-east-1.s3.amazonaws.com/?list-type=2&prefix=release/&max-keys=50"
   <ListBucketResult ...><Prefix>release/</Prefix><KeyCount>0</KeyCount>...</ListBucketResult>

   $ curl -s "https://fsq-os-places-us-east-1.s3.amazonaws.com/?list-type=2&max-keys=50"
   <ListBucketResult ...><KeyCount>2</KeyCount>...
     <Contents><Key>LICENSE.txt</Key>...</Contents>
     <Contents><Key>NOTICE.txt</Key>...</Contents>
   </ListBucketResult>
   ```

2. **Hugging Face mirror** (`foursquare/fsq-os-places`). The dataset card
   itself now says: *"Foursquare OS Places is now a gated dataset on
   Hugging Face"* — it requires a Hugging Face account, filling out an
   access-request form (organization, title, country, intended use), and
   Foursquare's approval before any file can be downloaded, even though the
   dataset is still nominally Apache-2.0-licensed. Resolving any parquet
   file anonymously 401s:

   ```
   $ curl -sI "https://huggingface.co/datasets/foursquare/fsq-os-places/resolve/main/release/dt=2026-08-11/places/parquet/places_000000.parquet"
   HTTP/2 401
   x-error-code: GatedRepo
   x-error-message: Access to dataset foursquare/fsq-os-places is restricted.
     You must have access to it and be authenticated to access it. Please log in.
   ```

   The dataset card does confirm the **latest release as of this check is
   `dt=2026-08-11`** (3 parquet shards for the `places` config, per the
   repo's file tree — sizes ~118–125 MB each, well beyond what's worth
   downloading in full even if access were granted; the DuckDB query below
   is written to filter remotely, same as originally planned).

No AWS credentials and no Hugging Face token were present in this
environment, and HF's gated-dataset approval is an interactive step (login +
form + wait for/auto-approval) that can't be completed non-interactively.
Rather than fabricate winery rows to fill `us-wineries.csv.gz`, this PR ships
the schema and tooling only. **Do not treat the absence of a CSV here as "0
wineries" — it means extraction hasn't run yet.**

## What we need from Nick (pick one)

**Option A — get FSQ OS Places access (matches the original plan exactly):**
1. Create a free Hugging Face account (or use an existing one) and open
   https://huggingface.co/datasets/foursquare/fsq-os-places
2. Accept the gating terms / submit the access request form. (Foursquare's
   form has historically auto-approved; may take a few minutes.)
3. Generate a Hugging Face **User Access Token** (read scope) from
   https://huggingface.co/settings/tokens
4. Hand the token to whoever runs the extraction (env var `HF_TOKEN`, or
   `huggingface-cli login`), and re-run the query in "Exact query" below —
   swap the `read_parquet(...)` source for either:
   - `hf://datasets/foursquare/fsq-os-places/release/dt=<latest>/places/parquet/*.parquet`
     via DuckDB's `httpfs` (DuckDB reads the token from `HF_TOKEN` or
     `~/.cache/huggingface/token`; may need `duckdb -c "INSTALL httpfs; SET
     hf_token='<token>';"`, syntax varies by DuckDB version — check
     `duckdb --version` docs at run time), or
   - `huggingface-cli download foursquare/fsq-os-places --include
     "release/dt=<latest>/places/parquet/*.parquet" --local-dir ./fsq-places`
     followed by `read_parquet('./fsq-places/**/*.parquet')`.
5. Once the CSV is produced, gzip it into this directory as
   `us-wineries.csv.gz`, fill in the sanity-check numbers below, and run the
   loader (see "Apply steps").

**Option B — swap the data source.** Overture Maps' `places` theme is still
openly, anonymously accessible on S3 as of this check
(`s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/...`, no
gating) and its "places" theme is itself partly built from Foursquare's open
places contribution plus other providers. Trade-offs: different license
(**CDLA-Permissive-2.0**, not Apache-2.0 — the attribution note below would
need to change), different schema (categories, confidence scores), and it's
a superset that needs its own winery-category filter. This is a bigger scope
change than a source swap and should be a explicit decision, not something
done silently in a "seed" PR.

**Option C — defer.** Ship this PR's schema/loader now (harmless, empty
table), revisit the data load once Option A or B is resolved.

## Exact query (to run once access is available)

```sql
INSTALL httpfs;
LOAD httpfs;
SET s3_region = 'us-east-1';

CREATE OR REPLACE TABLE us_wineries AS
WITH places AS (
  SELECT
    fsq_place_id,
    name,
    latitude,
    longitude,
    address,
    locality AS city,
    region   AS state,
    postcode,
    website,
    country,
    date_closed,
    fsq_category_ids,
    fsq_category_labels
  FROM read_parquet(
    's3://fsq-os-places-us-east-1/release/dt=2026-08-11/places/parquet/*.parquet'
    -- once HF access is granted, swap for:
    -- 'hf://datasets/foursquare/fsq-os-places/release/dt=2026-08-11/places/parquet/*.parquet'
  )
),
wineries AS (
  SELECT *
  FROM places
  WHERE country = 'US'
    AND date_closed IS NULL
    AND (
      list_contains(fsq_category_ids, '50327c8591d4c4b30a586d5d')
      OR list_any_value(fsq_category_labels, l -> l LIKE '%> Winery')
    )
),
deduped AS (
  -- Same name + ~same coordinates (3 decimal places, ~110m) counts as a
  -- duplicate; keep the lowest fsq_place_id deterministically.
  SELECT *,
    row_number() OVER (
      PARTITION BY lower(name), round(latitude, 3), round(longitude, 3)
      ORDER BY fsq_place_id
    ) AS rn
  FROM wineries
)
SELECT fsq_place_id, name, latitude, longitude, address, city, state, postcode, website
FROM deduped
WHERE rn = 1;

-- Sanity checks (expect roughly 5,000-20,000 total; <1,000 or >100,000 means
-- the category filter is wrong):
SELECT count(*) FROM us_wineries;
SELECT state, count(*) FROM us_wineries
  WHERE state IN ('VA','CA','NY','OR','WA') GROUP BY state ORDER BY state;
SELECT * FROM us_wineries WHERE state = 'VA' LIMIT 5;

COPY us_wineries TO 'data/winery-directory/us-wineries.csv' (HEADER, DELIMITER ',');
```

Then: `gzip -9 data/winery-directory/us-wineries.csv`.

## Sanity-check numbers

**Not filled in — extraction has not run.** Once it has, populate:

- Dataset release used: `dt=2026-08-11` (or whatever is latest at run time)
- Total US winery rows: TBD (expect ~5,000–20,000)
- Per-state counts — VA: TBD, CA: TBD, NY: TBD, OR: TBD, WA: TBD
- 5 sample Virginia rows (table): TBD

## License / attribution (verified, does not require data access)

FSQ OS Places is Apache License 2.0. Foursquare's `NOTICE.txt`
(`s3://fsq-os-places-us-east-1/NOTICE.txt`), reproduced verbatim per its own
"preserve the full content of this NOTICE.txt file" requirement:

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

Practical implication once data is loaded: our developer docs (or this
README, since we're distributing derived flat-file data) must keep this
NOTICE.txt text, and a copy of the Apache 2.0 license text/link, alongside
the dataset.

## Files in this PR

- `data/winery-directory/README.md` — this file.
- `data/winery-directory/us-wineries.csv.gz` — **not present**; see blocker
  above.
- `supabase/migrations/20260910000000_winery_directory.sql` — creates
  `public.winery_directory` (empty until loaded), RLS: `select` for
  `authenticated` only, no client-writable policies. Indexes on `state` and
  `(latitude, longitude)`.
- `scripts/load-winery-directory.mjs` — batched (500 rows) upsert on
  `fsq_place_id` into `winery_directory`, via `@supabase/supabase-js`.

## Apply steps (once a real CSV exists)

```bash
# 1. Apply the schema
supabase db push   # or: apply supabase/migrations/20260910000000_winery_directory.sql
                     # against the target project

# 2. Load the data (service role key required; never ship this key in the app)
npm install @supabase/supabase-js   # if not already a project dependency
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/load-winery-directory.mjs data/winery-directory/us-wineries.csv.gz
```
