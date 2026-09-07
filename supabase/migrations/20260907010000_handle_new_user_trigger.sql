-- Capture the auth→profile trigger as a tracked migration (launch plan §2.3).
--
-- public.handle_new_user() + on_auth_user_created have only ever existed in the
-- live database (created via the dashboard, never committed), so a restore from
-- migrations alone would produce a project where every signup succeeds in
-- auth.users but silently creates NO public.users row — the app would then show
-- a signed-in user with no profile. Committed here verbatim, with two safety
-- improvements over the live definition:
--
--   1. `set search_path = public` — the live version is SECURITY DEFINER with a
--      mutable search_path (Supabase linter: function_search_path_mutable).
--      Behaviour is unchanged: every object it touches is already schema-qualified.
--   2. `on conflict (id) do nothing` — previously a pre-existing profile row would
--      abort the INSERT and fail the whole signup; now signup is idempotent.
--
-- Verified against production after applying: a fresh signup still auto-creates
-- its public.users row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, created_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      'User'
    ),
    new.created_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Idempotent re-create so the trigger is guaranteed present on a fresh project.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
