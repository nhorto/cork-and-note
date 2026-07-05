-- Owner-scope UPDATE/DELETE on visit-photos & wine-photos (July 2026 audit, critical #1).
-- Previously both buckets allowed any authenticated user to update/delete ANY object
-- (`auth.role() = 'authenticated'` with no ownership check), so one account could
-- enumerate and destroy every user's photos. Same bug class already fixed for
-- chat-photos (20260221 / 20260609010000).
--
-- Unlike chat-photos we scope on storage.objects.owner_id (set automatically by the
-- storage API on authenticated uploads) instead of parsing the filename, because
-- wine-photos names are NOT uniformly owner-prefixed: visits.js uploads
-- `visit_{uid}_...` / `wine_{uid}_...`, but BottlePhotoPicker uploads under
-- `cellar/...`. owner_id covers both schemes and all legacy objects.
--
-- Public read + authenticated insert are unchanged (the app serves these via
-- getPublicUrl by design). Idempotent / safe to re-run.

-- ---- visit-photos ----
drop policy if exists "visit-photos auth update" on storage.objects;
drop policy if exists "visit-photos owner update" on storage.objects;
create policy "visit-photos owner update" on storage.objects
  for update using (
    bucket_id = 'visit-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );

drop policy if exists "visit-photos auth delete" on storage.objects;
drop policy if exists "visit-photos owner delete" on storage.objects;
create policy "visit-photos owner delete" on storage.objects
  for delete using (
    bucket_id = 'visit-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );

-- ---- wine-photos ----
drop policy if exists "wine-photos auth update" on storage.objects;
drop policy if exists "wine-photos owner update" on storage.objects;
create policy "wine-photos owner update" on storage.objects
  for update using (
    bucket_id = 'wine-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );

drop policy if exists "wine-photos auth delete" on storage.objects;
drop policy if exists "wine-photos owner delete" on storage.objects;
create policy "wine-photos owner delete" on storage.objects
  for delete using (
    bucket_id = 'wine-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );
