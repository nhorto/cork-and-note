# Region model — free‑text vs. structured

**Repo:** `nhorto/cork-and-note` · **Issue:** #88 (labelled 💬 *brainstorm before coding*) · **Epic:** #109
**Status:** Decision doc. **No code changed by this document.** Implementation is proposed as the follow‑up issues in §9.
**Date:** 2026-08-07

---

## 0. The ask

From the owner's QA pass, item 3:

> "How are the regions set? Does this go by country or not? How does it know what the region in Virginia is, or is it just the town that it is from?"

There is a direct answer, and it's worth stating before any of the design discussion:

> **It doesn't know.** `region` is whatever the user typed or whatever the AI read off the label. Nothing derives it from the winery's location, nothing maps a town to an AVA, and nothing relates "Monticello" to "Virginia". There is no country, no hierarchy, and no reference data anywhere in the app.

§6 argues that **the app deriving a region from the winery's town would be worse than leaving it blank**, which is the substantive answer to the last part of the question.

---

## 1. TL;DR — the recommendation

**Stage 1 (now): keep free text, add autocomplete + normalise on write.** The codebase has *already solved this exact problem* one field over — the cellar form's **Location** field autocompletes over values the user has already typed, with the comment "so the same spot isn't spelled three ways." Region is the only comparable field that didn't get the treatment. This is a small, no‑migration change that kills most duplicate values at the source. → §5.1

**Stage 2 (only if Stage 1 leaves real pain): a curated region list with a parent country**, seeded exactly like `lib/varietals.js`, storing a canonical string plus a nullable `region_country`. Not a full ontology. → §5.2

**Reject "derive the region from the winery's location" as a data source.** A winery's *address* is not its wine's *appellation*. Adopt only a narrow version: **prefill, never bind**. → §6

**Two live bugs found during this investigation** that are independent of the model decision and should be fixed regardless (§3.3).

---

## 2. Current state

### 2.1 Where region lives

`region` exists in **exactly one place**: `cellar_bottles.region text` (nullable), added in `supabase/migrations/20260609000000_cellar_inventory.sql:34` and untouched since.

It is populated two ways:

1. **The user types it** — `components/CellarBottleForm.js:364`, a plain free‑text `Field` labelled "Region", placeholder `"Napa Valley…"`. No suggestions, no validation, no normalisation beyond `.trim() || null` (`:44`).
2. **The AI label scanner reads it** — `lib/cellarScan.js:58` instructs the model: *"region: the region / appellation / country if printed (e.g. 'Napa Valley', 'Bordeaux', 'Barolo DOCG'), else null."*

Note what that prompt does: it deliberately collapses **three different levels of granularity** — sub‑appellation, region, and country — into one string, whichever the label happens to print. That is the root of the modelling problem, and it's baked into the data we already have.

### 2.2 Who consumes it

| Consumer | Where | Sensitive to exact string? |
|---|---|---|
| Cellar free‑text search | `lib/cellarBrowse.js:74` | No — substring match |
| Cellar **filter facets** | `lib/cellarBrowse.js:177` | **Yes** — one chip per distinct string |
| Cellar **group‑by region** | `lib/cellarBrowse.js:222` | **Yes** — one group per distinct string |
| Cellar **insights** composition | `lib/cellarInsights.js:94` | **Yes** |
| Home "N regions across your cellar" | `lib/cellarInsights.js:116`, `app/(tabs)/home.js:461` | **Yes** (lowercased, so slightly better) |
| AI drink‑window | `lib/drinkWindow.js:55,64` | **No** |
| AI food pairing | `lib/cellarPairing.js:45` | **No** |
| AI sommelier / Tonight's Pick | `lib/cellarSommelier.js:59,85` | **No** |

**This table is the most important finding in the doc.** The three AI consumers pass region as free prose into an LLM, which reads `"Barolo DOCG"`, `"Piedmont"`, and `"Italy"` perfectly well and needs no structure whatsoever. **The problem is entirely confined to the four deterministic consumers** — facets, group‑by, and the two insights counts.

That massively shrinks the scope. We are not modelling wine geography; we are stopping a filter chip list from listing "Napa Valley" three times.

### 2.3 Two structural gaps

- **Tasted wines have no region at all.** The `wines` table has no region column. Region is a cellar‑only concept, so a wine you logged at a winery carries none, and nothing in the tasting flow ever asks for one. Any structured model must decide whether it eventually spans both (§7).
- **The `wineries` table has no region, state, or country** — only `name`, `website`, `address`, `latitude`, `longitude`. So there is no location data to derive from beyond an unparsed address string and a lat/long.

---

## 3. Why the exact-string model actually hurts

### 3.1 The concrete failure

A user with a dozen Virginia bottles plausibly ends up with `Virginia`, `VA`, `Monticello`, `Monticello AVA`, `Charlottesville`, and `Central Virginia` — **six filter chips and six groups for what is, to the user, one place.** Two of those (`Virginia`, `Monticello AVA`) aren't even inconsistent data entry; they're two legitimately different levels of a real hierarchy, both correctly transcribed from labels.

The home screen then reports *"6 regions across your cellar"* — a stat presented as a sign of a broad collection that is really a measure of transcription noise.

### 3.2 Why it's not urgent

Per [`wine-cellar-ux.md`](./wine-cellar-ux.md), the target persona owns **dozens** of bottles, not hundreds. At that scale a slightly messy facet list is an annoyance, not a blocker, and the search box (substring, case‑insensitive) still finds things. This is real, but it is **P2 polish**, not a foundational data problem — which argues strongly against paying for a hierarchy now.

### 3.3 ⚠️ Two live bugs found (fix regardless of which model wins)

**Bug 1 — facets are case‑sensitive but filtering is case‑insensitive.** `lib/cellarBrowse.js:165‑169` builds facet values with `String(raw).trim()` (case preserved), but `matchesFilters` compares with `eqInsensitive` (`:121`). So `"Napa Valley"` and `"napa valley"` produce **two separate chips that select the identical set of bottles** — tapping either returns both. Confusing, and it makes the duplicate‑value problem look worse than it is. **Affects all four facet types** (`types`, `regions`, `varietals`, `locations`), not just region.

**Bug 2 — `winery.region` is dead code.** `app/winery/[id].js:227` renders `{winery.region && ` Located in the ${winery.region} region.`}`, but the `wineries` table has no `region` column in the schema or in any migration. The expression is permanently `undefined`, so that sentence has never rendered. Either add the column and populate it, or delete the line — but note that this is *someone previously assuming region‑from‑winery works*, which §6 argues against.

---

## 4. The options

The issue lists three directions. Evaluated against: does it fix §3.1, what does it cost, and what's the migration risk.

### A. Free text + normalise + suggest existing

Autocomplete the Region field from the user's own prior values; canonicalise casing and whitespace on write.

- ✅ **No schema change, no migration, no old‑build risk.**
- ✅ Fixes the dominant cause of duplicates — the same place typed slightly differently — **at the point of entry**, which is the only place it can be fixed cheaply.
- ✅ **Exact in‑repo precedent**: the Location field on the same form already does this, for this reason (`components/CellarBottleForm.js:366‑377`, comment: *"Location reuses places already typed (autocomplete) so the same spot isn't spelled three ways"*). `AutocompleteInput` is explicitly documented as "generic on purpose" and is already used four times on this form. The facet collector (`cellarBrowse.js:177`) already produces exactly the list of existing values to feed it.
- ❌ Does **not** relate `Monticello AVA` to `Virginia`. Different levels stay unrelated.
- ❌ Doesn't help the *first* bottle from a region, when there's nothing to suggest.

**Effort: very small.** Swap one `<Field>` for an `<AutocompleteInput>` and add a write‑time normaliser.

### B. Light hierarchy (country → region → appellation)

A curated reference list mapping known wine regions to a parent country (and optionally a parent region), seeded like `lib/varietals.js`.

- ✅ Enables "group by country", relates sub‑regions to parents, and makes the insights count meaningful.
- ✅ Gives the *first* bottle from a region something to autocomplete against.
- ❌ **A real, permanently‑maintained data asset.** Wine appellations number in the thousands, change, and are politically contested. Any list is a snapshot that decays.
- ❌ Free‑text entries must still be allowed (a small producer's obscure appellation won't be in the list), so the model is *always* hybrid — you never get to assume structure.
- ❌ Requires a migration and a backfill of existing values, with the old‑build hazard in §8.

**Effort: medium‑to‑large**, dominated by curating and maintaining the list, not by code.

### C. Derive region from the winery's location

- ❌ **Rejected as a data source.** See §6 — this is the interesting one.

---

## 5. Recommendation: staged, starting small

### 5.1 Stage 1 — do this now (Option A)

1. **Autocomplete the Region field** over the user's existing region values, mirroring Location exactly.
2. **Normalise on write**: trim, collapse internal whitespace, and — when the typed value case‑insensitively equals an existing value — **store the existing spelling**. That single rule makes `napa valley` collapse into `Napa Valley` without ever second‑guessing the user's actual words.
3. **Fix Bug 1** (§3.3) so facets are de‑duplicated case‑insensitively, taking the most common existing spelling as the display label.

Together these are a few hours' work, carry no migration risk, and eliminate the *majority* of §3.1's duplicates — everything except genuine level‑of‑granularity differences.

### 5.2 Stage 2 — only if Stage 1 leaves real pain

Revisit after Stage 1 has been in real use for a while. If the remaining complaint is specifically *"Monticello and Virginia should be the same thing"*, then add a **B‑lite**:

- A curated list of ~150–300 **well‑known** regions with a parent country, seeded like `lib/varietals.js` (which grew 48 → 124 entries in #134 and works well).
- Keep `region text` as the canonical display string; add a **nullable** `region_country text` alongside it. Nullable and additive means old builds ignore it safely.
- Group‑by gains a "Country" option; the insights count uses country, which is a genuinely meaningful number.
- Free text remains fully valid — the list only ever *suggests*.

**Do not build Stage 2 speculatively.** The persona (§3.2) may never need it, and a half‑maintained region ontology is worse than clean free text.

### 5.3 What is explicitly not recommended

A full `countries` / `regions` / `appellations` relational hierarchy with foreign keys. That is CellarTracker‑grade structure serving the 500‑bottle collector that [`wine-cellar-ux.md`](./wine-cellar-ux.md) declares an explicit non‑goal. It would be the largest data‑modelling change in the app, to fix a P2 facet‑list annoyance, for a user who owns thirty bottles.

---

## 6. Why not derive region from the winery — the owner's actual question

> "How does it know what the region in Virginia is, or is it just the town that it is from?"

The town is **not** the region, and that distinction is exactly why the app shouldn't infer one from the other:

- A winery's **address** is where the tasting room is. The wine's **appellation** is where the *grapes* were grown. These routinely differ — Virginia producers commonly source fruit from several AVAs, and plenty of wineries buy grapes from other states entirely.
- A single winery's bottles often carry **different** appellations across its range — an estate wine and a "Virginia" blend from the same producer are two different regions.
- Deriving would produce a value that is **confidently wrong and invisible**, because it looks authoritative. A blank field is honest; a wrong one silently poisons the facets, the insights count, *and* the three AI prompts that reason about region to estimate drink windows and pairings. Bad region data is worse than no region data precisely because the AI features trust it.

**Adopt only the narrow version: prefill, never bind.** When a bottle is added from a winery the user has visited, the Region field may be *pre-populated* as an editable suggestion the user can accept or overwrite — identical to how `LogSessionForm` prefills `winemaker` from the place name. It must never be silently written, never be read‑only, and never be back‑filled onto existing rows.

Even that requires location data the app doesn't have: `wineries` has only an unparsed `address` string and lat/long (§2.3), so a prefill would first need address parsing or reverse geocoding — more work than Stage 1 and less valuable. **Defer it.**

---

## 7. Should tasted wines get a region?

Not yet, and not as part of #88. But the asymmetry (§2.3) should be recorded: region is a cellar‑only field, so the wine detail screen, "My wines", and the sommelier's view of *tasted* wines are all region‑blind.

Two reasons to defer: the tasting form is deliberately fast and #133 has been actively *removing* required fields, so adding one cuts against the grain; and whatever shape region eventually takes should be settled on the cellar side first, where it actually has consumers. Worth a separate tracking issue.

---

## 8. Migration safety (if Stage 2 ever happens)

The **2026-07-16 varietal incident** is the governing precedent: a shipped build wrote a shape the live DB didn't have yet, and because there's no OTA on the `production` profile, that mismatch persisted for ~3 weeks and silently corrupted rows. Rules for any region migration:

1. **Additive and nullable only** (`region_country`), never a type change on `region` itself.
2. Old builds must keep working unchanged — they simply won't read the new column.
3. **Apply the migration and ship the build together**, and verify the applied state rather than assuming (see #135 / PR #146 for how that went wrong last time).
4. Any backfill/normalisation of existing `region` values should be a **separate, reversible** step run after the build is confirmed installed — and should log what it changed.

---

## 9. Proposed follow-up issues

| # | Scope | Priority | Depends on |
|---|---|---|---|
| A | **Fix facet case-sensitivity** (Bug 1, §3.3) — de-duplicate facets case-insensitively across types/regions/varietals/locations. | P1 | — |
| B | **Autocomplete + normalise the Region field** (Stage 1, §5.1) — reuse `AutocompleteInput` exactly as Location does. | P2 | A |
| C | **Resolve `winery.region` dead code** (Bug 2, §3.3) — delete the line, or add + populate the column. | P3 | — |
| D | **Curated region list + `region_country`** (Stage 2, §5.2). | Deferred | B, and evidence it's needed |
| E | **Prefill region from a visited winery** (§6, prefill-never-bind). Needs address parsing / reverse geocoding first. | Deferred | B |
| F | **Region for tasted wines** (§7) — tracking only. | Deferred | D |

A + B close #88. C is an unrelated drive-by. D–F are recorded so the reasoning isn't lost, not scheduled.

---

## 10. Open questions for the owner

1. **Is the staged plan the right call** — ship autocomplete + normalisation now and revisit structure only if it still hurts? The alternative is committing to the curated list up front, which is more work and more maintenance but fixes the `Monticello` / `Virginia` case properly.
2. **How much does the home-screen "N regions" stat matter to you?** If it's a number you actually look at, that argues for Stage 2 sooner, since it's the consumer most distorted by unnormalised values.
3. **Bug 2** (`winery.region`) — delete the sentence, or is a winery-level region something you want (it would need a new column and a way to populate it)?
