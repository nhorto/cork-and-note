-- Fix 42501 "new row violates row-level security policy" when saving a custom
-- tasting note (July 2026 audit, reported bug). public.flavor_notes has RLS
-- enabled but the only committed policy is SELECT; the INSERT policy that
-- 20260619000000_wineries_write_policies.sql refers to ("mirroring the existing
-- flavor_notes insert policy") was only ever created ad-hoc in one environment
-- and never landed in a migration — so fresh/production databases reject every
-- custom-note insert.
--
-- The client upserts with { onConflict: 'name', ignoreDuplicates: true }
-- (lib/visits.js createWineFlavorNotes): ON CONFLICT DO NOTHING needs only this
-- INSERT policy, no UPDATE policy. The catalog stays globally readable — custom
-- note *names* are shared vocabulary, per-wine links stay owner-scoped through
-- wine_flavor_notes. Idempotent / safe to re-run.
--
-- 2026-07-16 (at apply time): the live prod DB was found to ALREADY carry the
-- ad-hoc policy under a different name — "Authenticated users can insert flavor
-- notes", with_check (auth.role() = 'authenticated'), role public — which is
-- functionally equivalent to the one below. So 42501 was NOT reproducing in
-- prod; the real exposure was fresh databases, where nothing created it. Because
-- the names differ, creating ours without dropping the legacy one leaves two
-- redundant PERMISSIVE INSERT policies OR'd together. Dropping it by name below
-- keeps the resulting schema deterministic and matching this file. The drop is
-- a no-op on any DB that never had the ad-hoc policy (e.g. fresh ones).

-- Legacy ad-hoc name (prod only) — superseded by the policy created below.
drop policy if exists "Authenticated users can insert flavor notes" on public.flavor_notes;

drop policy if exists "Authenticated users can add flavor notes" on public.flavor_notes;
create policy "Authenticated users can add flavor notes"
  on public.flavor_notes for insert
  to authenticated
  with check (true);
