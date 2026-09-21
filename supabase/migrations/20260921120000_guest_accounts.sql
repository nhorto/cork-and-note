-- Guest accounts (epic #316, App Review 5.1.1).
--
-- Guests are Supabase anonymous users: a real auth.users row with no email and
-- is_anonymous = true. Every existing RLS policy is `to authenticated`, and an
-- anonymous user IS authenticated, so nothing else in the schema changes.
--
-- 1. public.users.email was NOT NULL and handle_new_user() inserts new.email
--    verbatim. For an anonymous user that is null, the trigger fails, and
--    Supabase rolls the whole sign-in back ("Database error saving new user").
--    Nullable is the honest shape: the row exists from first launch and gets
--    its email when the guest links an account.
alter table public.users alter column email drop not null;

-- The trigger fires on INSERT only. When a guest links an email via
-- auth.updateUser, keep public.users in step so the app (and the owner
-- looking at the table) sees the address without a second write path.
create or replace function public.handle_user_email_linked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users
       set email = new.email,
           name = coalesce(
             nullif(new.raw_user_meta_data->>'name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''),
             name
           )
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_linked on auth.users;
create trigger on_auth_user_email_linked
  after update of email on auth.users
  for each row execute function public.handle_user_email_linked();

-- 2. Guest merge. Signing UP from a guest session links the same user id, so
--    nothing moves. Signing IN to an EXISTING account from a guest session is
--    the case that needs a merge: the guest's rows must follow them into that
--    account. The caller proves it held the guest session with a one-shot
--    token minted while still a guest (stamp_guest_claim), then redeems it
--    from the real session (merge_guest_account). Nobody can claim a guest
--    they never were.
create table if not exists public.guest_claims (
  guest_id uuid primary key references auth.users (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.guest_claims enable row level security;
-- No policies on purpose: rows are only touched through the two RPCs below.
revoke all on public.guest_claims from anon, authenticated;

create or replace function public.stamp_guest_claim()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is not true then
    raise exception 'only a guest session can stamp a claim';
  end if;
  insert into public.guest_claims (guest_id)
  values (auth.uid())
  on conflict (guest_id) do update
    set token = gen_random_uuid(), created_at = now()
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.merge_guest_account(p_guest_id uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := auth.uid();
  v_moved jsonb := '{}'::jsonb;
  v_count int;
  v_table text;
begin
  if v_target is null then
    raise exception 'not signed in';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'sign in to a real account before merging';
  end if;
  if v_target = p_guest_id then
    raise exception 'guest and target are the same user';
  end if;

  -- The claim must exist, match, be fresh, and point at a still-anonymous user.
  if not exists (
    select 1 from public.guest_claims c
      join auth.users u on u.id = c.guest_id
     where c.guest_id = p_guest_id
       and c.token = p_token
       and c.created_at > now() - interval '1 hour'
       and u.is_anonymous
  ) then
    raise exception 'invalid or expired guest claim';
  end if;

  -- Unique (user_id, winery_id) on these two: drop the guest's duplicates of
  -- rows the target already has, then move the rest.
  delete from public.favorites g
   where g.user_id = p_guest_id
     and exists (select 1 from public.favorites t where t.user_id = v_target and t.winery_id = g.winery_id);
  delete from public.wishlist g
   where g.user_id = p_guest_id
     and exists (select 1 from public.wishlist t where t.user_id = v_target and t.winery_id = g.winery_id);

  -- Content tables. Quota tables (chat_usage, places_usage) and entitlements
  -- are deliberately NOT moved: a guest's meter must not top up an account's,
  -- and entitlements are keyed by user_id (RevenueCat re-identifies the
  -- purchaser on the real id via the app, and the webhook rewrites the row).
  foreach v_table in array array[
    'ai_response_reports', 'bug_reports', 'cellar_bottles', 'cellar_consumptions',
    'contact_messages', 'conversations', 'favorites', 'feedback', 'taste_reports',
    'trip_plans', 'user_achievements', 'visits', 'wine_list_sessions', 'wineries',
    'winery_reports', 'wishlist'
  ] loop
    execute format('update public.%I set user_id = $1 where user_id = $2', v_table)
      using v_target, p_guest_id;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      v_moved := v_moved || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  -- Photos the guest uploaded: the buckets are owner-scoped for delete/update,
  -- so re-own the objects or the merged account could never remove them.
  update storage.objects
     set owner = v_target, owner_id = v_target::text
   where owner = p_guest_id;

  delete from public.guest_claims where guest_id = p_guest_id;
  -- Everything the guest had is now the target's; drop the empty guest user.
  -- public.users cascades from auth.users via the app's FK.
  delete from public.users where id = p_guest_id;
  delete from auth.users where id = p_guest_id;

  return v_moved;
end;
$$;

revoke all on function public.stamp_guest_claim() from public;
revoke all on function public.merge_guest_account(uuid, uuid) from public;
grant execute on function public.stamp_guest_claim() to authenticated;
grant execute on function public.merge_guest_account(uuid, uuid) to authenticated;
