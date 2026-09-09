# Design mockups

## Advertising concepts

Open [ad-campaigns/index.html](ad-campaigns/index.html) for six Facebook and
Instagram ad directions. Preview feed and Story formats, combine messages and
visuals, shortlist favorites, and download feedback or draft artwork. The gallery
is self-contained and works directly from a local file. See the
[campaign plan](../docs/marketing/ad-campaign-plan-2026-09-09.md) for the test
sequence and image-production briefs.

## Round 03 — The wine ampersand

Open `logo-round-3/index.html` for three AI-generated C & N concepts where the
ampersand becomes a wine glass. The PNG originals, generation prompts, and
interactive phone-size previews are included. The images also appear at the top
of the Round 02 gallery.

## Round 02 — Bordeaux and gold logos

Open `logo-round-2/index.html` for the refined first four concepts, four C & N
lettering options, and four generated raster explorations. The defining composition
is a Bordeaux square with a gold circle inside it. See `logo-round-2/README.md` for
controls, exports, and the saved image-generation briefs.

## Logo identity collection

Open `logo-concepts.html` directly in any modern browser (no build or server needed):

```sh
open mockups/logo-concepts.html
```

Eight original SVG concepts explore Cork & Note’s wine-journal identity using the
current Château Label palette and Georgia/system typography from `styles/theme.js`.
The login and home source screens informed the illustrative placements. The home
header signature is a proposal; example account and wine data are fictional.

| Direction | Idea |
| --- | --- |
| 01 · The Tasting Nib | Wine glass and fountain-pen nib |
| 02 · Estate Monogram | Custom C and N letterforms |
| 03 · The Cork Seal | Cork-end stamp, C, and note lines |
| 04 · Open Journal | Open pages with a wine-glass center |
| 05 · Vineyard Bookmark | Saved vineyard landscape |
| 06 · A Place to Remember | Winery pin with a wine-glass opening |
| 07 · The Bottle Label | Bottle with a folded-note label |
| 08 · The Last Drop | C-shaped wine swirl and a drop |

The gallery supports:

- Bordeaux, cream, and noir/gold icon treatments; rounded, circular, and square crop previews.
- Welcome, compact app header, store-listing, and phone home-screen placements.
- 128, 64, 48, 32, and 16 CSS-pixel previews, plus single-color marks on light and dark.
- Local favorites and notes, with a downloadable feedback text file and print/PDF view.
- Square icon PNG exports at 32, 64, 128, 256, 512, and 1024 pixels; icon, transparent
  symbol, and transparent symbol/name SVG exports. Crop masks are preview-only.

Everything runs locally; no remote fonts, libraries, or services are needed. Notes
stay in browser storage when available; download feedback to retain or share it
across browsers. `logo-concepts-preview.png` is a static desktop overview.

These are review assets, not a finalized launch icon package. After a direction is
selected, refine the small-size geometry, outline the approved wordmark lettering,
and prepare/validate the platform-specific app, adaptive, splash, favicon, and
store artwork. Current production image assets and Expo configuration are unchanged.

## Home screen color-scheme mockups

Design exploration for the Cork &amp; Note home tab. `home-color-schemes.html` renders the
**real** home-screen layout (stat strip, Tonight's Pick, Ready-to-Drink, Log-a-wine hero,
cellar &amp; insights cards, recent wines, Where-you've-been, Sommelier) inside a phone frame,
**nine times**, each in a different palette — so palettes can be judged in context rather than
on abstract swatches.

Open it in any browser:

```
open mockups/home-color-schemes.html
```

`home-color-schemes-preview.png` is a static overview of all nine (regenerate it with headless
Chrome if the HTML changes):

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=720,4000 --screenshot=mockups/home-color-schemes-preview.png \
  "file://$(pwd)/mockups/home-color-schemes.html"
```

## The nine schemes

Every color is sampled from wine — Bordeaux/garnet, oak &amp; cork, rosé, champagne, gold.

| Scheme | Notes |
| --- | --- |
| **Château Classic** | Current app look — Bordeaux burgundy + estate gold on warm cream (reference) |
| **Midnight Cellar** | Same red + gold on a dark espresso room |
| **Estate Sage** | Red + gold on cool sage-grey neutrals |
| **Champagne Noir** | Luxe charcoal-black + rich gold on champagne |
| **Barrel Room** | Oak-barrel browns, cork &amp; caramel, oxblood-red anchor |
| **Provence Rosé** | Dusty blush + peach, deep garnet + soft gold |
| **Harvest Vine** | Burgundy + burnt-sienna + olive vine-leaf on parchment |
| **Cabernet Noir** | Wine-stained near-black glowing with garnet + gold (dark) |
| **Golden Hour** | Luminous Sauternes gold leading, anchored by a wine red |

## How it's built

The phone markup is shared; each scheme is a small object in the `SCHEMES` array that sets
CSS custom properties (`--bg`, `--accent`, `--gold`, `--hero-bg`, …). To add or tweak a scheme,
edit that array — no markup changes needed. The palette tokens mirror `styles/theme.js`
(`colors.primary`, `colors.gold`, `colors.neutral`, drink-window status colors), so a chosen
direction maps directly onto the real theme.

> These are static design mockups, not wired into the app. Nothing here is imported by the
> Expo build.
