-- Taste reports: the saved result of the "My taste" Pro tool
-- (docs/research/pro-features-ux-and-implementation-2026-09-11.md, section 5).
--
-- One row per generated report. The client computes `aggregates` (counts,
-- type / grape splits, slider averages) in code and stores the model's
-- validated prose in `report`. `source_revision` is a hash of the rated
-- tastings the report was built from, so a later edit or deletion in the
-- journal marks the report out of date without touching the journal itself.
-- `evidence_ids` lists the tasting ids the model was allowed to cite.
--
-- Owner-only RLS. Idempotent and safe to re-run.

create table if not exists public.taste_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_revision text not null,
  tier text not null check (tier in ('first_impressions', 'full')),
  wine_count integer,
  session_count integer,
  aggregates jsonb not null,
  report jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

alter table public.taste_reports enable row level security;

drop policy if exists "taste_reports_select_own" on public.taste_reports;
create policy "taste_reports_select_own"
  on public.taste_reports for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "taste_reports_insert_own" on public.taste_reports;
create policy "taste_reports_insert_own"
  on public.taste_reports for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "taste_reports_delete_own" on public.taste_reports;
create policy "taste_reports_delete_own"
  on public.taste_reports for delete
  to authenticated
  using (user_id = auth.uid());

-- "Latest report for this user" is the only read the app makes.
create index if not exists taste_reports_user_created_idx
  on public.taste_reports (user_id, created_at desc);
