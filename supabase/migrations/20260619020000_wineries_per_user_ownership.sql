-- Per-user winery ownership (app direction change: from a shared Virginia catalog
-- to a general-purpose app where each user privately builds their own winery list).
--
-- Wineries are now PRIVATE per user: a new user starts with an empty list and adds
-- wineries over time (drop a pin / log a session / manual entry). Nothing is shared
-- between users. The legacy ~306 Virginia seed rows were a one-time import for the
-- old Virginia-only product and have been removed (one-time data cleanup, run
-- directly against prod 2026-06-19 — not part of this migration since a fresh DB
-- has no legacy rows).
--
-- This replaces the interim shared-write policies from 20260619000000.
-- Assumes the wineries table is empty of pre-ownership rows (true on prod after the
-- cleanup, and on any fresh DB).

-- 1. Owner column. on delete cascade: deleting a user removes their wineries.
alter table public.wineries
  add column if not exists user_id uuid references public.users (id) on delete cascade;

-- 2. Require an owner going forward.
alter table public.wineries alter column user_id set not null;

create index if not exists wineries_user_idx on public.wineries (user_id);

-- 3. Swap the shared-catalog policies for owner-scoped ones.
drop policy if exists "Anyone can read wineries" on public.wineries;
drop policy if exists "Authenticated users can insert wineries" on public.wineries;
drop policy if exists "Authenticated users can update wineries" on public.wineries;
drop policy if exists "Authenticated users can delete wineries" on public.wineries;

drop policy if exists "Users see own wineries"   on public.wineries;
drop policy if exists "Users insert own wineries" on public.wineries;
drop policy if exists "Users update own wineries" on public.wineries;
drop policy if exists "Users delete own wineries" on public.wineries;

create policy "Users see own wineries"   on public.wineries for select using (user_id = auth.uid());
create policy "Users insert own wineries" on public.wineries for insert with check (user_id = auth.uid());
create policy "Users update own wineries" on public.wineries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own wineries" on public.wineries for delete using (user_id = auth.uid());
