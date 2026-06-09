-- Core logging redesign — location-optional logging (Epic #5 / #19).
-- Generalizes a "visit" into a logging SESSION whose place is optional, and makes
-- the per-wine "winemaker" the required producer. Matches docs/design/logging-schema.md.
-- Idempotent + safe for existing data (15 visits / 20 wines, all winery-bound today).

-- 1. visits → logging session: winery no longer required, add place fields
alter table public.visits alter column winery_id drop not null;
alter table public.visits add column if not exists place_type text
  check (place_type in ('winery','restaurant','other'));
alter table public.visits add column if not exists place_name text;
alter table public.visits add column if not exists latitude  decimal(10,6);
alter table public.visits add column if not exists longitude decimal(10,6);

-- 2. wines: per-wine winemaker; relax over-strict NOT NULLs (only winemaker+varietal required at app level)
alter table public.wines add column if not exists winemaker text;
alter table public.wines alter column wine_type      drop not null;
alter table public.wines alter column overall_rating drop not null;

-- 3. Backfill existing rows (today every visit is a winery visit)
update public.visits v
   set place_type = 'winery',
       place_name = w.name,
       latitude   = w.latitude,
       longitude  = w.longitude
  from public.wineries w
 where v.winery_id = w.id and v.place_type is null;

update public.wines wi
   set winemaker = w.name
  from public.visits v
  join public.wineries w on v.winery_id = w.id
 where wi.visit_id = v.id and wi.winemaker is null;
