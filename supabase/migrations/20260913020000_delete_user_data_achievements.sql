-- Account deletion must clear the badges table too (#295).
--
-- Same definition as 20260705020000_fix_delete_user_data.sql with one added
-- delete for public.user_achievements. Kept as a whole function body rather
-- than an ALTER because plpgsql functions are replaced wholesale; the offline
-- test __tests__/accountDeletion.test.js reads the newest definition in this
-- directory and checks every user-scoped table is covered. Idempotent.

create or replace function public.delete_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'delete_user_data: not authenticated';
  end if;

  -- Logging hierarchy (wines + wine_flavor_notes removed via ON DELETE CASCADE)
  delete from public.visits            v  where v.user_id  = v_user_id;

  -- Cellar (cellar_consumptions removed via ON DELETE CASCADE; delete any
  -- consumption rows pointing at other data explicitly for completeness)
  delete from public.cellar_consumptions c where c.user_id = v_user_id;
  delete from public.cellar_bottles    b  where b.user_id  = v_user_id;

  -- Badges (#295): earned rows are the user's, so they go with the account.
  delete from public.user_achievements a  where a.user_id  = v_user_id;

  -- Sommelier chat (messages removed via ON DELETE CASCADE)
  delete from public.conversations     cv where cv.user_id = v_user_id;
  delete from public.chat_usage        cu where cu.user_id = v_user_id;

  -- Lists & feedback
  delete from public.wishlist          w  where w.user_id  = v_user_id;
  delete from public.favorites         f  where f.user_id  = v_user_id;
  delete from public.feedback          fb where fb.user_id = v_user_id;
  delete from public.bug_reports       br where br.user_id = v_user_id;
  delete from public.contact_messages  cm where cm.user_id = v_user_id;

  -- Profile row last (auth.users deletion happens separately via the Auth API)
  delete from public.users             u  where u.id       = v_user_id;
end;
$$;

grant execute on function public.delete_user_data() to authenticated;
