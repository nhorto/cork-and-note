# Sommo competitive audit & visual differentiation plan

**Date:** 2026-09-09
**Trigger:** Nick found [sommo.app](https://sommo.app/features/wine-journal/) and flagged that its
color scheme, home screen, and tab bar look almost identical to Cork & Note.
**Companion preview:** `docs/design/differentiation-preview-2026-09-09.html` — three re-theme
directions rendered as phone mockups next to the current Château look.

---

## 1. What Sommo is

- **Builder / scale:** Solo developer (Gökhan Arkan, London), full-time, no VC. Launched
  **December 2025**. Claims "thousands of active users," a five-star App Store rating, and a
  TinyLaunch #2 ranking. iPhone, iPad, Android, and web.
- **Feature set:** wine journal (three-tier rating: *Not for me / Solid choice / Would buy again*),
  digital cellar with drink windows and a 3D cellar-wall view, AI label/menu scanning, AI palate
  ("Taste DNA") analysis, food pairing, a world wine-region map, and a large **WSET exam-prep**
  module (flashcards, mock exams, XP).
- **Pricing:** free tier keeps journal entries only 30 days; Premium ≈ **$2.50/month billed
  yearly (~$30/yr)** with a 3-day trial.
- **Positioning:** education-first — "a wine app should make the next bottle better than the last."
  Its wedge is a proprietary wine-tuned AI and WSET study tools.

Screenshots audited (not committed — copyrighted):
`sommo.app/screenshots/today.jpg`, `journal_list.jpg`, `cellar_wall.jpg`, `palate_radar.jpg`,
`scan_result.jpg`.

## 2. How close is it, honestly?

Side-by-side with our app the overlap is real and larger than coincidence *feels* like it should be:

| Element | Sommo | Cork & Note today |
|---|---|---|
| Background | Warm ivory/cream | Cream `#FAF8F5` / parchment `#F5F2ED` |
| Primary | Deep burgundy/maroon (~`#5C1F2E`) | Burgundy `#722F37` / merlot `#5C1A1A` |
| Accent | Mustard-gold buttons (~`#C9A94F`) | Gold `#C9A962` |
| Display type | High-contrast serif (Playfair-like) headings, sans body | Georgia serif headings, system sans body |
| Tab bar | 5 slots, cream bar, **raised burgundy circle** center (Scan) | 5 slots, cream bar, **raised burgundy circle** center (＋Log) |
| Tabs | Today · Cellar · Scan · Journal · Explore | Home · Cellar · Log · Explore · Profile |
| Home hero | Burgundy "Open Tonight" cellar-pick card with **gold CTA button** | Tonight's Pick AI cellar card (burgundy/gold family) |
| Home strip | "12 bottles approach their peak" drink-window bar | Ready-to-Drink status strip |
| Home header | Date + "Good evening, Gérard" + circular initial avatar | "WELCOME BACK" + first name + circular initial avatar |

**This is convergent evolution, not copying** (in either direction — our Château theme and their
app were built independently in the same window). Burgundy + gold + cream + serif is the default
"wine" palette; a raised center action button is a stock mobile pattern; "what should I open
tonight" is the obvious cellar killer feature. Nobody owns any of this.

**But it still matters.** In an App Store search results page, in screenshots, and in a reviewer's
mind, the two apps currently read as the same product — and Sommo got to market first, has
traction, and charges **half our yearly price** ($30/yr vs our $59.99/yr). We can't out-incumbent
them on their look. We can look unmistakably like ourselves.

## 3. What we should NOT change

The pivot direction (epics #3–6) survives this contact intact:

- **Home-centric flow, cellar, AI sommelier, location-optional logging** — all still right, and our
  cellar/sommelier is grounded in *your* bottles the same way theirs is. Feature-level parity here
  is table stakes, not a problem.
- **The Château "feel"** — refined, warm, editorial — stays. We are changing the *clothes*, not the
  personality.
- **Tab structure (5 slots, contextual hidden routes)** — the IA is sound
  (`docs/design/information-architecture.md`). Only the center button's *styling* needs to change.

## 4. Where we actually differ — the positioning wedge

Sommo is an **education app** (WSET prep, SAT wizard, XP, Taste DNA) with a journal attached.
Cork & Note is a **memory keeper**: winery visits, tasting-room sessions, trips, places — a map of
*where you've been*, not a map of appellations to study. Their Explore map is a textbook; ours is
a passport.

Everything below is in service of making that difference visible at a glance:
**Sommo teaches you wine. Cork & Note remembers your wine life.**

## 5. Differentiation plan

### 5.1 Color — pick one of three directions (preview HTML shows all three)

All three keep AA-contrast ink tokens; exact values get re-validated at implementation like the
2026-07 accessibility pass did.

**A. "Midnight Cellar" — dark-first.** Espresso-ink surfaces (`#201B18` bg, `#2B2420` cards),
candlelight gold accent (`#D4A960`), wine used only as a small accent. Maximum distance from
Sommo's daylight ivory; very premium. **Cost: highest** — every screen, map style, and photo
treatment needs a pass, and light-mode users may push back.

**B. "Cork & Vine" — deep vine green + cork terracotta on linen.** *(Recommended.)*
Linen `#F6F5F0` bg, primary deep vine green `#3E5C43`, accent cork terracotta `#C0794F`, warm ink
`#26241F`, gold demoted to a thin heritage rule here and there. No mainstream wine app owns green
(Vivino red, Delectable white, CellarTracker maroon, Sommo burgundy) — and green/cork says
*vineyards, travel, the object the app is named after*. Keeps our light, warm, editorial feel, so
the re-theme is mostly a token swap in `styles/theme.js` (screens already read tokens).

**C. "Ink & Terracotta" — editorial journal.** Gallery white `#FAFAF7`, blue-black ink `#23262C`
primary, terracotta `#C25E40` accent. Leans into the "Note" half of the name — modern field-journal
look. Distinct, but coolest/least "wine" of the three.

### 5.2 Typography

Swap the display serif from Georgia (visually adjacent to Sommo's Playfair-style serif) to
**Fraunces** via `expo-google-fonts` — warmer, chunkier, instantly recognizable, and
`theme.js` already routes every heading through the `typography.fonts.serif` token, so it's a
one-token change plus font loading.

### 5.3 Tab bar

The raised burgundy circle is the single most identical element. Keep the 5-slot IA, change the
form: replace the raised circle with a **raised rounded-square "cork stamp"** center button in the
new accent color (preview shows it), or drop the raise entirely for a flat accent-tinted center
tab. Either one, combined with the new palette, kills the clone read.

### 5.4 Home screen

Keep the greeting header and Tonight's Pick (good UX is good UX), but:

1. **Restyle Tonight's Pick** onto the new palette — no burgundy card + gold pill combo.
2. **Add a "Your journey" strip** (recent places, places-visited count, mini map teaser) above the
   fold — the one module Sommo structurally cannot copy, currently buried as a stat row.
3. Reorder: greeting → Tonight's Pick → Your journey → Ready-to-Drink → recent wines.

### 5.5 Marketing site

`site/` and the App Store screenshots must move in the same pass — shipping a re-themed app under
a burgundy/gold landing page re-creates the problem at the front door. The Round-3 ampersand logo
recolors cleanly.

## 6. Also worth Nick's attention (not design)

- **Price anchor:** Sommo Premium is ~$30/yr; we're launching at $59.99/yr. Not a reason to panic —
  our value story is different — but worth a deliberate check against launch plan #159/#160 rather
  than a silent collision in reviews ("half the price of Cork & Note").
- **Their free tier deletes journal entries after 30 days.** Ours doesn't. That's a trust line we
  should say out loud on the landing page: *"Your memories are never held hostage."*

## 7. Proposed sequencing

1. Nick picks a direction (A/B/C) from the preview HTML — this is a brand call.
2. Epic: "Visual differentiation re-theme" with sub-issues: theme tokens + fonts → tab bar → home
   reorder + Journey strip → screen-by-screen sweep → site + store screenshots.
3. Contrast re-validation (repeat the AA audit) before TestFlight.

Because the app reads `styles/theme.js` tokens nearly everywhere, step 1's token swap gets ~80% of
the visual distance in a day; the tab bar and home reorder are each small, contained PRs.
