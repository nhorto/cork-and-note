-- Wine Journey badges (#295). One row per earned badge tier. The app computes
-- progress from the user's own journal and cellar on the device, so this table
-- only records what was earned and when. Awards are never revoked, which is why
-- points are stored on the row: deleting a visit later must not take a badge
-- back. Owner-only RLS.
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  badge_key text not null,
  tier text,
  points integer not null default 0 check (points >= 0),
  earned_at timestamptz not null default now(),
  seen_at timestamptz,
  source text not null default 'live' check (source in ('live', 'backfill')),
  created_at timestamptz not null default now()
);

-- One row per badge tier per user. coalesce keeps the untiered one-offs unique.
create unique index if not exists user_achievements_unique
  on public.user_achievements (user_id, badge_key, coalesce(tier, ''));

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, earned_at desc);

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_achievements_insert_own" on public.user_achievements;
create policy "user_achievements_insert_own"
  on public.user_achievements for insert to authenticated
  with check (user_id = auth.uid());

-- seen_at is the only column the app updates after insert.
drop policy if exists "user_achievements_update_own" on public.user_achievements;
create policy "user_achievements_update_own"
  on public.user_achievements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
