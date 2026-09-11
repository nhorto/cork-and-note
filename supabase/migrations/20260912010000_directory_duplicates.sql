-- Flag near-duplicate winery_directory rows (#271, epic #268).
--
-- The Overture seed carried the same winery more than once under the same
-- name at slightly different coordinates (Janemark Winery & Vineyard twice,
-- 2.2 km apart, which is why the map showed two pins). The seed's dedupe was
-- exact name + exact coordinates, so these slipped through.
--
-- Rule (Nick, 2026-09-11): rows with the same normalised name in the same
-- state within 3 km are one winery. Keep one row per cluster, preferring a
-- Google-confirmed open row, then one with a website, then an address, then
-- the lowest id; never keep a permanently closed row over an open one. The
-- rest are FLAGGED, not deleted: operating_status = 'duplicate' with
-- duplicate_of pointing at the kept row, so the decision is reversible and
-- the loader's re-ingest keeps working. Client discovery queries hide
-- 'duplicate' the same way they hide 'permanently_closed'.
--
-- Users' saved wineries linked to a flagged row are re-pointed at the kept
-- row so the map keeps hiding the twin. The Google validation pass (#273)
-- will catch the remaining duplicates that carry different names.
--
-- Dry run reviewed on production 2026-09-11: 342 rows flagged, spot-check in
-- docs/audits/directory-duplicates-2026-09-11.csv. Idempotent / safe to re-run.

-- ── Schema ────────────────────────────────────────────────────────────────

alter table public.winery_directory
  add column if not exists duplicate_of bigint
    references public.winery_directory (id) on delete set null;

alter table public.winery_directory
  drop constraint if exists winery_directory_operating_status_check;
alter table public.winery_directory
  add constraint winery_directory_operating_status_check
  check (
    operating_status is null
    or operating_status in
      ('open', 'temporarily_closed', 'permanently_closed', 'possibly_closed', 'duplicate')
  );

-- ── Flag ──────────────────────────────────────────────────────────────────

create temp table dedupe_pairs as
with keyed as (
  select id, state, latitude, longitude, website, address, operating_status,
         regexp_replace(regexp_replace(lower(name), '^the\s+', ''), '[^a-z0-9]', '', 'g') as key
  from public.winery_directory
  where operating_status is distinct from 'duplicate'
),
best as (
  select distinct on (a.id)
    a.id,
    b.id as keep_id
  from keyed a
  join keyed b
    on a.key = b.key
   and a.state is not distinct from b.state
   and abs(a.latitude - b.latitude) < 0.03
   and abs(a.longitude - b.longitude) < 0.04
   and 111.0 * sqrt(
         power(a.latitude - b.latitude, 2)
         + power((a.longitude - b.longitude) * cos(radians(a.latitude)), 2)
       ) < 3
  order by a.id,
           (b.operating_status = 'permanently_closed') asc,
           (b.operating_status = 'open') desc,
           (b.website is not null) desc,
           (b.address is not null) desc,
           b.id asc
)
select id, keep_id from best where id <> keep_id;

update public.winery_directory d
   set operating_status = 'duplicate',
       duplicate_of = p.keep_id,
       updated_at = now()
  from dedupe_pairs p
 where d.id = p.id;

-- Saved wineries follow the kept row.
update public.wineries w
   set directory_id = p.keep_id
  from dedupe_pairs p
 where w.directory_id = p.id;

drop table dedupe_pairs;
