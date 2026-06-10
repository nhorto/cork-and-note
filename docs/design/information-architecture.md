# Information Architecture — Home-Centric Redesign

**Repo:** `nhorto/cork-and-note` · **Issue:** #14 · builds on #13 research
**Date:** 2026-06-08
**Status:** PROPOSAL for owner review (tab structure approved). Visual mockup: [`mockups/home-screen-mockup.html`](mockups/home-screen-mockup.html). No code yet.

Builds on [`../research/home-and-navigation.md`](../research/home-and-navigation.md).

---

## Decided: 5-tab layout

```
   Home          Cellar        ＋ Log          Explore         Profile
 (landing)    (inventory)   (center CTA)   (map+discovery)   (you + AI)
```

Owner-approved over a 6–7 tab layout. Keeps the bar elegant (research: every major wine app stays at 3–5 tabs) and puts the **log action front-and-center**.

### What each tab is
1. **Home** — the new landing/overview (contents below).
2. **Cellar** — bottle inventory (Epic #6).
3. **＋ Log** — center CTA opening the logging flow; **both entry points** ("Log a wine" / "Start a winery visit") from [`logging-flow.md`](logging-flow.md).
4. **Explore** — the **map** (demoted from first tab) + nearby places + search/discovery. Keeps drop-pin + "where I've been / what I had."
5. **Profile** — you, stats, settings, and **Wishlist + Wines nested here**.

### Where today's surfaces go
| Today | New home | Notes |
|---|---|---|
| **Map** (tab 1) | **Explore tab** (demoted) + a Home map teaser | keeps pins/history |
| **Wishlist** (tab) | **nested under Profile** + a Home stat chip | |
| **Wines** (tab) | **nested under Profile** + "recent" on Home | full tasted list |
| **Profile** (tab) | **Profile tab** (stays) | gains Wishlist/Wines/stats |
| **Sommelier** (tab) | **contextual** — Home card + Profile + wine detail | not its own tab (matches Vivino/CellarTracker) |
| — | **Home** (new) | landing |
| — | **Cellar** (new) | inventory |

---

## Home screen contents

A vertical scroll of restrained "wine-label" cards (Château theme — serif headings, cream, thin gold rules):

1. **Greeting + stat strip** — chips: *Wines tried · Places visited · Wishlist · This year*. Tapping a chip deep-links to the full list.
2. **"Log a wine" hero CTA** — reinforces the center tab; primary action.
3. **Recent activity** — your latest logs / sessions (tap → detail).
4. **Map teaser** — a small snippet of recent/nearby places → deep-links to Explore.
5. **Ask the Sommelier** — entry card to the AI, personalized to your ratings.
6. **(v2) Recommendations** — "picked for you" from your taste profile.

---

## Navigation behavior
- **Home is the default landing** (replaces the map as first screen).
- The **center ＋ Log** is a modal/flow, not a destination tab screen.
- Deep links: stat chips → lists; recent items → detail; map teaser → Explore; sommelier card → chat.

---

## Dependencies & sequencing
- **Home stats need logging data** — Home's numbers come from `visitsService.getVisitStats()` (already exists: visits/wineries/wines counts). Cellar stats come once the Cellar ships (Epic #6 / #27).
- **Sommelier entry points** — wire the contextual launches (Epic #0 / #12).
- Tab restructure touches `app/(tabs)/_layout.js` (currently Map/Wishlist/Wines/Profile + the Sommelier tab from the merged code) → new 5-tab set + nested screens.

## Phasing
- **v1:** new 5-tab bar; build Home (greeting + stats + log CTA + recent + sommelier card); rename/relocate Map → Explore; nest Wishlist/Wines under Profile.
- **v2:** Home recommendations; richer Explore discovery; cellar stat chip (after Epic #6).

## Open items for the owner
1. **Wines vs. Cellar both nested-or-tab?** Cellar is a tab; Wines (tasted) is nested under Profile. Confirm that's the right split (own = tab, tasted = nested).
2. **Center ＋ Log styling** — a raised/centered FAB-style button, or a normal center tab? (Mockup shows a raised burgundy ＋.)
3. Anything you want surfaced on Home that's not listed above?

---

## Decided: Sommelier stays contextual (Issue #12)

**Date:** 2026-06-09 · **Status:** DECIDED

The AI Sommelier does **not** get its own tab. It remains a contextual surface, consistent with the 5-tab decision above and the home-centric redesign (keeps the bar at 5 tabs, in line with Vivino/CellarTracker, and reserves the center slot for the primary log action).

The `sommelier` route stays registered in `app/(tabs)/_layout.js` with `href: null` so it's reachable by navigation but hidden from the tab bar.

**Entry points:**
- **Home** — the "Ask your Sommelier" card (already wired; `app/(tabs)/home.js`).
- **Profile** — an "Ask the Sommelier" row in the menu (`app/(tabs)/profile.js`).
- **Wine detail** — an "Ask about this wine" action (`app/wine/[id].js`).

All three push to `/(tabs)/sommelier`, which opens the conversation list by default. Seeding per-wine context from the wine-detail entry is deferred — the standalone sommelier route takes no wine param today, and wiring one is out of scope for this placement decision.
