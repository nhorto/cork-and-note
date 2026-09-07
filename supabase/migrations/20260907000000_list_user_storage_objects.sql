-- Helper for the delete-account Edge Function (#161, App Store 5.1.1(v)).
--
-- Storage objects are owner-scoped via storage.objects.owner_id, not by a
-- uniform path prefix (see 20260705000000_photo_buckets_owner_scoped.sql), so
-- the function needs a way to enumerate a user's objects before removing them
-- through the Storage API (which deletes the underlying files, unlike a raw
-- DELETE on storage.objects, which would orphan them in S3).
--
-- service_role only: the Edge Function passes the *verified* JWT user id, and
-- nothing else should be able to enumerate another user's files.

create or replace function public.list_user_storage_objects(p_user_id uuid)
returns table(bucket_id text, name text)
language sql
security definer
set search_path = public, storage
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.owner_id = p_user_id::text
    and o.bucket_id in ('visit-photos', 'wine-photos', 'chat-photos');
$$;

revoke execute on function public.list_user_storage_objects(uuid) from public;
revoke execute on function public.list_user_storage_objects(uuid) from anon;
revoke execute on function public.list_user_storage_objects(uuid) from authenticated;
grant execute on function public.list_user_storage_objects(uuid) to service_role;
