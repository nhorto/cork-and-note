# Wine Cellar Feature — Data-Model Research & Schema Proposal

**Repo:** `nhorto/cork-and-note` · **Issue:** #23
**Status:** Research + proposal (no code/schema changes made). The "PROPOSAL" section is a recommendation for the team to decide on.
**Date:** 2026-06-08

## Purpose

cork-and-note is a React Native (Expo) + Supabase/Postgres wine app. Today it tracks **wineries you've visited** (`visits`), **wines you've tasted** (`wines`, hung off a visit), and **wineries you want to visit** (`wishlist`) plus `favorites`. This document researches how established wine-cellar/inventory apps model a **physical bottle inventory** ("what you own"), and proposes a Supabase schema to add a **Cellar** feature.

Conceptual model we're aiming for:

| Concept | Meaning | Today in cork-and-note |
|---|---|---|
| **Wishlist** | Want (aspirational) | `wishlist` table — but it tracks *wineries*, not wines |
| **Cellar** | Own (physical inventory) | **does not exist — this proposal** |
| **Wines** | Tasted (experience log) | `wines` table, tied to a `visit` |

> One nuance worth flagging up front: the existing `wishlist` is winery-level, whereas a Cellar is inherently **wine/bottle-level**. So "Wishlist = want, Cellar = own, Wines = tasted" is the right north star, but Cellar introduces a wine-level granularity the current schema doesn't yet have on the wishlist side.

---

## 1. Cross-App Comparison of the Inventory Data Model

I looked at the four most relevant consumer/prosumer cellar tools: **CellarTracker** (the de-facto standard for serious collectors), **Vivino** (mass-market, label-scan first), **InVintory** (premium, 3D-cellar/valuation focused), and **Wine-Searcher** (pricing/valuation focused).

### 1a. The core structural pattern

The most important finding is that the serious apps **do not model a cellar as a flat list of bottles**. CellarTracker — the reference implementation — uses a **three-level structure**, and the others are simplifications of it:

1. **Wine record** (the SKU / "what it is"): producer, wine name/designation, vintage, varietal, region/appellation, vineyard. Shared and de-duplicated across all users; professional reviews and community tasting notes attach here.
2. **Purchase** (the transaction / "how it came in"): store/source, purchase date, price, currency, delivery date + delivery status (pending vs. delivered), purchase note.
3. **Bottle / lot** (the physical instance / "the thing in the rack"): size/format, quantity, storage location, bin, a per-bottle private note, a unique bottle ID (optionally a printed barcode), and consumption status/history.

So a single "lot" of, say, 6× 2019 Producer X is a wine record + a purchase + bottle instances. (CellarTracker source: ["What you can track"](https://support.cellartracker.com/article/32-what-can-be-tracked), ["Managing Purchases"](https://support.cellartracker.com/article/44-managing-purchases), ["How to add bottles"](https://support.cellartracker.com/article/82-how-to-add-bottles).)

### 1b. Field-by-field comparison

| Field | CellarTracker | Vivino Cellar | InVintory | Wine-Searcher |
|---|---|---|---|---|
| Producer / winery | Yes (wine record) | Yes (from scan) | Yes (from DB of 2M+) | Yes |
| Wine name / designation | Yes | Yes | Yes | Yes |
| Vintage | Yes | Yes | Yes | Yes |
| Varietal / grape | Yes | Yes | Yes | Yes |
| Region / appellation | Yes (+ vineyard) | Yes | Yes | Yes |
| Quantity | Yes | Yes | Yes | Yes (per name) |
| Bottle size / format | Yes (multiple formats) | Limited | Yes (750ml default; magnum, half, etc.) | Implicit |
| Storage location | Yes | No (virtual only) | Yes (cellar/rack/bin/case/custom; 3D VinLocate™) | No |
| Bin / specific spot | Yes (per-bottle bin) | No | Yes (specific spot notation) | No |
| Purchase date | Yes | No | Yes (purchase history) | No |
| Purchase price | Yes (+ currency) | No | Yes | No (focus is current value) |
| Store / source | Yes | No | Yes | No |
| Current value | Yes (personal/community/auction; paid) | Yes (estimated collection value; Premium) | Yes (real-time market price) | **Yes — core feature** (today's price, up to 500 wines) |
| Drinking window (from / to) | Yes ("My Drinking Window" + community dates) | Yes (Premium; "ready now" vs "save") | Yes (optimal window + maturity alerts) | No |
| Personal notes | Yes (per-wine private note + per-bottle note + consumption note) | Yes ("little notes") | Yes | No |
| Rating / score | Yes (personal + community) | Yes (community + your rating) | Yes | No |
| Pending/delivery status | Yes ("Pending Delivery" report) | No | No | No |

Sources: CellarTracker ([add bottles](https://support.cellartracker.com/article/82-how-to-add-bottles), [tracking](https://support.cellartracker.com/article/32-what-can-be-tracked)); Vivino ([Discover the Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature)); InVintory ([app](https://invintory.com/), [premium](https://invintory.com/premium), [bulk edit](https://help.invintory.com/en/articles/9892500-how-to-bulk-edit-bottles)); Wine-Searcher ([cellar/help](https://www.wine-searcher.com/help), [valuations](https://www.wine-searcher.com/trade/valuation)).

### 1c. Lots vs. individual bottles

- **CellarTracker** can operate in two display modes: **Individual Bottle mode** (exact per-bottle price, per-bottle location/bin/note, unique bottle IDs) and **Wines mode** (rolled up, using average cost across all historical purchases of that wine). The same wine can have many bottles, each with its own location and consumption history, while sharing the wine record. ([Managing Purchases](https://support.cellartracker.com/article/44-managing-purchases))
- **InVintory** lets you add a quantity per location and **bulk-edit** groups of bottles, but still resolves down to individual bottle instances so each can be located in the 3D cellar. ([bulk edit](https://help.invintory.com/en/articles/9892500-how-to-bulk-edit-bottles))
- **Vivino / Wine-Searcher** are essentially **quantity-per-wine** (a count against a wine), with little or no per-bottle identity — simpler, but you can't say "the magnum is in bin A3 and cost $90 while the three 750s cost $30 each."

**Takeaway:** the right design is **lot-based with a quantity**, where a lot = (wine + vintage + size + location + purchase price), and "individual bottle" is just a lot of quantity 1. This gives you 90% of CellarTracker's power without forcing per-bottle rows on casual users.

### 1d. "Opening / drinking" a bottle and its link to a tasting log

This is the most interesting cross-app behavior and the most relevant to cork-and-note:

- **CellarTracker** treats consumption as an explicit event with a **reason/type**: "Drank from my cellar," "Restaurant purchase," "Gave away as a gift," "Sold or traded," "Spoiled (corked/oxidized)," etc. Consuming a bottle decrements inventory and records a private **consumption note** (date, type, optional note, optional revenue if sold). Crucially, **tasting notes are a separate, public object** (date + score + note) and are **not tied to a consumed bottle** — you can add as many tastings as you want, and they attach to the *wine*, not the bottle. ([note types](https://support.cellartracker.com/article/50-public-and-private-note-types), [tasting notes](https://support.cellartracker.com/article/49-tasting-notes-and-ratings), [consume types](https://support.cellartracker.com/article/82-how-to-add-bottles))
- **Partial / Coravin pours:** CellarTracker explicitly does **not** decrement inventory for a Coravin pour — the bottle stays in the cellar and you log tastings against the wine and annotate the bottle note. So "tasted" ≠ "removed from inventory." ([Coravin tracking](https://support.cellartracker.com/article/27-coravin-bottle-tracking))
- **Vivino** keeps it casual: opening is just removing/decrementing from the virtual cellar, with notes; your rating lives on the wine in your general activity. ([Vivino Cellar](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature))

**Takeaway for cork-and-note:** "Open a bottle" should (a) decrement the lot quantity and log a consumption event, and (b) **optionally** spawn a tasting record. The tasting belongs to the *wine experience log*, not the inventory row — exactly mirroring CellarTracker's separation, and exactly mirroring cork-and-note's existing split between inventory (new) and `wines` (tasted).

### 1e. Value tracking & drink-window / maturity features

- **Value:** Two distinct numbers everywhere — **purchase price** (what you paid, stored once) and **current/market value** (recomputed, often a paid feature). Wine-Searcher's entire cellar product *is* current valuation; InVintory shows appreciation since purchase; CellarTracker offers personal/community/auction valuations behind a subscription; Vivino shows an estimated collection value with Premium. For a v1, store purchase price and leave a nullable `current_value` you can populate later.
- **Drink window:** Universally modeled as **drink-from / drink-by** (year or date). CellarTracker layers "My Drinking Window" over "Community Dates" and produces a **"Ready to Drink" / Drinkability** report that surfaces bottles to drink soon. InVintory adds maturity *alerts*. This is a high-value, low-cost feature: two nullable year columns plus a derived "status" (Too young / Ready / Drink up / Past peak) computed from `current year`. (CellarTracker [Ready to Drink](https://support.cellartracker.com/article/28-ready-to-drink-report), [Drinkability](https://support.cellartracker.com/article/103-whats-poppin-report).)

---

## 2. Best-Practice Field List for cork-and-note

Grouped by the three-level pattern, with a v1/v2 priority so the feature can ship lean.

### Wine identity (the "what it is") — *partly reuse existing concepts*
- producer / winery (link to existing `wineries` where possible) — **v1**
- wine name — **v1**
- vintage / year — **v1**
- wine type (red/white/rosé/sparkling — already an enum-like field in `wines`) — **v1**
- varietal / grape — **v1**
- region / appellation — **v2**
- vineyard / designation — **v2**

### Lot / bottle (the "physical instance")
- quantity — **v1**
- bottle size / format (default 750ml; magnum, half, etc.) — **v1**
- storage location (free-text or label, e.g. "Fridge", "Rack A") — **v1**
- bin / slot (specific spot within a location) — **v2**
- per-bottle / per-lot note — **v2**

### Purchase (the "how it came in")
- purchase date — **v1**
- purchase price (+ currency, default user locale) — **v1**
- store / source — **v2**
- current / market value (nullable, future automation) — **v2**

### Drinking & maturity
- drink-from (year) — **v1**
- drink-by (year) — **v1**
- derived drink-status (computed, not stored) — **v1**
- personal rating (reuse existing 0–5 scale) — **v2**

### Lifecycle / consumption
- status: in_cellar / consumed / gifted / sold / spoiled / moved-out — **v1** (at least in_cellar/consumed)
- consumed date + reason + note — **v1**
- link from a consumed/opened bottle to a tasting in the `wines` log — **v1 (the marquee integration)**

---

## 3. PROPOSAL — for user to decide

> Everything below is a recommendation only. Nothing has been committed or applied to the repo. Adjust freely.

### 3.1 Design decisions baked into this proposal

1. **Lot-based, not per-bottle.** A `cellar_bottles` row represents a *lot*: a wine+vintage+size at a location with a quantity and a purchase price. "One bottle" = quantity 1. This matches casual-user expectations while preserving CellarTracker-style location/price granularity. (If you later want true per-bottle barcodes, you split a lot into quantity-1 rows.)
2. **Keep inventory separate from the tasted-wines log.** The new `cellar_bottles` table is the *own* concept; the existing `wines` table stays the *tasted* concept. They connect only at the moment of "open a bottle."
3. **Reuse `wineries`** for producer where the wine comes from a known winery (FK), but also allow free-text producer for wines bought retail from wineries not in your `wineries` table. This mirrors how `wines` already lives somewhat independently.
4. **Drink-window status is derived in the app/SQL**, not stored, so it's always current.
5. **RLS pattern** copies the existing per-user policies on `visits`/`wishlist` (`auth.uid() = user_id`).

### 3.2 Schema sketch

```sql
-- =========================================================
-- CELLAR (inventory of bottles a user OWNS)
-- =========================================================

-- Lifecycle status for a lot/bottle
create type public.cellar_status as enum (
  'in_cellar',  -- physically owned
  'consumed',   -- drunk from cellar
  'gifted',
  'sold',
  'spoiled'     -- corked / oxidized / etc.
);

create table public.cellar_bottles (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,

  -- WINE IDENTITY -----------------------------------------
  -- Optional link to a known winery (producer); free-text fallback for retail buys.
  winery_id     bigint references public.wineries,        -- nullable
  producer      text,                                     -- free-text producer if no winery_id
  wine_name     text not null,
  vintage       text,                                     -- text, mirrors wines.wine_year ("NV" allowed)
  wine_type     text,                                     -- red/white/rosé/sparkling (match wines.wine_type)
  varietal      text,
  region        text,                                     -- appellation / region

  -- LOT / PHYSICAL ----------------------------------------
  quantity      integer not null default 1 check (quantity >= 0),
  bottle_size   text not null default '750ml',            -- 375ml / 750ml / 1.5L (magnum) / etc.
  location      text,                                     -- e.g. "Wine fridge", "Rack A"
  bin           text,                                     -- specific slot

  -- PURCHASE ----------------------------------------------
  purchase_date  date,
  purchase_price numeric(10,2),
  currency       text default 'USD',
  store          text,
  current_value  numeric(10,2),                           -- nullable; future market-value automation

  -- DRINKING WINDOW ---------------------------------------
  drink_from    integer,                                  -- year, e.g. 2026
  drink_by      integer,                                  -- year, e.g. 2032

  -- PERSONAL ----------------------------------------------
  rating        decimal(3,1),                             -- reuse app's 0–5 scale; optional
  notes         text,

  -- LIFECYCLE ---------------------------------------------
  status        public.cellar_status not null default 'in_cellar',

  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);

create index cellar_bottles_user_idx   on public.cellar_bottles (user_id);
create index cellar_bottles_status_idx on public.cellar_bottles (user_id, status);

-- =========================================================
-- CONSUMPTION EVENTS (audit log of opening/removing bottles)
-- =========================================================
create table public.cellar_consumptions (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,
  bottle_id     uuid references public.cellar_bottles not null,
  consumed_date date not null default current_date,
  reason        public.cellar_status not null default 'consumed', -- consumed/gifted/sold/spoiled
  quantity      integer not null default 1 check (quantity > 0),
  note          text,                                     -- "with Sarah's birthday dinner"
  -- THE KEY LINK: opening a bottle can spawn a tasting in the existing log
  wine_id       uuid references public.wines,             -- nullable; set if user logged a tasting
  created_at    timestamp with time zone default now() not null
);

create index cellar_consumptions_bottle_idx on public.cellar_consumptions (bottle_id);

-- =========================================================
-- RLS (mirrors existing visits / wishlist policies)
-- =========================================================
alter table public.cellar_bottles      enable row level security;
alter table public.cellar_consumptions enable row level security;

create policy "own cellar select" on public.cellar_bottles
  for select using (auth.uid() = user_id);
create policy "own cellar insert" on public.cellar_bottles
  for insert with check (auth.uid() = user_id);
create policy "own cellar update" on public.cellar_bottles
  for update using (auth.uid() = user_id);
create policy "own cellar delete" on public.cellar_bottles
  for delete using (auth.uid() = user_id);

create policy "own consumption select" on public.cellar_consumptions
  for select using (auth.uid() = user_id);
create policy "own consumption insert" on public.cellar_consumptions
  for insert with check (auth.uid() = user_id);
create policy "own consumption delete" on public.cellar_consumptions
  for delete using (auth.uid() = user_id);
```

### 3.3 Relationships to existing tables

```
users ──< cellar_bottles >── wineries        (producer, optional FK)
              │
              └──< cellar_consumptions ──> wines   (optional: the tasting you logged)
                                             │
wines ──> visits ──> wineries                (existing "tasted" chain, unchanged)
```

- `cellar_bottles.winery_id` → `wineries.id`: optional, links a lot to a known producer so you can show winery info / map. Free-text `producer` covers retail buys from wineries not in your dataset.
- `cellar_consumptions.bottle_id` → `cellar_bottles.id`: every open/remove event.
- `cellar_consumptions.wine_id` → `wines.id`: **the bridge between "own" and "tasted."** Nullable, so you can open a bottle without logging a tasting, or log later.

### 3.4 How "open a bottle → log a tasting" connects

This is the integration that makes the Cellar feel native to cork-and-note rather than a bolt-on. Recommended flow when the user taps **"Open / Drink this bottle"**:

1. **Decrement inventory.** `cellar_bottles.quantity -= 1`. If it hits 0, set `status = 'consumed'` (or keep the row for history — recommend keeping it, just status-flagged).
2. **Record the event.** Insert a `cellar_consumptions` row (date, reason, quantity, optional note).
3. **Offer to log a tasting (optional).** Prompt: *"Want to rate this wine?"* If yes, create a row in the existing **`wines`** table (the tasted log) prefilled from the bottle's identity (name, type, year, varietal), then store that new `wines.id` back onto `cellar_consumptions.wine_id`.
   - Open question for you: today `wines.visit_id` references a `visit` and `wines.overall_rating` is `NOT NULL`. A cellar-opened tasting has **no winery visit**. You'll need to either (a) make `wines.visit_id` nullable, or (b) add a nullable `wines.cellar_consumption_id` / `source` column to mark "tasted from my cellar" vs "tasted at a winery." Recommend making `visit_id` nullable and adding a lightweight `source text` ('visit' | 'cellar') to `wines`. This is the one existing-schema change the feature really wants — and it **overlaps directly with Epic #5's "decouple a wine log from requiring a winery"** work.
4. **Partial pours (Coravin).** Mirror CellarTracker: do **not** decrement on a partial pour. Either skip step 1 entirely for a "taste, keep bottle" action, or add a boolean `cellar_consumptions.partial` so a tasting can be logged while the lot stays in_cellar. Recommend adding `partial boolean default false` if you want this in v1; otherwise defer.

### 3.5 Derived drink-window status (no extra columns)

Compute in SQL or app code from `drink_from` / `drink_by` and the current year:

```sql
case
  when drink_from is not null and extract(year from now()) < drink_from then 'too_young'
  when drink_by   is not null and extract(year from now()) > drink_by   then 'past_peak'
  when drink_by   is not null and extract(year from now()) = drink_by   then 'drink_up'
  else 'ready'
end
```

This powers a "Ready to Drink" view (the single highest-value derived feature, per every app surveyed) for free.

### 3.6 Suggested phasing

- **v1:** `cellar_bottles` (lot-based) + `cellar_consumptions`; add/edit/delete lots; "open a bottle" decrement + optional tasting link; derived drink-window status; make `wines.visit_id` nullable + add `wines.source`.
- **v2:** bin/slot granularity, store/source, `current_value` automation (Wine-Searcher-style pricing), per-bottle barcodes (split lots into qty-1 rows), maturity alerts/notifications, collection-value summary.

---

## Sources

- CellarTracker — [What you can track](https://support.cellartracker.com/article/32-what-can-be-tracked) · [How to add bottles](https://support.cellartracker.com/article/82-how-to-add-bottles) · [Managing Purchases](https://support.cellartracker.com/article/44-managing-purchases) · [Public & Private Note Types](https://support.cellartracker.com/article/50-public-and-private-note-types) · [Tasting Notes & Ratings](https://support.cellartracker.com/article/49-tasting-notes-and-ratings) · [Ready to Drink report](https://support.cellartracker.com/article/28-ready-to-drink-report) · [Drinkability Alert](https://support.cellartracker.com/article/103-whats-poppin-report) · [Coravin Bottle Tracking](https://support.cellartracker.com/article/27-coravin-bottle-tracking)
- Vivino — [Discover Vivino's Wine Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature) · [Complete guide to the Vivino experience](https://www.vivino.com/en/wine-news/the-complete-guide-to-the-vivino-experience)
- InVintory — [invintory.com](https://invintory.com/) · [Premium](https://invintory.com/premium) · [How to bulk edit bottles](https://help.invintory.com/en/articles/9892500-how-to-bulk-edit-bottles) · [Add wines by scanning a label](https://help.invintory.com/en/articles/14301437-how-to-add-wines-by-scanning-a-label)
- Wine-Searcher — [Help / FAQ (cellar)](https://www.wine-searcher.com/help) · [Professional Valuations](https://www.wine-searcher.com/trade/valuation)
