-- Recreate the storage buckets the app uses (NOT restored by the DB-only backup).
-- App usage: lib/visits.js uploads to 'visit-photos' / 'wine-photos' (public read via
-- getPublicUrl); app/profile/feedback.js uploads to 'feedback'. The 'chat-photos'
-- bucket is created by 20260220_create_chat_tables.sql.
-- Idempotent: safe to run against a DB that may already have some of these.

insert into storage.buckets (id, name, public)
values
  ('visit-photos', 'visit-photos', true),
  ('wine-photos',  'wine-photos',  true),
  ('feedback',     'feedback',     false)
on conflict (id) do nothing;

-- ---- visit-photos (public read, authenticated write) ----
drop policy if exists "visit-photos public read"   on storage.objects;
drop policy if exists "visit-photos auth insert"    on storage.objects;
drop policy if exists "visit-photos auth update"    on storage.objects;
drop policy if exists "visit-photos auth delete"    on storage.objects;
create policy "visit-photos public read" on storage.objects
  for select using (bucket_id = 'visit-photos');
create policy "visit-photos auth insert" on storage.objects
  for insert with check (bucket_id = 'visit-photos' and auth.role() = 'authenticated');
create policy "visit-photos auth update" on storage.objects
  for update using (bucket_id = 'visit-photos' and auth.role() = 'authenticated');
create policy "visit-photos auth delete" on storage.objects
  for delete using (bucket_id = 'visit-photos' and auth.role() = 'authenticated');

-- ---- wine-photos (public read, authenticated write) ----
drop policy if exists "wine-photos public read"  on storage.objects;
drop policy if exists "wine-photos auth insert"   on storage.objects;
drop policy if exists "wine-photos auth update"   on storage.objects;
drop policy if exists "wine-photos auth delete"   on storage.objects;
create policy "wine-photos public read" on storage.objects
  for select using (bucket_id = 'wine-photos');
create policy "wine-photos auth insert" on storage.objects
  for insert with check (bucket_id = 'wine-photos' and auth.role() = 'authenticated');
create policy "wine-photos auth update" on storage.objects
  for update using (bucket_id = 'wine-photos' and auth.role() = 'authenticated');
create policy "wine-photos auth delete" on storage.objects
  for delete using (bucket_id = 'wine-photos' and auth.role() = 'authenticated');

-- ---- feedback (private: authenticated insert + read) ----
drop policy if exists "feedback auth insert" on storage.objects;
drop policy if exists "feedback auth read"   on storage.objects;
create policy "feedback auth insert" on storage.objects
  for insert with check (bucket_id = 'feedback' and auth.role() = 'authenticated');
create policy "feedback auth read" on storage.objects
  for select using (bucket_id = 'feedback' and auth.role() = 'authenticated');
