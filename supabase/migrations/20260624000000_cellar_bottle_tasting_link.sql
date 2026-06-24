-- Link a cellar bottle to a prior tasting (#140).
--
-- Adds a nullable cellar_bottles.tasting_wine_id pointing at the tasted wine
-- (public.wines) the bottle corresponds to. Set automatically when adding a
-- bottle that confidently matches an existing tasting, or manually from the
-- bottle detail screen. ON DELETE SET NULL so deleting the tasting just clears
-- the link (the bottle stays). Mirrors cellar_consumptions.wine_id, which links
-- the OTHER direction (a tasting auto-created when a bottle is opened).
--
-- This is ADDITIVE and NULLABLE, so it is safe for older installed builds:
-- they `select *` and simply ignore the extra column, and their writes use a
-- field whitelist that doesn't include it. (Unlike the wine_varietal text→text[]
-- change, this does not break old builds.) Still applied alongside the
-- array-aware build so the whole tasting-link feature lands together.

ALTER TABLE public.cellar_bottles
  ADD COLUMN IF NOT EXISTS tasting_wine_id uuid
    REFERENCES public.wines (id) ON DELETE SET NULL;

-- Owner-scoped lookups by the linked tasting (e.g. "is this wine in my cellar?").
CREATE INDEX IF NOT EXISTS cellar_bottles_tasting_wine_id_idx
  ON public.cellar_bottles (tasting_wine_id);
