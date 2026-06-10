-- Cascade hardening for the logging hierarchy (Epic #5 / #42) — defense-in-depth.
--
-- The app code (lib/visits.js: deleteVisit, removeWine) already performs explicit,
-- ordered deletes of dependent rows. This migration adds ON DELETE CASCADE to the
-- two foreign keys so the database stays consistent even if a row is ever deleted
-- outside that code path:
--   1. wines.visit_id            → visits.id            (delete a session → its wines)
--   2. wine_flavor_notes.wine_id → wines.id             (delete a wine → its flavor links)
--
-- These base tables predate the migration files (they were created in the Supabase
-- dashboard), so the FK constraint names aren't known with certainty here. Each block
-- below looks the constraint up by (table, column) via the catalog, drops it, and
-- re-adds it WITH ON DELETE CASCADE. Idempotent / safe to re-run: if the constraint
-- is already ON DELETE CASCADE we still just re-create it identically.
--
-- NOTE: this file is committed but intentionally NOT applied to any database yet.

-- 1. wines.visit_id → visits.id  (ON DELETE CASCADE)
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel        on rel.oid = con.conrelid
  join pg_namespace nsp    on nsp.oid = rel.relnamespace
  join pg_attribute att    on att.attrelid = con.conrelid
                          and att.attnum = any (con.conkey)
  where con.contype = 'f'
    and nsp.nspname = 'public'
    and rel.relname = 'wines'
    and att.attname = 'visit_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.wines drop constraint %I', fk_name);
  end if;

  alter table public.wines
    add constraint wines_visit_id_fkey
    foreign key (visit_id) references public.visits (id) on delete cascade;
end $$;

-- 2. wine_flavor_notes.wine_id → wines.id  (ON DELETE CASCADE)
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel        on rel.oid = con.conrelid
  join pg_namespace nsp    on nsp.oid = rel.relnamespace
  join pg_attribute att    on att.attrelid = con.conrelid
                          and att.attnum = any (con.conkey)
  where con.contype = 'f'
    and nsp.nspname = 'public'
    and rel.relname = 'wine_flavor_notes'
    and att.attname = 'wine_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.wine_flavor_notes drop constraint %I', fk_name);
  end if;

  alter table public.wine_flavor_notes
    add constraint wine_flavor_notes_wine_id_fkey
    foreign key (wine_id) references public.wines (id) on delete cascade;
end $$;
