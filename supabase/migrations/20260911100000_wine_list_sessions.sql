-- Saved "Choose from a wine list" sessions (Pro tool, research doc §4 and §8).
-- One row per list the user chose to save: the corrected entries they checked,
-- the preferences they gave, and the picks the sommelier returned. Prices live
-- inside the JSON as integer minor units; `currency` is denormalised so a
-- saved-list row can show "$24" without opening the JSON.
--
-- Saved rows stay readable after Pro expires (viewing is not metered); only
-- generating a new session needs Pro, and that is enforced by the chat Edge
-- Function, not here. Owner-only RLS for every verb.
-- Idempotent / safe to re-run.

create table if not exists public.wine_list_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text,
  entries      jsonb not null default '[]'::jsonb,
  preferences  jsonb not null default '{}'::jsonb,
  picks        jsonb not null default '[]'::jsonb,
  currency     text,
  created_at   timestamptz not null default now()
);

create index if not exists wine_list_sessions_user_time_idx
  on public.wine_list_sessions (user_id, created_at desc);

alter table public.wine_list_sessions enable row level security;

drop policy if exists "own wine list sessions select" on public.wine_list_sessions;
drop policy if exists "own wine list sessions insert" on public.wine_list_sessions;
drop policy if exists "own wine list sessions update" on public.wine_list_sessions;
drop policy if exists "own wine list sessions delete" on public.wine_list_sessions;

create policy "own wine list sessions select" on public.wine_list_sessions
  for select using (auth.uid() = user_id);
create policy "own wine list sessions insert" on public.wine_list_sessions
  for insert with check (auth.uid() = user_id);
create policy "own wine list sessions update" on public.wine_list_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own wine list sessions delete" on public.wine_list_sessions
  for delete using (auth.uid() = user_id);
