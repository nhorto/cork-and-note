-- trip_plans: saved "Plan a wine day" itineraries (Pro tool; design brief
-- docs/research/pro-features-ux-and-implementation-2026-09-11.md section 7).
--
-- What is stored is the USER'S plan: their chosen stops (our own directory or
-- winery ids, names and coordinates), intended times and per-stop visit
-- lengths, plus the drive-leg minutes the schedule was computed from. Google
-- opening hours, business details and route geometry are never written here;
-- the app re-fetches hours when a plan is opened (Places policy).
--
-- Saved plans stay readable after Pro expires; only rebuilding drive times
-- and asking the sommelier need Pro, and both are gated server-side.

create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  trip_date date,
  start_label text,
  start_lat double precision,
  start_lng double precision,
  start_time text,          -- 'HH:MM' local to the trip
  end_time text,            -- 'HH:MM' local to the trip
  stops jsonb not null,     -- ordered [{ key, name, lat, lng, source, directoryId, wineryId, city, state, website, visitMinutes }]
  schedule jsonb,           -- computed timeline; derived from stops + legs + settings, safe to rebuild
  legs jsonb,               -- [{ seconds, meters }] per drive leg, from the routes function
  settings jsonb not null default '{}'::jsonb, -- { visitMinutes, lunchMinutes, lunchAfterStop }
  notes text,
  ai_notes jsonb,           -- the optional trip_plan sommelier reply { summary, stop_notes, tips }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_plans enable row level security;

create policy "trip_plans_select_own"
  on public.trip_plans for select
  using (auth.uid() = user_id);

create policy "trip_plans_insert_own"
  on public.trip_plans for insert
  with check (auth.uid() = user_id);

create policy "trip_plans_update_own"
  on public.trip_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trip_plans_delete_own"
  on public.trip_plans for delete
  using (auth.uid() = user_id);

create index if not exists trip_plans_user_date_idx
  on public.trip_plans (user_id, trip_date desc);
