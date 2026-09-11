-- Link a user's winery to the directory row it came from (#270, #272, epic #268).
--
-- Until now the only thing tying a saved winery to its winery_directory twin
-- was a 150 m distance check on the map, which showed Apple Works (167 m) and
-- Chisolm (194 m) twice, and the directoryId route param, which survived one
-- navigation. With the map no longer creating a wineries row on tap (preview
-- pages), the rows that do get created come from an explicit action and can
-- carry the link.
--
-- Also backfills the link for existing rows, conservatively:
--   pass 1: the nearest directory row within 20 m (promoted rows sit exactly
--           on the directory point);
--   pass 2: the nearest directory row within 300 m whose name shares the
--           first four letters (ignoring punctuation and a leading "the"),
--           which links hand-typed pins like "Hark" / "Hark Vineyards" and
--           "Prince Michel Vinyard and Winery" / "Prince Michel Vineyard &
--           Winery" without touching genuine neighbours.
-- Reviewed against production on 2026-09-11: every candidate match was correct.
--
-- Idempotent / safe to re-run.

alter table public.wineries
  add column if not exists directory_id bigint
    references public.winery_directory (id) on delete set null;

create index if not exists wineries_directory_id_idx
  on public.wineries (directory_id)
  where directory_id is not null;

-- ── Backfill ──────────────────────────────────────────────────────────────

with nearest as (
  select distinct on (w.id)
    w.id as winery_id,
    d.id as directory_id,
    1000 * 111.0 * sqrt(
      power(w.latitude - d.latitude, 2)
      + power((w.longitude - d.longitude) * cos(radians(w.latitude)), 2)
    ) as metres,
    left(regexp_replace(regexp_replace(lower(w.name), '^the\s+', ''), '[^a-z0-9]', '', 'g'), 4) as w_key,
    left(regexp_replace(regexp_replace(lower(d.name), '^the\s+', ''), '[^a-z0-9]', '', 'g'), 4) as d_key
  from public.wineries w
  join public.winery_directory d
    on abs(w.latitude - d.latitude) < 0.003
   and abs(w.longitude - d.longitude) < 0.004
  where w.directory_id is null
    and w.latitude is not null
    and w.longitude is not null
  order by w.id, metres
)
update public.wineries w
   set directory_id = n.directory_id
  from nearest n
 where w.id = n.winery_id
   and (n.metres < 20 or (n.metres < 300 and n.w_key = n.d_key and length(n.w_key) = 4));
