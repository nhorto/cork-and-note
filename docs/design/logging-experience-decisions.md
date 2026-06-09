# Core Logging Experience — Product Decisions

**Repo:** `nhorto/cork-and-note` · **Issue:** #17 (discovery output) · feeds #18 (flow design) and #19 (schema)
**Date:** 2026-06-08
**Status:** Decisions locked with the app owner. Grounded against the current data model. This is the discovery/decision record — detailed flow design and schema are the next sub-issues.

Companion research: [`docs/research/logging-experience.md`](../research/logging-experience.md).

---

## 1. The decisions (locked)

| # | Decision | Detail |
|---|----------|--------|
| 1 | **Required fields = winemaker + varietal** | To save a wine log, the only required fields are the **winemaker** (a winery *or* a free-text producer — "whatever made it") and the **varietal**. Everything else (rating, type, year, notes, flavors, photos, location) is optional. |
| 2 | **Location off by default, optional pin** | Logging does **not** require a location. The user can optionally **drop a pin** (current location or manual). Default state is "no pin." |
| 3 | **Typed place, tied to the pin** | When the user does add a place, they pick a type — **Winery / Restaurant / Somewhere else**. The **Winery** case naturally prompts to drop/select a pin. No "purchased-at vs drank-at" split in v1. |
| 4 | **Logs are editable after saving** | A log can be edited later — including adding/changing the location after the fact. This is what makes at-home and retroactive logging work. |
| 5 | **Manual entry first** | v1 entry is manual (reusing existing wine-entry forms) plus the existing AI "suggest characteristics" hook. Label-scan / AI photo identification is a later feature (overlaps with the Sommelier), not a v1 blocker. |

---

## 2. Where the current model stands

From `DataBase Schema.txt` and `lib/visits.js` (authoritative: the code):

- **`visits`** — `user_id`, **`winery_id` NOT NULL**, `visit_date`, `notes`, `photo_url`. A visit is the container for a winery trip on a date.
- **`wines`** — hangs off a visit via `visit_id`; `wine_name NOT NULL`, `wine_type NOT NULL`, `overall_rating NOT NULL`, plus `wine_varietal` (used in code; **missing from the committed schema doc** — drift to fix), sweetness/tannin/acidity/body/alcohol, notes, photos.
- A wine is always created through `createWineForVisit(visit.id, …)`, and a visit always has a winery.

**Implication:** today you **cannot log a wine without choosing a winery.** That is exactly the constraint these decisions remove.

### What already holds (good news)
- **Edit-after-save (Decision 4) is already supported** — `updateVisit()` and `updateWine()` exist. We extend, not invent.
- The wine form already captures varietal, type, year, flavors, ratings — so Decision 1's *fields* mostly exist; what changes is which are **required** and that a winery is no longer mandatory.

### What must change (flagged for #19 — schema)
1. **`visits.winery_id` → nullable.** A logging occasion may have a winery, a restaurant, or no place at all.
2. **Repurpose "visit" into a generic logging occasion/place** with: `place_type` (`winery` | `restaurant` | `other` | `none`), `place_name` (free text, e.g. restaurant name), and optional `latitude`/`longitude` (the dropped pin). Winery occasions keep `winery_id`.
3. **Add `winemaker`/`producer` to `wines`** (per-wine, free text) — because at a non-winery occasion, different wines can have different makers. Where the occasion *is* a known winery, the winery can pre-fill the winemaker.
4. **Relax `wines` NOT NULL constraints** to match Decision 1: required = winemaker + varietal; make `wine_type` and `overall_rating` nullable (the code already defaults rating to 0, so this is mostly formalizing reality).
5. **`wines.visit_id` stays nullable** — supports both location-less logs and the cellar's "open bottle → log tasting" link ([`docs/research/wine-cellar.md`](../research/wine-cellar.md)).
6. **RLS** for any new columns/relationships follows the existing `auth.uid() = user_id` pattern.
7. **Fix schema-doc drift** — regenerate `DataBase Schema.txt` (or replace it with real migrations) so it matches the live DB, since this work adds columns.

> ⚠️ **Cross-epic coordination:** items 1–5 are the **same schema change** Epic #6 (Wine Cellar) needs for "log a tasting with no winery visit" (see #23 / #19). Design the migration once, serving both.

---

## 3. The flow these decisions imply (for #18 to design in detail)

A sketch, not the final design:

1. **Start a log** from a prominent "+ Log a wine" CTA (Home / center tab — see #13 IA proposal). Identify the wine: **winemaker + varietal** required; type/year/rating/notes/flavors optional.
2. **Optional enrich:** ratings, flavor notes, photo, AI-suggested characteristics.
3. **Optional "Where did you have it?"** — skippable. If engaged: pick **Winery / Restaurant / Somewhere else**; Winery prompts to select/drop a pin; Restaurant takes a name + optional pin; "Somewhere else" needs nothing.
4. **Save** — valid with no location.
5. **Edit later** — reopen any log to add/adjust fields or location.

### Open questions for #18 (flow design)
- One wine per log, or keep the "occasion with multiple wines" grouping (a winery visit where you taste several)? The current model groups wines under a visit — do we keep that for the winery case while allowing single standalone logs elsewhere?
- Where does "drop a pin" reuse the existing map pin-drop UX (Epic #4 map work)?
- How does an existing winery get selected (search the `wineries` table) vs. free-text producer?
- Migration plan for existing `visits`/`wines` rows (all currently winery-bound) → the new model.

---

## 4. Next steps
- **#18** — design the detailed logging flow + entry points (uses this doc).
- **#19** — design the data-model migration (winery-optional + winemaker + place type/pin), coordinated with the Cellar schema (#23/#24).
- Then implement (#20), cleanup (#21), and migrate existing data (#22).
