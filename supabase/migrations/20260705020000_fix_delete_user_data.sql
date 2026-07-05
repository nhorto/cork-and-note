-- Fix + modernize public.delete_user_data() (July 2026 audit, major #5).
--
-- The previous version (see "DataBase Schema.txt", created via the SQL editor and
-- never committed as a migration) declared a variable named `user_id` — identical
-- to the column it filters on — so every `WHERE user_id = user_id` is ambiguous:
-- with the default plpgsql.variable_conflict = error the function always raises
-- ("column reference user_id is ambiguous"), and under `use_column` semantics the
-- predicate degenerates to col = col (always true), which inside SECURITY DEFINER
-- would have deleted EVERY user's data. It also predates the cellar and chat
-- tables. No app code calls it yet, but account deletion is an App Store
-- requirement, so it must be correct before it gets wired up.
--
-- Cascades relied on (already in place): visits → wines → wine_flavor_notes
-- (20260610000000_cascade_hardening.sql), cellar_bottles → cellar_consumptions,
-- conversations → messages. Idempotent / safe to re-run.

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
