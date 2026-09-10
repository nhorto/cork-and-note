#!/usr/bin/env bash
# Regenerate app and site assets from the selected master without redrawing it.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/images/brand-mark.png
OUT=assets/images

# Full-bleed iOS icon, with no alpha channel.
magick "$SRC" -resize 1024x1024 -alpha off -strip "PNG24:$OUT/icon.png"

# Keep the glass within Android's central safe circle. Extend the source
# edges to avoid a seam against the render's subtly varied purple background.
magick "$SRC" -resize 720x720 -virtual-pixel Edge \
  -set option:distort:viewport 1024x1024-152-152 -distort SRT 0 \
  -alpha off -strip "PNG24:$OUT/adaptive-icon.png"

# Preserve the existing rounded tiles for splash and authentication screens.
magick "$SRC" -resize 800x800 \
  \( -size 800x800 xc:none -fill white -draw "roundrectangle 0,0,799,799,179,179" \) \
  -alpha set -compose DstIn -composite -strip "PNG32:$OUT/splash-icon.png"

magick "$SRC" -resize 600x600 \
  \( -size 600x600 xc:none -fill white -draw "roundrectangle 0,0,599,599,134,134" \) \
  -alpha set -compose DstIn -composite -strip "PNG32:$OUT/cork_and_note_logo.png"

magick "$SRC" -resize 196x196 -alpha off -strip "PNG24:$OUT/favicon.png"

# The site build copies these committed derivatives without image tooling.
magick "$SRC" -resize 512x512 -alpha off -strip -quality 92 site/assets/logo.jpg
magick "$SRC" -resize 64x64 -alpha off -strip PNG24:site/assets/favicon.png
magick "$SRC" -resize 1024x1024 -alpha off -strip -quality 92 site/assets/og-image.jpg

echo "Regenerated app icons, authentication logo, splash, and site branding."
