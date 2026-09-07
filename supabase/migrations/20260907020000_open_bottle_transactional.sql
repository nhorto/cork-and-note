-- Atomic bottle draw-down (launch plan §2.3, "transactional RPCs for
-- createVisit/openBottle").
--
-- lib/cellar.js openBottle() wrote the audit row and the inventory change as two
-- separate PostgREST calls:
--
--   1. insert into cellar_consumptions   (a bottle was drunk)
--   2. update cellar_bottles.quantity    (one fewer in the lot)
--
-- Two defects follow from that split:
--
--   * Partial write. If step 2 fails — dropped connection in a tasting-room
--     basement, which is exactly where this feature is used — the consumption
--     row survives with no matching decrement. The lot overstates what is left,
--     the history overstates what was drunk, and a retry inserts a SECOND
--     consumption row.
--   * Lost update. The quantity is read in JS and written back, so two opens
--     racing (a double tap, or two devices) both read 2, both write 1: two
--     bottles recorded, one decremented.
--
-- Both go away by doing the work in one statement-level transaction with the lot
-- row locked. PostgREST runs each RPC in its own transaction, so either both
-- rows change or neither does.
--
-- SECURITY INVOKER (the default) is deliberate: RLS still applies, so the
-- function can only ever touch the caller's own rows, and the explicit
-- user_id predicates below are belt-and-braces.

create or replace function public.open_bottle(
  p_bottle_id uuid,
  p_quantity integer default 1,
  p_reason text default 'consumed',
  p_note text default null,
  p_wine_id uuid default null,
  p_consumed_date date default null
)
returns public.cellar_bottles
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bottle  public.cellar_bottles;
  v_reason  public.cellar_status := p_reason::public.cellar_status;
  -- 'in_cellar' is the Coravin "tasted, kept the bottle" sample: it records a
  -- pour without drawing the lot down (see KEEP_BOTTLE_REASON in lib/cellar.js).
  v_keep    boolean := (v_reason = 'in_cellar');
  v_qty     integer;
  v_left    integer;
begin
  if v_user_id is null then
    raise exception 'open_bottle: not authenticated';
  end if;

  -- Lock the lot for the rest of the transaction; a concurrent open blocks here
  -- and then re-reads the decremented quantity instead of the stale one.
  select * into v_bottle
    from public.cellar_bottles
   where id = p_bottle_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'open_bottle: bottle not found';
  end if;

  v_qty := case when v_keep then 1 else greatest(1, coalesce(p_quantity, 1)) end;

  if v_keep then
    if v_bottle.quantity < 1 then
      raise exception 'No bottles left to taste from this lot';
    end if;
  elsif v_qty > v_bottle.quantity then
    raise exception 'Only % left in this lot', v_bottle.quantity;
  end if;

  insert into public.cellar_consumptions
    (user_id, bottle_id, consumed_date, reason, quantity, note, wine_id)
  values
    (v_user_id, p_bottle_id, coalesce(p_consumed_date, current_date),
     v_reason, v_qty, p_note, p_wine_id);

  if v_keep then
    -- Quantity and status are untouched; return the lot as it stands.
    return v_bottle;
  end if;

  v_left := v_bottle.quantity - v_qty;

  update public.cellar_bottles
     set quantity = v_left,
         -- An emptied lot retires with the reason it was emptied for.
         status = case when v_left <= 0 then v_reason else 'in_cellar'::public.cellar_status end
   where id = p_bottle_id
     and user_id = v_user_id
  returning * into v_bottle;

  return v_bottle;
end;
$$;

revoke execute on function public.open_bottle(uuid, integer, text, text, uuid, date) from public, anon;
grant execute on function public.open_bottle(uuid, integer, text, text, uuid, date) to authenticated;
