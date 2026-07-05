# Full-App Design Review — Cork & Note

**Review date:** 2026-07-05
**Branch reviewed:** `claude/objective-panini-9356f0` (even with `main` @ a874ce9 at review time)
**Scope:** all 18 screens and all 43 shared components, audited against `styles/theme.js` ("Château Label" design system), with WCAG 2.1 contrast computed for every flagged color pair.
**Direction (Nick's choice):** keep the Château Label identity — burgundy/gold/cream, Georgia serif — and polish it. No rebrand. Dark mode is planned separately (mockup exists on another machine).
**Visual companion:** [`docs/design/design-review-2026-07-05.html`](../design/design-review-2026-07-05.html) (also published at https://claude.ai/code/artifact/a356ab80-70d0-4bd3-83f2-6be68b6550ba) — renders the palette, failing pairs, before/after login mockups, and component galleries.

---

## Verdict

The design system itself is good: charcoal/cream body text measures 13.2:1, burgundy CTAs 9.7:1 (AAA), and the signed-in tab screens are nearly 100% token-driven (home.js has zero hardcoded colors). The problems are **drift and unfinished edges**, concentrated in three patterns:

1. The pre-login surface never got the rebrand.
2. Gold is used as *ink* (text) when it only works as *decoration*.
3. The same concept (chip, button, header) was redrawn slightly differently each time it was needed.

## Contrast, measured (WCAG 2.1)

### Solid pairs (keep)
| Pair | Ratio | Grade |
|---|---|---|
| charcoal `#2C2C2C` / cream `#FAF8F5` | 13.2 | AAA |
| graphite `#4A4A4A` / parchment `#F5F2ED` | 7.9 | AAA |
| cream / burgundy `#722F37` (primary buttons) | 9.7 | AAA |
| burgundy / cream | 9.1 | AAA |
| error `#9B3B3B` / cream | 6.4 | AA |

### Failing pairs (all shipping at review time)
| Pair | Where | Ratio |
|---|---|---|
| gold.rich `#C9A962` on gold.light `#E8DCC8` | "In your cellar" badge, wines tab (wines.js:732) | **1.66** |
| `#3E3E3E` on `#000` | register.js Apple button label (:257/:404) | **1.96** |
| gold.shimmer `#B8976A` on gold.light | Tonight's Pick flavor chips (TonightsPickCard.js:598) | **2.02** |
| silver `#A8A8A8` on parchment | dates/disclaimers/"optional" tags app-wide | **2.13** |
| gold.shimmer on cream/parchment | the standard 11px section-caption treatment app-wide | **2.45–2.58** |
| cream on gold.shimmer | "Too young" drink-window badge at 9px (cellar.js:748) | **2.58** |
| `#b08442` on `#8C1C13` | login & register primary CTA label | **2.72** |
| rosé `#D4A5A5` on burgundy | hero sub-copy, chat timestamps at 10–13px | 4.47 (large-only) |
| pewter `#7A7A7A` on parchment | 11–13px metas app-wide | 3.84 (large-only) |
| cream on slate `#6B7B8B` | wishlist badges at 9–13px | 4.10 (large-only) |

### Accepted replacement tokens (proposed, validated, NOT yet applied)
- `gold.text: '#7E6430'` — 5.28:1 on cream, 5.01:1 on parchment (AA). For captions and any gold that must be read. Keep `#C9A962`/`#B8976A` for rules, borders, stars, icons.
- pewter → `#6E6E6E` — 4.81/4.57 on cream/parchment (AA).
- Badges: dark ink on gold ground (charcoal on gold.rich = 6.21, merlot = 5.77) instead of white-on-gold; keep white text on sage/slate only at ≥11px.

## Findings

### I. CRITICAL — The app has two brands; guests see the wrong one
`app/index.js`, `login.js`, `register.js`, `forgot-password.js` import zero theme tokens. They use near-miss red `#8C1C13` (not wine `#8B1A1A`), flat gray `#E7E3E2`, `#3E3E3E`, Bootstrap grays `#f8f9fa`/`#e9ecef` + Material green `#4CAF50` (password checklist), and the pre-rebrand purple `#8E2DE2` (splash spinner in index.js; forgot-password success icon + both CTAs). No serif type appears before login. Also found there: login logo styled 680px wide with borderRadius 900; button-casing drift ("Log In" vs "Sign In"). *Status: NOT yet rethemed (top roadmap item). The dead social buttons/undefined styles found here were fixed in the 2026-07-05 code-fix commits.*

### II. CRITICAL — Gold is decoration, not ink
The `gold.shimmer` 11px caption is the standard section-label treatment on nearly every screen (2.45:1). Gold-tinted cards put gold text on gold (home sommelier card, Tonight's Pick chips). Gold badges put cream text on gold ground at 9px. Rule going forward: gold.rich/shimmer touch nothing smaller than an icon; readable gold = `gold.text #7E6430`. *Status: OPEN.*

### III. BUG — `borderRadius.full` didn't exist
Chips referencing it rendered square (undefined) in 8 files: WineEntryForm (:957, :1242), WineCard (:258, :315), FlavorTagSelector (:295, :356, :407), RatingSlider (:149), WineryStatusBadges (:68), PastVisitsSection (:636), wines.js (:874). *Status: FIXED — `full: 999` added to theme (commit 13c6d39).*

### IV. CONSISTENCY — One concept, many designs
- **Primary buttons, 3 recipes:** radius 4 + sans (cellar forms, filter apply) · radius 8 + Georgia label (LogSessionForm, PlacePicker) · radius 8 + h3 serif (BottlePairing, TonightsPickCard).
- **Cancel buttons, 3 recipes:** parchment/stone radius 8 (WineEntryForm) · radius 12 (PinActionModal) · transparent + burgundy border radius 4 (TastingLinkCard).
- **Flavor chips, 3 colorways:** rosé bg/burgundy text (selected strip) · burgundy bg/cream text (palette) · gold.light/gold.shimmer (Tonight's Pick, 2.0:1).
- **Rating displays, 4 patterns:** star row + "N.N/5" · bordered score pill 13px · bare 12px star+number · 16px star+number. Star gold is consistent; sizes 12/13/16/28 are not.
- **Screen headers, 3 recipes:** SafeAreaView + chevron-back + h2-20 serif (wine/winery/LogSessionForm) vs `paddingTop: 60` (all cellar screens, 4 tab screens) vs `paddingTop: 50` + arrow-back + raw 18 (all profile screens; help-support's title has no serif at all).
- **Field labels:** gold.shimmer captions in the tasting flow vs pewter captions in the cellar flow. **Inputs:** parchment bg + sometimes-Georgia (tasting flow) vs cream bg + sans (cellar flow).
- **Bottom sheets:** handle 36w vs 40w; backdrop 0.4 vs 0.6; padding xl vs xxl.
- **Two FAB shapes:** map = 56px rounded-16 square; cellar = 56px circle.
- **Wine-type → color maps diverge** (WineCard 7-case with hardcoded `#E8A259`, LogSessionForm red/white-else-rosé, VisitStatsCard third variant) — same wine renders different colors on different screens.
*Status: OPEN. Highest-leverage fix: extract a shared `<ScreenHeader>`; then standardize one button/chip/label recipe each.*

### V. ACCESSIBILITY
- De-facto icon button is 40×40 (HIG minimum 44); worst: profile back buttons ~34px, LogSessionForm place edit/clear 32px, ChatInput photo-remove ~18px, flavor chips ~26px tall.
- Of ~30 icon-only touchables, only 3 had `accessibilityLabel` (tab-bar +, TonightsPickCard collapse, PastVisits edit link). Every ×, ‹, ✎, eye toggle, stepper is silent to screen readers. (The new reset-password screen's controls are labeled.)
- `tabBarAllowFontScaling: false`; fixed font sizes app-wide; 9–10px text (cellar badge 9px, chat timestamp 10px, filter-count 10px) below the theme's own 11px caption floor.
- RatingSlider: 24px thumb, 0.1 steps, no `accessibilityRole="adjustable"`, no tap-to-set.
*Status: OPEN.*

### VI. PLATFORM — Android is quietly sans-serif
Georgia is not an Android font. Only 5 components guard with `Platform.OS === 'ios' ? 'Georgia' : 'serif'` (WineChatModal, LabelScanner, TastingMenuScanner, BottlePairing, TonightsPickCard); ~15 files hardcode `'Georgia'` and silently fall back to sans on Android. Nobody reads `typography.fonts.serif`. Fix: put the Platform.select in the theme token and use it everywhere; longer-term bundle Playfair Display/Lora via expo-font. *Status: OPEN (reset-password.js uses the guarded pattern).*

### VII. POLISH — states, motion, leftovers
- Error states were the weakest link (fetch failures rendered onboarding/zeros) — *FIXED in code-fix commits (inline error + retry on cellar/home/map/wines; cache no longer pins failures).*
- Motion & haptics: zero. Sommelier typing dots and "Thinking…" are static text; no animations beyond modal defaults. Cheap wins: animate typing dots, haptic on center-tab + save success, fade-in Tonight's Pick. *OPEN.*
- Shipped placeholders: "Rate Cork & Note" `idXXXXXXXXXX` (*FIXED — removed*), fake notifications toggle (*FIXED — removed*), "Delete Account" → "Feature Coming Soon" (*OPEN*), canned winery About sentence "Discover this winery…" for every winery (*OPEN*), `user@example.com` fallback in profile (*OPEN*), template 404 (*FIXED — rethemed*), hardcoded v1.0.0 (*FIXED — expo-constants*).
- Copy: Title Case (older screens: "Update Password", "Apply Filters") vs sentence case (newer: "Add a bottle", "Log a wine") — standardize on sentence case; "…" vs "..."; "Log In" vs "Sign In". *OPEN.*
- Loading-state quirks: wishlist imports ActivityIndicator but renders a static icon; VisitStatsCard's loading "dot" doesn't animate. *OPEN.*

### VIII. From Nick's own usage notes (notes from using the app.txt)
- **Overall rating placement** — should move to the bottom of the wine entry form (rate last, after detailed impressions). *OPEN.*
- **Wines-tab filters overflow horizontally** with real data volumes — reuse the cellar's filter-sheet pattern (searchable facets, live count). *OPEN.*
- **Map help button** — first-run hint banner disappears forever once pins exist; add a "?" affordance to re-summon it. *OPEN.*
- **Winery modal → page** — winery detail page exists; make "View winery" the pin modal's primary action. *OPEN.*
- **Custom tasting note RLS error** — root-caused and fixed (see code review doc).

## What works well (keep)
- The identity itself — distinctive, warm, right for the subject.
- Tab screens are ~100% token-driven; home.js has zero hardcoded colors.
- State design where attempted is excellent: cellar's example-data onboarding, Tonight's Pick's five-state matrix, the scanners' fail-soft retry flows, register's live password checklist.
- Ceremonial details: gold hairlines, line-diamond-line dividers, raised burgundy center tab.

## Priority roadmap
1. **Retheme the four pre-login screens** with existing tokens; kill the purple. (~½ day) — OPEN
2. **Add `gold.text`, darken pewter, fix badge inks** — clears 9 of 11 failing pairs. (~½ day) — OPEN
3. ~~Add `full: 999` to borderRadius~~ — **DONE** (13c6d39)
4. **Extract `<ScreenHeader>`** (safe-area, 44px targets, one back icon, labeled) for all 14 detail/profile screens. (~1 day) — OPEN
5. **Platform-guard the serif via the theme token**; replace raw 'Georgia'. (~2 hrs) — OPEN
6. **Standardize button/chip/label recipes + sentence case sweep.** (~1 day) — OPEN
7. **A11y labels + 11px floor + haptics/typing animation** (error-state cards already done). (~1–2 days) — OPEN
8. ~~Delete dead components & template leftovers; retheme the 404~~ — **DONE** (1a46827)

All items are additive to the current system and compatible with the planned dark mode; the `gold.text`/pewter tokens give dark mode a cleaner starting point.
