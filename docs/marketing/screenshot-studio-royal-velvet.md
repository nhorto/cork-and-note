# App Store Screenshot Studio — Royal Velvet

The screenshot builder lives at [`mockups/appstore-screenshot-studio.html`](../../mockups/appstore-screenshot-studio.html). It replaces the earlier Spritz-palette builder that only existed in the owner's Downloads folder, restyled around the **Royal Velvet** theme from PR #232 and rebuilt to match the visual level of commercial App Store template sets (bold display headlines with highlighted keywords, eyebrow chips, gradient backgrounds with panoramic gold-wave art, realistic device frames with side buttons and layered shadows, hero/tilted/edge-crossing compositions).

## Two copies

- **Repo copy** (`mockups/appstore-screenshot-studio.html`): source of truth, no embedded screenshots. The "ready-made set" button explains it is disabled in this copy.
- **Distributable copy** (owner's `Downloads/Cork-and-Note-App-Store-Studio.html`): built by `scripts/embed-studio-screenshots.mjs`, which embeds the brand mark plus JPEG data-URLs of real captures so the one-click **Load the ready-made set** works offline.

Rebuild the distributable after changing the studio or recapturing:

```sh
# JPEG-encode the captures you want to embed (keys must match PREBUILT_SET)
sips -s format jpeg -s formatOptions 80 docs/marketing/screenshots-royal-velvet/1-home.png --out /tmp/embed/1-home.jpg   # …etc
node scripts/embed-studio-screenshots.mjs /tmp/embed site/assets/favicon.png ~/Downloads/Cork-and-Note-App-Store-Studio.html
```

## Ready-made set (7 slides, iPhone 6.9″)

Real captures of the demo account (`review@corkandnote.com`, seeded data, Pro enabled) from the iPhone 16 Pro Max simulator running the PR #232 branch. Raw 1320 × 2868 PNGs: [`docs/marketing/screenshots-royal-velvet/`](screenshots-royal-velvet/). `7-map.png` and `9-dark-cellar.png` are spares that are captured but not in the default set.

| # | Eyebrow | Headline | Capture |
| - | ------- | -------- | ------- |
| 1 | YOUR WINE JOURNAL | Remember every wine *you love*. | `1-home` — home with Journey card |
| 2 | AI SOMMELIER | Ask anything. *Sip smarter.* | `4-sommelier` — Tonight's Pick |
| 3 | SCAN A LABEL | Snap the label. *We fill it in.* | `2-log` — Add-wine form with scan card |
| 4 | YOUR TASTINGS | Your taste, *in your words*. | `6-journal` — rated tastings list |
| 5 | WINE CELLAR | Know what's *ready* to open tonight. | `5-cellar` — readiness badges |
| 6 | WINERY PASSPORT | Your winery *passport*. | `3-winery` — Barrel Oak with visited badge |
| 7 | PURPLE AFTER DARK | Beautiful, *after dark*. | `8-dark-home` — dark-mode home |

## Capturing (dev-client pipeline)

`scripts/capture-screenshots.sh` remains the EAS-simulator-build variant. `scripts/capture-devclient-screenshots.sh` is the variant used here: it drives the **dev client** already installed on the booted simulator, loading JS from a Metro instance started from the target branch's worktree with `EXPO_PUBLIC_SCREENSHOT_MODE=1` exported, e.g.

```sh
EXPO_PUBLIC_SCREENSHOT_MODE=1 npx expo start --dev-client --port 8092 --localhost
CORKNOTE_DEMO_PASSWORD=… ./scripts/capture-devclient-screenshots.sh 8092 out light \
  "1-home:/(tabs)/home:20" "5-cellar:/(tabs)/cellar:20" …
```

It reads the Supabase anon key from `.env` (the Management API token can no longer `reveal` keys), signs in as the demo account, writes the session + `__screenshot_route__` into the app's AsyncStorage, then launches the app and opens the `corkandnote://expo-development-client/?url=…` deep link so the dev client loads the right Metro rather than its launcher screen. Third argument switches `light`/`dark` appearance. Capture the map route last — its location permission alert would pollute later shots.

## Studio notes

- Headlines support `*stars*` to color words in the highlight color (punctuation right after a span sticks to it). The old "accent the final line" checkbox still applies when no stars are used.
- Templates: Royal Velvet · Ivory, Purple After Dark, Royal Purple · Bold, Ivory Gallery · Clean. All palette values from `styles/theme.js` on PR #232.
- Project files are version 3; version 2 (Spritz-era) project files still open and are migrated (theme, font, ribbon→background art).
- Everything else — exact-size 24-bit RGB PNG export, ZIP with manifest, validation, local persistence, drag/crop/undo — carries over from the previous builder unchanged.
