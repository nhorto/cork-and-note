# App Store Screenshot Studio — Royal Velvet

The screenshot builder lives at [`mockups/appstore-screenshot-studio.html`](../../mockups/appstore-screenshot-studio.html). It replaces the earlier Spritz-palette builder that only existed in the owner's Downloads folder, restyled around the **Royal Velvet** theme from PR #232 and rebuilt to match the visual level of commercial App Store template sets: bold display headlines with `*starred*` keyword highlighting, eyebrow chips, gradient backgrounds with panoramic gold-wave/glow art, realistic device frames (side buttons, layered shadows), and hero / tilted / edge-crossing / two-phone compositions.

## Two copies

- **Repo copy** (`mockups/appstore-screenshot-studio.html`): source of truth, no embedded screenshots. The "ready-made set" button explains it is disabled in this copy.
- **Distributable copy** (owner's `Downloads/Cork-and-Note-App-Store-Studio.html`): built by `scripts/embed-studio-screenshots.mjs`, which embeds the brand mark plus JPEG data-URLs of real captures so the one-click **Load the ready-made set** works offline.

Rebuild the distributable after changing the studio or recapturing (JPEG names must match the `PREBUILT_SET` keys):

```sh
sips -s format jpeg -s formatOptions 80 docs/marketing/screenshots-royal-velvet/home.png --out /tmp/embed/home.jpg   # …etc
node scripts/embed-studio-screenshots.mjs /tmp/embed site/assets/favicon.png ~/Downloads/Cork-and-Note-App-Store-Studio.html
```

## Ready-made set (6 slides, iPhone 6.9″)

Ordered on the owner's three marketing pillars (2026-09-10): **remember/journal**, **a sommelier that learns your palate**, **explore wineries and log right there** — plus the cellar. No dark-mode slide. Ships in the **Velvet Duotone** (ivory→purple) treatment; switching templates on a loaded set restyles colors only and keeps the curated layouts.

| # | Eyebrow | Headline | Capture(s) |
| - | ------- | -------- | ---------- |
| 1 | YOUR WINE JOURNAL | Remember every wine *you love*. | `home` (hero) |
| 2 | LOG IT YOUR WAY | Your taste, *your words*. | duo: `wine-detail` behind, `log-form-filled` front |
| 3 | AI SOMMELIER | A sommelier that *learns your palate*. | `sommelier-ask` (tilt) |
| 4 | EXPLORE WINERIES | Find your *next favorite*. | duo: `map` behind, `winery` front |
| 5 | YOUR TASTINGS | Never forget *that bottle*. | `tastings` (bridge) |
| 6 | WINE CELLAR | Know what's *ready* to open tonight. | `cellar` |

Raw 1320 × 2868 PNGs: [`docs/marketing/screenshots-royal-velvet/`](screenshots-royal-velvet/). `log-form.png` (empty form with the scan card), `wine-detail-petit-manseng.png`, and the two `dark-*.png` files are spares not in the default set. All light-mode captures come from current `main` (post PR #231 log form + PR #232 theme) on the iPhone 16 Pro Max simulator, demo account with seeded data.

## Capturing

Three techniques were used; mix as needed:

1. **Route injection** (no build tooling): sign in as the demo account with the anon key from `.env` (the Management API token can no longer `reveal` keys), write the session + `__screenshot_route__` into the app's AsyncStorage, relaunch, screenshot. Works with any binary compiled with `EXPO_PUBLIC_SCREENSHOT_MODE=1` — the EAS `simulator` profile, or a dev client pointed at a Metro started with that variable exported (`scripts/capture-devclient-screenshots.sh`; it opens `corkandnote://expo-development-client/?url=…` so the dev client loads the right Metro — kill stale Metros first or the client reconnects to its cached one, and make sure the serving checkout is actually on the commit you think it is).
2. **`?ask=` on the sommelier tab** auto-sends a real question: routing to `/(tabs)/sommelier?ask=What%20should%20I%20try%20next…` with a ~45 s settle captures a genuine personalized answer (it referenced the demo account's own 5/5 Petit Manseng and home wineries).
3. **Maestro** (installed, v2.6) for states routes can't reach: filling the log form, tapping the 5th star twice for 4.5, expanding "Detailed ratings", and tapping segment positions. `hideKeyboard` does not work on the iOS sim — move focus between fields instead, and dismiss via a tap on static text or a scroll drag.

Environment prep that removes flakiness: `xcrun simctl privacy booted grant location com.nicholashorton.corkandnote` (kills the location alert), `xcrun simctl location booted set 38.9115,-77.9600` (Delaplane VA — Near You and the map show the seeded wineries instead of Charlottesville), status-bar override to 9:41, `xcrun simctl ui booted appearance light`.

## Studio notes

- Headlines support `*stars*` to color words in the highlight color (punctuation right after a span sticks to it; a lone unmatched `*` stays literal). The old "accent the final line" checkbox still applies when no stars are used.
- Templates: Royal Velvet · Ivory, Purple After Dark, Royal Purple · Bold, Velvet Duotone (ivory→purple), Ivory Gallery · Clean. Palette values from `styles/theme.js` on PR #232. Backgrounds hold the top color through the text zone before blending.
- Project files are version 3; version 2 (Spritz-era) project files still open and are migrated (theme, font, ribbon→background art).
- Everything else — exact-size 24-bit RGB PNG export, ZIP with manifest, validation, local persistence, drag/crop/undo — carries over from the previous builder unchanged.
