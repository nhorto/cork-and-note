# Logging Data Model & Migration (Hybrid)

**Repo:** `nhorto/cork-and-note` · **Issue:** #19 · coordinates with #24 (Cellar schema)
**Date:** 2026-06-08
**Status:** PROPOSAL for owner review. No migration applied yet (plan-before-code).

Builds on [`logging-experience-decisions.md`](logging-experience-decisions.md) and [`logging-flow.md`](logging-flow.md).

---

## Strategy: generalize "visit" into a "session", don't rename the table

Today's `visits` table already groups multiple wines by place + date. We **keep the table name `visits`** (to avoid churning every reference) but generalize its meaning to a **logging session** whose place is optional. Every wine still belongs to a session — a single-wine log is just a session with one wine. This gives the hybrid A/B model with minimal disruption.

> Renaming `visits` → `sessions` is deferred as optional cleanup; semantically "a visit" now means "a logging session."

---

## Changes

### `visits` (now a logging session)
| Change | Column | Notes |
|---|---|---|
| **Make nullable** | `winery_id bigint` (drop NOT NULL) | A session may have no winery. |
| Add | `place_type text` | `'winery' \| 'restaurant' \| 'other' \| null` |
| Add | `place_name text` | free text (e.g. restaurant name); for winery sessions, mirror the winery name |
| Add | `latitude decimal(10,6)` | dropped/selected pin |
| Add | `longitude decimal(10,6)` | dropped/selected pin |

`visit_date` stays. For a winery session, `winery_id` is set and the pin comes from the winery; for restaurant/other, `place_name`/pin are used directly.

### `wines`
| Change | Column | Notes |
|---|---|---|
| Add | `winemaker text` | per-wine producer — required at app level (a restaurant session can mix makers). Pre-filled from the winery when the session is a known winery. |
| Ensure | `wine_varietal text` | already used by code; **add to the committed schema** (doc drift) and treat as required at app level |
| **Relax NOT NULL** | `wine_type`, `overall_rating` | optional per Decision 1 (code already defaults rating to 0) |
| Keep | `visit_id` (the session) | every wine belongs to a session |

> Enforce "winemaker + varietal required" at the **app layer** first (and optionally add DB `NOT NULL` after backfilling existing rows).

### Unchanged
- `flavor_notes`, `wine_flavor_notes` junction — no change.
- RLS — new columns inherit the existing `auth.uid() = user_id` policies; no policy changes needed for added columns on existing tables.

---

## Migration (existing data is all winery-bound today)

```sql
-- 1. Loosen the winery requirement on sessions
alter table public.visits  alter column winery_id drop not null;

-- 2. Add session place fields
alter table public.visits  add column place_type text
  check (place_type in ('winery','restaurant','other'));
alter table public.visits  add column place_name text;
alter table public.visits  add column latitude  decimal(10,6);
alter table public.visits  add column longitude decimal(10,6);

-- 3. Add per-wine winemaker (+ formalize varietal if missing)
alter table public.wines   add column winemaker text;
-- alter table public.wines add column wine_varietal text;  -- only if not already present in live DB

-- 4. Relax wine NOT NULLs to match "only winemaker + varietal required"
alter table public.wines   alter column wine_type      drop not null;
alter table public.wines   alter column overall_rating drop not null;

-- 5. Backfill existing rows (all current sessions are winery visits)
update public.visits v
   set place_type = 'winery',
       place_name = w.name,
       latitude   = w.latitude,
       longitude  = w.longitude
  from public.wineries w
 where v.winery_id = w.id
   and v.place_type is null;

update public.wines wi
   set winemaker = w.name
  from public.visits v
  join public.wineries w on v.winery_id = w.id
 where wi.visit_id = v.id
   and wi.winemaker is null;
```

No existing data is lost — every current visit becomes a `place_type='winery'` session, and every wine inherits its winery as the winemaker.

---

## Coordination with the Wine Cellar (#24)

The Cellar's "open a bottle → log a tasting" needs a tasting with no winery visit. With this model, **opening a bottle creates a one-wine session** with `place_type = null` (or `'other'`), and `cellar_consumptions.wine_id` points at that wine ([`docs/research/wine-cellar.md`](../research/wine-cellar.md) §3.4). So this single migration serves both epics — design and ship it once.

> Alternative considered: make `wines.visit_id` nullable so cellar tastings need no session. Rejected for now to keep **one consistent rule** (every wine lives in a session); revisit if auto-creating sessions feels heavy.

---

## Open questions for the owner
1. OK to **keep the table named `visits`** (semantics = session), or do you want a rename to `sessions` now (more churn)?
2. Enforce `winemaker`/`varietal` required at the **DB level** (NOT NULL after backfill) or **app level only**?
3. For cellar tastings, auto-create a session (recommended) vs. allow `visit_id` null?
