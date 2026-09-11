-- Bulk validation bookkeeping (#273 Tier 1, epic #268).
--
-- scripts/validate-winery-directory.mjs checks directory rows against Google
-- Places a few hundred at a time (paced to stay inside the free monthly Pro
-- SKU allowance). validated_at records that a row was checked, including the
-- rows Google could not match (which keep operating_status null and no place
-- id), so a run never re-spends a call on a row it already looked at. A
-- quarterly refresh clears it for rows older than the cutoff.
--
-- Idempotent / safe to re-run.

alter table public.winery_directory
  add column if not exists validated_at timestamptz;

-- The selection query is "unvalidated first, by state priority, by id".
create index if not exists winery_directory_validated_at_idx
  on public.winery_directory (validated_at)
  where validated_at is null;

-- Why a checked row stayed unknown ("unmatched", "Some Place 13.3 km away"),
-- so a human pass can review the leftovers without re-spending calls.
alter table public.winery_directory
  add column if not exists validation_note text;
