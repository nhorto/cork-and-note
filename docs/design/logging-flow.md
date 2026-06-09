# Logging Flow Design (Hybrid A/B)

**Repo:** `nhorto/cork-and-note` · **Issue:** #18 · builds on #17 decisions
**Date:** 2026-06-08
**Status:** PROPOSAL for owner review. Visual mockup: [`mockups/logging-flow-mockup.html`](mockups/logging-flow-mockup.html). No code yet (plan-before-code).

Decisions this builds on: [`logging-experience-decisions.md`](logging-experience-decisions.md).

---

## The hybrid model in one sentence

There is **one underlying object — a logging *session*** (today's "visit", generalized) that holds **1…N wines** and an **optional place**. Log one wine → it's a single-wine entry (the **B** feel). Add another → the same session becomes a multi-wine **winery-trip recap** (the **A** feel). Same data, two experiences.

This is exactly what the owner asked for: "leave it as A, but let B happen when there's only one wine."

---

## Entry points (both create a session)

1. **"+ Log a wine"** (primary CTA, Home / center tab) → **B-first**: you immediately log one wine; place and additional wines are optional add-ons. This is the common path.
2. **"Start a winery visit"** (from a winery on the map, a winery detail page, or a Home shortcut) → **A-first**: opens a session pre-set to that winery's place/pin; you add wines into it.

Both land in the same session object — they differ only in whether the place is pre-filled.

> **DECIDED (owner):** ship **both** entry points in v1 — "+ Log a wine" (B-first) and "Start a winery visit" (A-first).

---

## Screen flow (see mockup)

**Screen 1 — Log a wine.**
- Required: **Winemaker** (search the `wineries` list *or* free-text producer) + **Varietal**.
- Optional, collapsed by default: type, vintage, rating, flavor notes, photo, notes.
- Inline **"✨ Suggest characteristics"** (existing AI hook from `WineEntryForm`).
- **"📍 Add a place — optional"** row, and **"＋ Add another wine to this session"**.
- **Save wine** commits a valid log even with no place and no second wine.

**Screen 2 — Add a place (optional, skippable).**
- Place type segmented control: **Winery / Restaurant / Elsewhere**.
- *Winery* → search winery list, pin auto-set (adjustable). *Restaurant* → name + optional pin. *Elsewhere* → nothing required.
- The place attaches to the **session**, so all wines in it inherit the location.
- **"Skip — no location"** is always available; no-location is the default.

**Screen 3 — Session recap.**
- Header = place (or "No location") + date; then the list of wines in the session, each with varietal/maker/vintage/score.
- **"＋ Add another wine"** keeps building the session (the A path).
- A session with one wine simply shows one row (the B path) — no separate UI.

**Edit later (Decision 4).** Any session or wine can be reopened to add a place, add/remove wines, or fix fields — including promoting a one-wine log into a full session.

---

## How this maps to today's code

- Today: `VisitLogForm` + `WineEntryForm` already capture multiple wines under a visit, and `visitsService.createVisit()` creates a visit + N wines. **The multi-wine-session machinery already exists** — we're generalizing it (winery optional, place types) rather than building from scratch.
- The single-wine "B" path is a thin entry into the same `createVisit` with one wine and no winery.

---

## Resolved decisions (owner-approved)
1. **Entry points:** ✅ ship **both** "+ Log a wine" and "Start a winery visit" in v1.
2. **Hybrid model:** ✅ approved — one session holds 1…N wines; single wine = B, multiple = A.
3. **Winemaker selection:** adopted — when a typed winemaker matches a known winery, auto-suggest linking it so the pin/place can pre-fill.
4. **Single-wine display:** adopted — a one-wine session renders as just the wine (no session chrome); "session" framing appears only at 2+ wines.
5. **Cellar tie-in:** adopted — "opening a bottle" (Epic #6) creates a one-wine session with no place, keeping one consistent model.

(Items 3–5 are sensible defaults locked to keep momentum; flag if you want any changed.)
