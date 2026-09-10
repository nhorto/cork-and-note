-- Winery directory freshness (#225, epic #203).
--
-- The 14,482-row Overture extract was filtered for permanently-closed places
-- at extract time only; after that nothing tracked whether a directory row is
-- still a real, open winery. Three freshness signals land here:
--
--   1. winery_directory.operating_status — written by the places Edge
--      Function (service role) when a Google details call returns
--      businessStatus, and by the loader's re-ingest pass
--      (scripts/load-winery-directory.mjs) for rows that vanish from a newer
--      Overture release. NULL = unknown (the overwhelmingly common case).
--   2. winery_directory.updated_at / source_release — which Overture release
--      a row last appeared in, and when it was last touched by any writer.
--   3. winery_reports — user-filed problem reports ("permanently closed",
--      "wrong location", …) for owner review. Insert-own / read-own only.
--
-- Idempotent / safe to re-run.

-- ── winery_directory freshness columns ──────────────────────────────────

alter table public.winery_directory
  add column if not exists updated_at timestamptz not null default now();

-- Which Overture release last carried this row (e.g. '2026-08-19.0').
-- Null = loaded before release stamping existed (the initial 2026-09-09 load).
alter table public.winery_directory
  add column if not exists source_release text;

-- Null = unknown/assumed open. Writers:
--   'open'               places fn: Google businessStatus OPERATIONAL
--   'temporarily_closed' places fn: Google businessStatus CLOSED_TEMPORARILY
--   'permanently_closed' places fn: Google businessStatus CLOSED_PERMANENTLY
--   'possibly_closed'    loader: row missing from a newer Overture extract
alter table public.winery_directory
  add column if not exists operating_status text;

do $$
begin
  if not exists (
    select from pg_constraint
    where conname = 'winery_directory_operating_status_check'
  ) then
    alter table public.winery_directory
      add constraint winery_directory_operating_status_check
      check (
        operating_status is null
        or operating_status in
          ('open', 'temporarily_closed', 'permanently_closed', 'possibly_closed')
      );
  end if;
end $$;

-- The client discovery queries filter out permanently-closed rows. Partial
-- index: the column is NULL for almost every row, so only flagged rows are
-- worth indexing.
create index if not exists winery_directory_operating_status_idx
  on public.winery_directory (operating_status)
  where operating_status is not null;

-- The Edge Function's place-id write-back matches on google_place_id.
create index if not exists winery_directory_google_place_id_idx
  on public.winery_directory (google_place_id)
  where google_place_id is not null;

-- ── winery_reports ──────────────────────────────────────────────────────

create table if not exists public.winery_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Either/both may be null: directory_id when the report came from a
  -- directory-sourced page (the link only survives the first navigation
  -- after promotion — see app/winery/[id].js), winery_id for the user's own
  -- winery row. wineries.id is bigint (identity), not uuid.
  directory_id bigint references public.winery_directory (id) on delete set null,
  winery_id bigint references public.wineries (id) on delete set null,
  reason text not null check (reason in ('permanently_closed', 'wrong_location', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.winery_reports enable row level security;

-- Users file reports as themselves and can see (only) their own. No update
-- or delete: reports are an append-only queue the owner reviews with the
-- service role.
drop policy if exists "winery_reports_insert_own" on public.winery_reports;
create policy "winery_reports_insert_own"
  on public.winery_reports for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "winery_reports_select_own" on public.winery_reports;
create policy "winery_reports_select_own"
  on public.winery_reports for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists winery_reports_user_id_idx
  on public.winery_reports (user_id);
