# Home screen color-scheme mockups

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
