-- Google Places enrichment plumbing (epic #203 Phase 2, plan:
-- docs/research/winery-enrichment-google-places.md §2.5).
--
-- 1. wineries.google_place_id — Google's policy allows storing place IDs
--    indefinitely; everything else (ratings, hours, photos) is live-fetch
--    only, so the ID is the ONLY Google datum that touches our database.
-- 2. places_usage — per-user metering for the `places` edge function,
--    mirroring chat_usage: append-only, RLS-scoped to the owner, so the
--    function's rate-limit reads auto-scope and fail closed.

alter table public.wineries
  add column if not exists google_place_id text;

create index if not exists wineries_google_place_id_idx
  on public.wineries (google_place_id);

create table if not exists public.places_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null, -- 'details' | 'match' | 'photo'
  created_at timestamptz not null default now()
);

alter table public.places_usage enable row level security;

create policy "places_usage_select_own"
  on public.places_usage for select
  using (auth.uid() = user_id);

create policy "places_usage_insert_own"
  on public.places_usage for insert
  with check (auth.uid() = user_id);

create index if not exists places_usage_user_created_idx
  on public.places_usage (user_id, created_at desc);
