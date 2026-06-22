-- Wineries write policies (fixes "new row violates row level security policy for
-- table wineries" when dropping a pin / creating a winery).
--
-- The `wineries` table predates the migration files (created in the Supabase
-- dashboard) and only ever had a SELECT policy ("Anyone can read wineries").
-- With RLS enabled and no INSERT policy, every insert was denied — so creating a
-- winery (lib/wineries.js createWinery) and deleting one (deleteWinery) failed.
--
-- `wineries` is a SHARED global catalog (no created_by/user_id column — see
-- lib/wineries.js getUserWineries), so writes are scoped to any authenticated
-- user, mirroring the existing `flavor_notes` insert policy. Referential integrity
-- on delete is still enforced by the NO ACTION FKs from visits/wishlist/favorites/
-- cellar_bottles, plus the app-level reference check in deleteWinery.
-- Idempotent / safe to re-run.

drop policy if exists "Authenticated users can insert wineries" on public.wineries;
create policy "Authenticated users can insert wineries"
  on public.wineries for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update wineries" on public.wineries;
create policy "Authenticated users can update wineries"
  on public.wineries for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete wineries" on public.wineries;
create policy "Authenticated users can delete wineries"
  on public.wineries for delete
  using (auth.role() = 'authenticated');
