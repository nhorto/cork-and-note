-- Winery directory seed table (epic #203 Phase 2, cost-lean architecture:
-- docs/research/winery-enrichment-google-places.md §2.5).
--
-- Discovery pins for the Wineries tab come from OUR OWN winery table,
-- server-side loaded once from the free FSQ OS Places dataset (Foursquare's
-- open data release, Apache 2.0), NOT from Google Nearby Search. This is
-- distinct from `public.wineries`, which holds user-created records from
-- logged visits. Rows here are matched to a `google_place_id` lazily via
-- Google Text Search IDs-Only (free) when a directory winery's detail page
-- is opened; see supabase/migrations/20260909230000_places_enrichment.sql.
--
-- NOTE: as of this migration, no data has been loaded — see
-- data/winery-directory/README.md for the extraction blocker (FSQ OS
-- Places' free anonymous mirrors have since been gated) and the loader
-- script (scripts/load-winery-directory.mjs) that applies the CSV once one
-- is produced.

create table if not exists public.winery_directory (
  id bigint generated always as identity primary key,
  fsq_place_id text not null unique,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text null,
  city text null,
  state text null,
  postcode text null,
  website text null,
  google_place_id text null,
  created_at timestamptz not null default now()
);

alter table public.winery_directory enable row level security;

-- Read-only to authenticated app users. No insert/update/delete policies:
-- this table is populated exclusively by the server-side loader script
-- using the service role key, which bypasses RLS.
create policy "winery_directory_select_authenticated"
  on public.winery_directory for select
  to authenticated
  using (true);

create index if not exists winery_directory_state_idx
  on public.winery_directory (state);

create index if not exists winery_directory_lat_lng_idx
  on public.winery_directory (latitude, longitude);
