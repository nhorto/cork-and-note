# Wine Cellar Schema + Unified Migration

**Repo:** `nhorto/cork-and-note` · **Issue:** #24 · unifies with #19 (logging schema)
**Date:** 2026-06-08
**Status:** PROPOSAL for owner review. No migration applied yet (plan-before-code).

Builds on [`../research/wine-cellar.md`](../research/wine-cellar.md) (research) and [`logging-schema.md`](logging-schema.md) (logging changes). **This doc presents the single migration that serves BOTH the logging redesign and the cellar — design and apply once.**

---

## 1. Cellar model (final)

Lot-based inventory (a row = a lot: wine + vintage + size at a location with a quantity), per the research. Conceptual split: **Wishlist = want · Cellar = own · Wines = tasted.**

Two new tables:
- **`cellar_bottles`** — what you own (the lots).
- **`cellar_consumptions`** — the audit log of opening/removing bottles, with an optional link to a tasting in `wines`.

---

## 2. How the cellar connects to logging

The Cellar's marquee integration — **"open a bottle → log a tasting"** — relies on the logging redesign:

1. Decrement the lot (`cellar_bottles.quantity -= 1`; at 0, `status = 'consumed'`).
2. Insert a `cellar_consumptions` row (date, reason, qty, optional note).
3. *Optionally* log a tasting: **auto-create a one-wine session** (`visits` row with `place_type = null`), insert a `wines` row prefilled from the bottle (winemaker, varietal, type, year), and store that `wines.id` on `cellar_consumptions.wine_id`.

This is why the schemas must ship together: the cellar's "tasting with no winery" **is** the location-optional logging from #17–#19.

---

## 3. THE unified migration (logging + cellar)

> Target file at implementation: `supabase/migrations/<timestamp>_logging_optional_location_and_cellar.sql`. Ordered so logging changes land before cellar tables that reference them.

```sql
-- ============================================================
-- PART A — Logging: make location optional (Epic #5 / #19)
-- ============================================================

-- A1. A "visit" becomes a logging SESSION; winery no longer required
alter table public.visits  alter column winery_id drop not null;
alter table public.visits  add column place_type text
  check (place_type in ('winery','restaurant','other'));
alter table public.visits  add column place_name text;
alter table public.visits  add column latitude   decimal(10,6);
alter table public.visits  add column longitude  decimal(10,6);

-- A2. Per-wine winemaker; relax the over-strict NOT NULLs
alter table public.wines   add column winemaker text;
alter table public.wines   alter column wine_type      drop not null;
alter table public.wines   alter column overall_rating drop not null;
-- (wine_varietal already exists in the live DB; ensure it's present)

-- A3. Backfill existing rows (today everything is a winery visit)
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

-- ============================================================
-- PART B — Cellar: bottle inventory (Epic #6 / #23 / #24)
-- ============================================================

create type public.cellar_status as enum
  ('in_cellar','consumed','gifted','sold','spoiled');

create table public.cellar_bottles (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,

  -- wine identity (optional FK to a known winery; free-text producer otherwise)
  winery_id     bigint references public.wineries,
  producer      text,
  wine_name     text not null,
  vintage       text,
  wine_type     text,
  varietal      text,
  region        text,

  -- lot / physical
  quantity      integer not null default 1 check (quantity >= 0),
  bottle_size   text not null default '750ml',
  location      text,
  bin           text,

  -- purchase
  purchase_date  date,
  purchase_price numeric(10,2),
  currency       text default 'USD',
  store          text,
  current_value  numeric(10,2),

  -- drinking window
  drink_from    integer,
  drink_by      integer,

  -- personal
  rating        decimal(3,1),
  notes         text,

  status        public.cellar_status not null default 'in_cellar',
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);
create index cellar_bottles_user_idx   on public.cellar_bottles (user_id);
create index cellar_bottles_status_idx on public.cellar_bottles (user_id, status);

create table public.cellar_consumptions (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,
  bottle_id     uuid references public.cellar_bottles not null,
  consumed_date date not null default current_date,
  reason        public.cellar_status not null default 'consumed',
  quantity      integer not null default 1 check (quantity > 0),
  note          text,
  wine_id       uuid references public.wines,   -- optional: the tasting logged on open
  created_at    timestamp with time zone default now() not null
);
create index cellar_consumptions_bottle_idx on public.cellar_consumptions (bottle_id);

-- ============================================================
-- PART C — RLS for the new cellar tables (existing pattern)
-- ============================================================
alter table public.cellar_bottles      enable row level security;
alter table public.cellar_consumptions enable row level security;

create policy "own cellar select" on public.cellar_bottles for select using (auth.uid() = user_id);
create policy "own cellar insert" on public.cellar_bottles for insert with check (auth.uid() = user_id);
create policy "own cellar update" on public.cellar_bottles for update using (auth.uid() = user_id);
create policy "own cellar delete" on public.cellar_bottles for delete using (auth.uid() = user_id);

create policy "own consumption select" on public.cellar_consumptions for select using (auth.uid() = user_id);
create policy "own consumption insert" on public.cellar_consumptions for insert with check (auth.uid() = user_id);
create policy "own consumption delete" on public.cellar_consumptions for delete using (auth.uid() = user_id);
```

> **Note:** Parts A and B are independent at the SQL level (B doesn't reference A's new columns), but they're bundled because the *app behavior* — "open bottle → log tasting" — needs both. If you'd rather ship in two migrations, A and B can split cleanly; keep them in one PR either way.

---

## 4. Derived drink-window status (no stored column)

Compute in the app / a view from `drink_from`/`drink_by` vs. the current year → `too_young` / `ready` / `drink_up` / `past_peak`. Powers a "Ready to Drink" list (the highest-value cellar feature per the research).

---

## 5. Phasing
- **v1:** the migration above; add/edit/delete lots; "open bottle" decrement + optional tasting link (auto-session); derived drink-window status.
- **v2:** bin/slot granularity, store/source, `current_value` automation (pricing), per-bottle barcodes (split lots into qty-1 rows), maturity alerts, collection-value summary.

---

## 6. Open items
- This **supersedes** designing #19 and #24 migrations separately — implement the unified migration once (covers both epics).
- Regenerate/replace the stale `DataBase Schema.txt` as part of implementation (it already drifted from the live DB).
- Confirm `uuid_generate_v4()` / `uuid-ossp` (or `gen_random_uuid()`) is the project's UUID default — match whatever the existing tables use.
