-- Make the chat-photos bucket private + owner-scoped (Issue #29 / audit finding #1).
-- Previously the bucket was public=true with a "view anyone" SELECT policy, so any
-- chat/wine photo was world-readable by URL. After this, photos are private and
-- served via short-lived signed URLs (see lib/chat.js getSignedUrls + ChatBubble).
-- Filenames are `chat_{user_id}_{timestamp}_{rand}.jpg`; UUIDs contain no '_', so
-- (string_to_array(name,'_'))[2] reliably yields the owner's full user id.
-- Idempotent / safe to re-run.

-- 1. Flip the bucket to private (no public read).
update storage.buckets set public = false where id = 'chat-photos';

-- 2. SELECT: owner-only (replaces the fully-public "Anyone can view chat photos").
drop policy if exists "Anyone can view chat photos" on storage.objects;
drop policy if exists "Users can view own chat photos" on storage.objects;
create policy "Users can view own chat photos"
  on storage.objects for select
  using (
    bucket_id = 'chat-photos'
    and auth.role() = 'authenticated'
    and (string_to_array(name, '_'))[2] = auth.uid()::text
  );

-- 3. INSERT: also assert the file is named with the uploader's own id (closes the
--    residual gap noted in the audit — previously any authed user could upload a
--    file named with another user's id).
drop policy if exists "Authenticated users can upload chat photos" on storage.objects;
create policy "Authenticated users can upload chat photos"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-photos'
    and auth.role() = 'authenticated'
    and (string_to_array(name, '_'))[2] = auth.uid()::text
  );

-- (DELETE policy "Users can delete own chat photos" already owner-scoped via 20260221 — left as-is.)
