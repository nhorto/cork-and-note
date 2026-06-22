-- Multiple varietals per wine (#135).
--
-- wines.wine_varietal becomes text[] so a blend can list its component grapes.
-- Legacy single / comma-joined values are split into an array; empty/blank → NULL.
--
-- ⚠️ ROLLOUT ORDER MATTERS: apply this ONLY once the array-aware app build is the
-- one in use. Older installed builds read wine_varietal as a string and will
-- break on an array (TestFlight = no OTA, so old builds linger). Ship the new
-- build first, then run this migration.
--
-- Scope: only the tasting-log table (wines). cellar_bottles.varietal stays a
-- single text column for now (a separate follow-up).

ALTER TABLE public.wines
  ALTER COLUMN wine_varietal TYPE text[]
  USING CASE
    WHEN wine_varietal IS NULL OR btrim(wine_varietal) = '' THEN NULL
    ELSE string_to_array(wine_varietal, ', ')
  END;
