# App images

Every current logo asset derives from `brand-mark.png`: the selected **Spritz /
bolder (option 3)** ivory wine glass with a fountain-pen nib on coral, without
an enclosing ring. The master is an unchanged copy of the approved
`03-spritz-bold-symbol.png` from Downloads, selected on 2026-09-09.

| File | Used by | Notes |
| --- | --- | --- |
| `brand-mark.png` | Regeneration source | Original 1254×1254 PNG; preserve the selected artwork. |
| `icon.png` | `app.json` → `expo.icon` | 1024×1024, full bleed, no alpha channel. |
| `adaptive-icon.png` | `app.json` → `android.adaptiveIcon` | 1024×1024 with safe-zone padding. |
| `splash-icon.png` | `expo-splash-screen` | 800×800 rounded tile with transparent corners. |
| `cork_and_note_logo.png` | Login and forgot-password screens | 600×600 rounded tile with transparent corners. |
| `favicon.png` | `app.json` → `web.favicon` | 196×196, full bleed. |

The same master supplies `site/assets/logo.jpg` (512×512),
`site/assets/favicon.png` (64×64), and `site/assets/og-image.jpg` (1024×1024).

## Regenerating

With ImageMagick installed, run from the repository root:

```sh
bash scripts/generate-icons.sh
```

This resizes and packages the approved PNG; it does not generate new artwork.
The script retains RGB color detail and strips derivative metadata. The master
remains unchanged.

## Android safe zone

Android launchers apply different masks. The master is scaled to 720×720 inside
a 1024×1024 canvas, keeping the glass within the central safe circle. The 152px
margin replicates source edge pixels to avoid a visible seam against the render's
subtle coral variation. The adaptive background in `app.json` uses Spritz coral
`#E4573D`.

Splash and authentication tiles retain corner radii of approximately 22.4%.
`archive/` holds retired images; see its own README.
