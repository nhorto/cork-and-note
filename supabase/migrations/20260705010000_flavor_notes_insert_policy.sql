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

drop policy if exists "Authenticated users can add flavor notes" on public.flavor_notes;
create policy "Authenticated users can add flavor notes"
  on public.flavor_notes for insert
  to authenticated
  with check (true);
