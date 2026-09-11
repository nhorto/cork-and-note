-- One-off cleanup (#270, epic #268): remove `wineries` rows that exist only
-- because someone TAPPED a discovery pin, Near You card, Find result or region
-- sheet row between 2026-09-09 (when tap-promotion shipped) and the build that
-- replaced it with preview pages.
--
-- A row is a tap orphan when ALL of these hold:
--   * created on or after 2026-09-09;
--   * nothing references it: no visit, wishlist entry, favourite, cellar
--     bottle or winery report;
--   * it carries the promotion signature: an address of the form "City, ST"
--     (createWinery from a dropped pin or manual entry leaves address null or
--     free text), or it sits within 20 m of a directory row.
--
-- Dropped pins and manually entered wineries are never matched by this.
-- Run via the Management API (see docs/research/map-feedback-diagnosis-2026-09-11.md
-- and the DB-migrations memory). Re-run after the preview build ships: older
-- installs keep promoting on tap until they update. Returns the deleted rows.

with orphans as (
  select w.id, w.name, w.user_id
  from public.wineries w
  where w.created_at >= '2026-09-09'
    and not exists (select 1 from public.visits v where v.winery_id = w.id)
    and not exists (select 1 from public.wishlist x where x.winery_id = w.id)
    and not exists (select 1 from public.favorites f where f.winery_id = w.id)
    and not exists (select 1 from public.cellar_bottles c where c.winery_id = w.id)
    and not exists (select 1 from public.winery_reports r where r.winery_id = w.id)
    and (
      w.address ~ ', [A-Z]{2}$'
      or exists (
        select 1 from public.winery_directory d
        where abs(w.latitude - d.latitude) < 0.0002
          and abs(w.longitude - d.longitude) < 0.0003
      )
    )
)
delete from public.wineries w
using orphans o
where w.id = o.id
returning w.id, w.name, w.user_id;
