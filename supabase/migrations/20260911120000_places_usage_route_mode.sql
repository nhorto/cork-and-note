-- places_usage.mode gains 'route' for the Google Routes proxy
-- (supabase/functions/routes), which meters into the same append-only table
-- as the Places proxy so one per-user burst window covers every Google call.
--
-- 20260909230000_places_enrichment.sql documented the allowed modes in a
-- comment only; this pins them as a real constraint (now including 'route')
-- so a typo in a function can never meter into an uncapped bucket.

alter table public.places_usage
  drop constraint if exists places_usage_mode_check;

alter table public.places_usage
  add constraint places_usage_mode_check
  check (mode in ('details', 'match', 'photo', 'route'));
