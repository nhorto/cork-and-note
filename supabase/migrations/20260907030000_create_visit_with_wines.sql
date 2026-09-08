-- Atomic visit creation (launch plan §2.3, the createVisit half).
--
-- lib/visits.js used to write a tasting across N+ round trips: INSERT the
-- visit, then INSERT each wine, then link each wine's flavor notes. Every gap
-- between them is a chance to be interrupted — and the app is used in tasting
-- rooms, where signal drops mid-save constantly. The result was a "ghost"
-- visit: a logged session with some or none of its wines, which the user then
-- had to notice and clean up by hand.
--
-- This does the whole write in one function, so it is one transaction: either
-- the visit and every wine land, or nothing does.
--
-- Two deliberate choices:
--   * SECURITY INVOKER (the default, stated explicitly). RLS still applies and
--     user_id is taken from auth.uid(), never from the payload, so this grants
--     no ability the client didn't already have.
--   * Flavor notes are BEST EFFORT. Each note is linked inside its own
--     BEGIN/EXCEPTION block, which is a plpgsql subtransaction — a failure
--     rolls back that one note and increments a counter instead of destroying
--     the whole tasting. This preserves today's UX (the caller warns about
--     dropped notes) rather than losing a session over a catalog hiccup.
--
-- Photos are NOT part of the transaction: object storage isn't transactional,
-- so the client uploads first and passes the resulting URLs in, exactly as
-- before.

create or replace function public.create_visit_with_wines(
  p_visit jsonb,
  p_wines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_visit_id     uuid;
  v_wine         jsonb;
  v_wine_id      uuid;
  v_note         text;
  v_note_id      uuid;
  v_notes_failed int := 0;
begin
  if v_user_id is null then
    raise exception 'create_visit_with_wines: not authenticated';
  end if;

  insert into public.visits (
    user_id, winery_id, place_type, place_name,
    latitude, longitude, visit_date, notes, photo_url
  )
  values (
    v_user_id,
    nullif(p_visit->>'winery_id', '')::bigint,
    nullif(p_visit->>'place_type', ''),
    nullif(p_visit->>'place_name', ''),
    nullif(p_visit->>'latitude', '')::numeric,
    nullif(p_visit->>'longitude', '')::numeric,
    (p_visit->>'visit_date')::date,
    nullif(p_visit->>'notes', ''),
    p_visit->>'photo_url'
  )
  returning id into v_visit_id;

  for v_wine in
    select value from jsonb_array_elements(coalesce(p_wines, '[]'::jsonb))
  loop
    insert into public.wines (
      visit_id, winemaker, wine_name, wine_type, wine_varietal, wine_year,
      overall_rating, sweetness, tannin, acidity, body, alcohol,
      additional_notes, photo_url
    )
    values (
      v_visit_id,
      nullif(v_wine->>'winemaker', ''),
      nullif(v_wine->>'wine_name', ''),
      nullif(v_wine->>'wine_type', ''),
      case
        when jsonb_typeof(v_wine->'wine_varietal') = 'array'
        then array(select jsonb_array_elements_text(v_wine->'wine_varietal'))
        else null
      end,
      nullif(v_wine->>'wine_year', ''),
      coalesce(nullif(v_wine->>'overall_rating', '')::numeric, 0),
      coalesce(nullif(v_wine->>'sweetness', '')::numeric, 0),
      coalesce(nullif(v_wine->>'tannin', '')::numeric, 0),
      coalesce(nullif(v_wine->>'acidity', '')::numeric, 0),
      coalesce(nullif(v_wine->>'body', '')::numeric, 0),
      coalesce(nullif(v_wine->>'alcohol', '')::numeric, 0),
      nullif(v_wine->>'additional_notes', ''),
      v_wine->>'photo_url'
    )
    returning id into v_wine_id;

    if jsonb_typeof(v_wine->'flavor_notes') = 'array' then
      for v_note in
        select jsonb_array_elements_text(v_wine->'flavor_notes')
      loop
        begin
          -- Custom notes join the shared catalog; `name` is UNIQUE, so a
          -- concurrent add is a no-op rather than an error.
          insert into public.flavor_notes (name, category)
          values (v_note, 'Custom')
          on conflict (name) do nothing;

          select id into v_note_id from public.flavor_notes where name = v_note;

          if v_note_id is null then
            v_notes_failed := v_notes_failed + 1;
          else
            insert into public.wine_flavor_notes (wine_id, flavor_note_id)
            values (v_wine_id, v_note_id)
            on conflict (wine_id, flavor_note_id) do nothing;
          end if;
        exception
          when others then
            v_notes_failed := v_notes_failed + 1;
        end;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('visit_id', v_visit_id, 'notes_failed', v_notes_failed);
end;
$$;

grant execute on function public.create_visit_with_wines(jsonb, jsonb) to authenticated;
