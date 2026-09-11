-- Photo buckets: stop anyone from listing everyone's photos.
--
-- Found by scripts/rls-probe.mjs on 2026-09-11. The SELECT policies on the
-- two public photo buckets were `bucket_id = '<bucket>'` with no role or owner
-- condition, so the Storage list endpoint would hand ANY caller, signed in or
-- not, every object name in the bucket. Names embed the owner's user id and a
-- timestamp, and the bucket is public, so a name is a URL: the anon key that
-- ships inside the app was enough to enumerate and download every user's
-- visit and wine photos.
--
-- Public buckets serve bytes by URL WITHOUT consulting this policy, so the
-- app's getPublicUrl display path is unaffected. The app never lists these
-- buckets (delete-account enumerates through list_user_storage_objects as the
-- service role). Owner-scoped SELECT therefore closes the enumeration with no
-- behavior change for the owner.
--
-- Idempotent / safe to re-run.

drop policy if exists "visit-photos public read" on storage.objects;
create policy "visit-photos owner read" on storage.objects
  for select
  using (
    bucket_id = 'visit-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );

drop policy if exists "wine-photos public read" on storage.objects;
create policy "wine-photos owner read" on storage.objects
  for select
  using (
    bucket_id = 'wine-photos'
    and auth.role() = 'authenticated'
    and owner_id = auth.uid()::text
  );
