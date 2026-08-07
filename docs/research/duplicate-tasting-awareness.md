# Duplicate‑tasting awareness — matching rules & UX decisions

**Repo:** `nhorto/cork-and-note` · **Issue:** #93 (labelled 💬 *brainstorm before coding*) · **Epic:** #109
**Status:** Decision doc. **No code changed by this document.** Implementation is proposed as the follow‑up issues in §8.
**Date:** 2026-08-07

---

## 0. The ask

From the owner's QA pass, item 9:

> "If we already have a tasting logged for this wine — same winery/winemaker, same varietal, and importantly the **same vintage** — let the user know."

Issue #93 asks two questions before any code is written: **how strict should the matching be**, and **what should the heads‑up feel like**. This doc answers both, plus a third that turns out to matter more than either: **when does the heads‑up appear**, because the wrong timing turns a helpful nudge into a scolding.

---

## 1. TL;DR — the six decisions

1. **Reuse the existing matcher; don't invent a second one.** `lib/cellarMatch.js` already answers "are these the same wine?" conservatively, and its rationale applies verbatim here. Generalise it rather than writing a parallel rule that will drift. → §3
2. **Match on `winemaker` (producer), not the visit's place.** In this app `winemaker` *is* the winery for winery visits, so producer matching already covers "same winery" — and it additionally catches the same wine drunk at a restaurant. → §4.1
3. **Never block the save.** Re‑tasting a wine is normal, desirable behaviour — often the *point* of the app. The owner said "let the user know," not "stop them." An inline, dismissible banner; never a confirm dialog. → §5
4. **Three confidence tiers, three different sentences.** *Certain* / *Likely* / *Related (different vintage)*. A single "you've logged this" string will be wrong often enough to erode trust. → §4.4
5. **Delay the rating reveal.** Showing your old score *above* an empty rating slider anchors the new one. Show identity + date up top; put the old rating behind a tap, or below the rating input. → §5.3
6. **A same‑session duplicate is a different (stronger) signal** than a duplicate across visits, and deserves firmer copy — that one probably *is* a mistake. → §6.2

---

## 2. What exists today

There is no duplicate detection anywhere in the logging flow. `WineEntryForm.handleSave` (`components/WineEntryForm.js:455`) validates only that `winemaker` is non‑empty and commits.

But the hard part is already built. Shipping #117 and #140 produced `lib/cellarMatch.js`, whose `isSameWine(wine, bottle)` is a carefully‑reasoned answer to exactly the question #93 asks. Its own comment is the important artefact:

> matching is deliberately CONSERVATIVE to avoid false "you own this":
> producer must match, AND the wine name OR the varietal must match
> …
> when BOTH sides name the wine → the NAMES must match. Varietal alone is too loose: a producer often makes several wines of the same varietal or blend (e.g. two "Bordeaux Blend"s, or a red + a rosé both "Merlot"), so matching on varietal would wrongly link distinct cuvées.

**This is the answer to "how strict."** It was reached once, under real data, for a near‑identical problem. Re‑deriving it for #93 would at best reproduce it and at worst contradict it — leaving the app claiming "you own this" and "you've tasted this" under different rules for the same two wines.

Also already in place and reusable:

| Piece | Where | Relevance |
|---|---|---|
| `flattenTastedWines(visits)` | `lib/cellarMatch.js` | Flattens visits → one list of tasted wines carrying `visitDate` + `placeName`. Exactly the corpus #93 searches. |
| `sameVintage(wine, bottle)` | `lib/cellarMatch.js` | Missing vintage on either side ⇒ "not different". |
| `wineDisplayName(wine)` | `lib/wineDisplay.js` | Single source of truth for a wine's title — the banner must use it or the name will drift. |
| Cached visits read | `visitsService.getUserVisits` via `lib/cache.js` | The corpus is **already in memory**. Duplicate detection costs **zero network**. |
| `TastingLinkCard` | `components/TastingLinkCard.js` | The visual precedent for "here is a related tasting, tap through" — row layout, date · place meta line, rating pill. Reuse it. |

---

## 3. Decision: generalise the matcher, don't fork it

`isSameWine(wine, bottle)` is hard‑coded to compare a **wine shape** against a **bottle shape** — the field names differ on every axis:

| Concept | tasted wine | cellar bottle |
|---|---|---|
| producer | `winemaker` | `producer` / `wineries.name` |
| name | `wine_name` | `wine_name` |
| varietal | `wine_varietal` (`text[]` since #135) | `varietal` (single `text`) |
| vintage | `wine_year` (text) | `vintage` |

#93 needs **wine ↔ wine**, which the current signature can't express. Two ways forward:

- **(a) Adapter** — project a draft wine into bottle shape at the call site. Cheap, but leaves a fake "bottle" floating through the logging code and silently breaks if either shape changes.
- **(b) Normalise to a shared identity** ✅ **recommended** — extract a private `wineIdentity(x)` that maps *either* shape to `{ producer, name, varietals, vintage }`, then re‑express `isSameWine` on top of it. Behaviour for #117/#140 is unchanged (it's a pure refactor with the existing pure‑function tests as the safety net), and wine↔wine, wine↔bottle and bottle↔bottle all work for free.

(b) also quietly fixes an asymmetry: a bottle's `varietal` is a single string while a wine's is an array, so today's `norm(varietalText(...)) === norm(bottle.varietal)` compares `"cabernet sauvignon, merlot"` to `"cabernet sauvignon"` and fails. Under a shared identity both sides become a **set**, and the natural comparison is set‑equality (or non‑empty intersection — see §4.3).

---

## 4. Matching rules

### 4.1 Producer, not place

The issue says "same winery/winemaker". These collapse into one field here: `LogSessionForm` defaults `winemaker` to the place name when the place is a winery (`components/LogSessionForm.js:157`), and `WineEntryForm` requires `winemaker` ("a winery or producer"). So **matching on `winemaker` already covers the winery case**.

Matching on the *visit's place* instead would be actively wrong: drinking a producer's wine at a winery on Saturday and at a restaurant on Tuesday is the same wine and should flag. **Decision: producer only; ignore `place_name` / `winery_id` in the match.** (Place still appears in the *display*, as context.)

### 4.2 Producer is a required gate

Producer must be present and equal on both sides. It's the only mandatory field in the form, so it's always available, and it keeps the candidate set tiny before any fuzzier comparison runs.

Normalisation: lowercase, trim, collapse internal whitespace (the existing `norm`). **Not** recommended for v1: stripping "Winery"/"Vineyards"/"Cellars" suffixes or fuzzy/edit‑distance matching. The `winemaker` field already has autocomplete over the user's prior entries, which is a better fix for the same problem — it prevents the variants from being created at all. Revisit only if real data shows drift.

### 4.3 Then name, else varietal

Inherit the existing rule exactly:

- Both sides name the wine → **names must match**.
- At least one side is nameless → fall back to **varietal**.

For the varietal fallback under the new set semantics, prefer **non‑empty intersection** over strict set equality. Rationale: varietal entry is inconsistent for blends — the same wine may be logged once as `["Cabernet Sauvignon"]` and later, after a label scan, as `["Cabernet Sauvignon", "Merlot", "Cabernet Franc"]`. Strict equality misses that; intersection catches it. The producer gate keeps the false‑positive cost low. ⚠️ This is a *behaviour change* for #117/#140 as well — it makes them slightly more willing to match. That's the intended direction (they're currently over‑strict on blends), but it should be called out in the implementing PR rather than smuggled in.

### 4.4 Vintage decides the tier, not the match

Vintage should **never gate the match** — it selects which of three messages to show. Reuse `sameVintage`'s semantics (unknown on either side ⇒ "not different"), but propagate *why* so the copy can hedge:

| Tier | Condition | Copy |
|---|---|---|
| **Certain** | identity matches; both vintages known and equal | "You logged this on **12 Apr 2026**." |
| **Likely** | identity matches; vintage unknown on either side | "You **may** have logged this before — 12 Apr 2026." |
| **Related** | identity matches; both vintages known and **different** | "You've tasted the **2019** — this is the **2021**." |

Vintage normalisation: trim; extract a 4‑digit year where present; treat `NV` / `N.V.` / `non-vintage` (case‑insensitive) as a single known sentinel, **not** as unknown — "NV vs NV" is a genuine match for Champagne and most Prosecco, which is precisely where nameless varietal‑only entries cluster.

*Related* is worth building rather than suppressing: a vertical (same wine, different years) is a genuinely delightful thing to notice, and it's the one case where the user almost certainly *does* want to reread the old note.

---

## 5. UX of the heads‑up

### 5.1 Never block

**Decision: an inline banner inside the form. Not a modal, not a save‑time confirm.**

The instinct is to intercept on save — "You've logged this before. Continue?" That is wrong here. Logging the same wine twice is not an error state; it's a returning user doing the thing the app is for. Rating a wine again on a later visit is how the drink‑window and preference features get better. Gating that behind a dialog trains users to dismiss dialogs and makes the app feel like it's second‑guessing them.

It also fires at the worst moment: after the user has typed everything, when the only options are "continue" (so why ask?) or "discard my work."

### 5.2 Placement and timing

- Render below the **winemaker / wine name** block, above the ratings — it's identity context, so it belongs with the identity fields.
- Appear once the match is computable: producer non‑empty **and** (name non‑empty or ≥1 varietal). Recompute on change, debounced ~250 ms. The corpus is already in memory and the filter is a linear scan over a few hundred objects, so this is not a performance concern — the debounce is purely to stop the banner flickering mid‑word.
- **Dismissible**, and dismissal sticks for the rest of that wine's editing session.
- Never render in the **edit** flow (`initialData?.id` present) — a saved wine always "matches itself".

### 5.3 The anchoring problem ⚠️

The issue asks to surface "your note / rating". Showing a previous **7.5** directly above an untouched rating slider will drag the new score toward it. That quietly corrupts the app's most valuable data — the user's honest, independent reaction — in the name of a convenience feature.

**Decision:** the banner shows **identity + date + place** unconditionally, and puts the **rating and notes behind an explicit tap** ("See my previous note"). Users who want the comparison get it in one tap; users who don't aren't anchored. The tap opens the existing read‑only wine detail (#110) or expands inline — either is fine, the point is that it's opt‑in.

This is a deliberate, mild departure from the literal ask in #93, and worth the owner's explicit sign‑off.

### 5.4 Copy sketch

```
┌────────────────────────────────────────────────┐
│ 🍷  You logged this on 12 Apr 2026             │
│     Barboursville Vineyards · Octagon 2019     │
│     See my previous note ›              [ × ]  │
└────────────────────────────────────────────────┘
```

Multiple priors → collapse to a count with the most recent shown: *"You've logged this 3 times — most recently 12 Apr 2026."* Tap opens a list, reusing `TastingLinkCard`'s row component.

Tone: factual and warm, never corrective. "You logged this on…" — not "Duplicate detected" or "Are you sure?".

---

## 6. Edge cases

### 6.1 Exclude self, exclude the current draft
Filter out the wine being edited, and (for the across‑visit banner) the other wines in the *current unsaved* session — those are handled separately, below.

### 6.2 Same wine twice in one session → stronger signal
Two pours of the same wine *within one visit* is much more likely a genuine mistake (double‑tap, or a tasting‑card scan that emitted a duplicate row). **Decision:** same rule, firmer copy — *"You've already added this wine to this visit"* — shown on the second card. Still non‑blocking.

### 6.3 Tasting‑card scan (#139) produces many drafts at once
A banner per draft would be overwhelming. **Decision:** in the multi‑draft review list, show a compact per‑row badge ("logged before") rather than a banner, and let the row expand.

### 6.4 Cellar bottles are out of scope
"You own this" is #117 and already ships via `matchWineToCellar`. #93 is strictly about *prior tastings*. Both banners could theoretically appear at once; if that proves noisy in practice, merge them later — don't pre‑solve it.

### 6.5 Data hygiene
`wine_name` is `not null` in the schema but is written as `''` when the user leaves it blank, so treat empty‑string and null identically (the existing `norm` already does).

---

## 7. Non‑goals

- **No merging or de‑duplication of records.** Two tastings of the same wine are two legitimate rows.
- **No auto‑fill of ratings or notes** from the prior tasting (§5.3).
- **No cross‑user / global wine database** matching. Everything stays scoped to the signed‑in user's own tastings, client‑side.
- **No fuzzy producer matching** in v1 (§4.2).

---

## 8. Proposed follow‑up issues

| # | Scope | Depends on |
|---|---|---|
| A | **Refactor:** extract `wineIdentity` in `lib/cellarMatch.js`; re‑express `isSameWine` over it; switch varietal comparison to set‑intersection. Pure refactor + explicit note that #117/#140 matching loosens slightly for blends. | — |
| B | **`findPriorTastings(draftWine, tastedWines, { excludeIds })`** returning `{ tier, matches[], mostRecent }`. Pure function, no network. | A |
| C | **`PriorTastingBanner` component** + wire into `WineEntryForm` (banner, dismiss, opt‑in note reveal). | B |
| D | **Same‑session duplicate** copy variant in `LogSessionForm`. | B |
| E | **Per‑row "logged before" badge** in the tasting‑card scan review list (#139). | B |

A–C are the minimum that closes #93. D and E are small once B exists.

---

## 9. Open questions for the owner

1. **§5.3 anchoring** — agreed that the previous *rating* should be one tap away rather than shown inline? This is the one place this doc knowingly deviates from the issue text.
2. **§4.3 varietal intersection** — happy for #117/#140 matching to loosen slightly for blends as a side effect, or should that stay strictly equal and only #93 use intersection?
3. **Scope of the corpus** — match against *all* prior tastings forever, or only the last N / last 2 years? All‑time is proposed (it's free, and "I tasted this in 2024" is exactly the fact worth surfacing).
