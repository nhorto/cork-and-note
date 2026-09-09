# App images

Every icon below is derived from one master render, `brand-mark.png` — the gold
wine glass with a fountain-pen nib in the bowl, ringed in gold on textured
burgundy. Regenerate rather than hand-editing, so the set never drifts apart.

| File | Used by | Notes |
| --- | --- | --- |
| `brand-mark.png` | nothing at runtime | 1254×1254 master. Source for everything else. |
| `icon.png` | `app.json` → `expo.icon` | iOS / App Store. Full bleed, **no alpha** — Apple rejects an icon with an alpha channel. |
| `adaptive-icon.png` | `app.json` → `android.adaptiveIcon` | Android. See "the safe zone" below. |
| `splash-icon.png` | `app.json` → `expo-splash-screen` | Rounded tile on the cream splash background. |
| `cork_and_note_logo.png` | `app/login.js`, `app/forgot-password.js` | Same rounded tile, smaller. |
| `favicon.png` | `app.json` → `web.favicon` | Full bleed; a browser tab is too small for padding. |

## The safe zone

Android masks an adaptive icon to whatever shape the launcher wants — circle,
squircle, teardrop — and only the middle ~66% is guaranteed to survive. The gold
ring spans 84% of the master, so a full-bleed foreground would have its ring
sliced off on a circular mask. `adaptive-icon.png` therefore holds the master
scaled to 720px inside a 1024px canvas, which puts the ring comfortably inside
the safe circle.

The 152px margin that leaves is filled by replicating the master's edge pixels
outward, not with a flat colour: the burgundy is textured and vignetted, so a
flat fill left a visible square seam where it met the artwork.

## Regenerating

```sh
SRC=assets/images/brand-mark.png

magick "$SRC" -resize 1024x1024 -alpha off -colors 256 -strip PNG8:assets/images/icon.png

magick "$SRC" -resize 720x720 -virtual-pixel Edge \
  -set option:distort:viewport 1024x1024-152-152 -distort SRT 0 \
  -alpha off -colors 256 -strip PNG8:assets/images/adaptive-icon.png

magick "$SRC" -resize 800x800 \
  \( -size 800x800 xc:none -fill white -draw "roundrectangle 0,0,799,799,179,179" \) \
  -alpha set -compose DstIn -composite -colors 255 -strip PNG32:assets/images/splash-icon.png

magick "$SRC" -resize 600x600 \
  \( -size 600x600 xc:none -fill white -draw "roundrectangle 0,0,599,599,134,134" \) \
  -alpha set -compose DstIn -composite -colors 255 -strip PNG32:assets/images/cork_and_note_logo.png

magick "$SRC" -resize 196x196 -alpha off -colors 256 -strip PNG8:assets/images/favicon.png

oxipng -o 4 --strip safe assets/images/*.png
```

The corner radii are 22.4% of the edge, matching the iOS icon squircle closely
enough that the tile reads as "the app icon" when it appears inside the app.

`archive/` holds retired images; see its own README.
