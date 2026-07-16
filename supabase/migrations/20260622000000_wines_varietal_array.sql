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
--
-- 2026-07-16: the rollout window above stayed open ~3 weeks (array-aware build
-- a874ce9 shipped 2026-06-24; this migration never ran), so the shipped app was
-- writing JS arrays into a still-text column. PostgREST does not reject that —
-- json_populate_record stores the raw JSON text — so four wines logged between
-- 06-27 and 07-11 hold values like '["Albariño"]' instead of 'Albariño'.
-- Step 1 below repairs them. It must run BEFORE the type change: string_to_array
-- would otherwise wrap the literal '["Albariño"]' into a one-element array and
-- preserve the corruption instead of fixing it.

-- Step 1 — repair rows the array-aware build wrote as JSON text.
-- Guarded to bracketed values; all matches verified valid JSON before running.
UPDATE public.wines
SET wine_varietal = (
  SELECT string_agg(value, ', ')
  FROM json_array_elements_text(wine_varietal::json)
)
WHERE wine_varietal LIKE '[%]';

-- Step 2 — widen to text[] so a blend can list its component grapes.
ALTER TABLE public.wines
  ALTER COLUMN wine_varietal TYPE text[]
  USING CASE
    WHEN wine_varietal IS NULL OR btrim(wine_varietal) = '' THEN NULL
    ELSE string_to_array(wine_varietal, ', ')
  END;
