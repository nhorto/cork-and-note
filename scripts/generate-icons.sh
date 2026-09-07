#!/usr/bin/env bash
# Regenerate the app icon set from the master logo (#163).
#
# Run this again if the artwork changes:  ./scripts/generate-icons.sh
#
# Source: assets/images/cork_and_note_logo.png — a 1024x1024 lockup of the C&N
# monogram, the glass/book mark, and the "Cork & Note" wordmark on cream.
#
# The wordmark is deliberately DROPPED from the app icon: at the 60x60pt the
# home screen actually renders, it is unreadable mush. The icon uses just the
# monogram + mark, which stays legible. The splash keeps the full lockup,
# because it is displayed large enough to read.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/images/cork_and_note_logo.png
OUT=assets/images
CREAM='#F9F4EE'          # the master file's own background — used as-is so
                         # composited canvases never show a seam against it
LOGO_BG='#F9F4EE'        # same value, keyed out for the transparent foreground

# Content boxes measured from the master (fuzz-trimmed):
#   mark (monogram + glass/book):  443x478+291+189
#   full lockup incl. wordmark:    684x631+169+189
#
# The mark is isolated by cropping off the bottom third (which holds the
# wordmark) and trimming to content, then re-canvassed onto a flat fill of the
# master's OWN background colour, so the composite shows no seam.
MARK=$(mktemp -t cn-mark).png
magick "$SRC" -crop 1024x660+0+0 +repage -fuzz 8% -trim +repage "$MARK"

# 1. iOS/base app icon — content at ~60% of the frame, comfortably inside
#    Apple's rounded-rect mask. NO alpha channel: the App Store rejects icons
#    that have one.
magick "$MARK" -resize x610 -background "$CREAM" -gravity center \
  -extent 1024x1024 -alpha remove -alpha off -strip "$OUT/icon.png"

# 2. Android adaptive foreground — transparent, sized for the central 66% safe
#    zone, since the launcher mask can crop anything outside it.
magick "$MARK" -fuzz 12% -transparent "$LOGO_BG" -resize x520 \
  -background none -gravity center -extent 1024x1024 -strip \
  "$OUT/adaptive-icon.png"

# 3. Splash — the full lockup, wordmark included, with breathing room.
magick "$SRC" -fuzz 8% -trim +repage -resize 900x900 \
  -background "$CREAM" -gravity center -extent 1200x1200 \
  -alpha remove -alpha off -strip "$OUT/splash-icon.png"

# 4. Web favicon.
magick "$MARK" -resize x120 -background "$CREAM" -gravity center \
  -extent 196x196 -alpha remove -alpha off -strip "$OUT/favicon.png"

rm -f "$MARK"

echo "Regenerated:"
magick identify "$OUT/icon.png" "$OUT/adaptive-icon.png" "$OUT/splash-icon.png" "$OUT/favicon.png"
