-- Allow authenticated users to add custom flavor notes to the shared catalog.
--
-- `public.flavor_notes` has RLS enabled but only a SELECT policy
-- ("Anyone can read flavor notes"). With no INSERT policy in place, creating a
-- custom tasting note failed with:
--   new row violates row-level security policy for table "flavor_notes" (42501)
--
-- flavor_notes is a global catalog (id, name UNIQUE, category) with no per-user
-- ownership, so custom notes are shared entries and the UNIQUE(name) constraint
-- prevents duplicates. We grant INSERT only (not UPDATE/DELETE), so users can
-- extend the catalog but cannot modify or remove existing notes.

-- Idempotent: safe to apply via `supabase db push` or the dashboard SQL editor,
-- and safe to re-run (the drop-if-exists guards against "policy already exists").
drop policy if exists "Authenticated users can add flavor notes" on public.flavor_notes;

create policy "Authenticated users can add flavor notes"
  on public.flavor_notes
  for insert
  to authenticated
  with check (true);
