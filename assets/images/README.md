# App images

Current assets derive from `brand-mark.png`: Royal Velvet purple with a gold
wine glass, fountain-pen-nib cutout, and enclosing circular gold ring. Generated
with the built-in imagegen tool on 2026-09-10 using the previous Bordeaux
Tasting Nib logo as the reference. The unchanged 1254×1254 PNG master is preserved.
The color brief is purple `#54258A` and gold `#D6B45D`; generated raster pixels
can vary slightly from the exact UI tokens.

| File | Use | Packaging |
| --- | --- | --- |
| `brand-mark.png` | Generation master | 1254×1254 opaque PNG |
| `icon.png` | App icon | 1024×1024 opaque square |
| `adaptive-icon.png` | Android adaptive foreground | 1024×1024, artwork scaled to 720×720 for mask safety |
| `splash-icon.png` | Light and dark splash | 800×800 rounded tile with transparent corners |
| `cork_and_note_logo.png` | Authentication | 600×600 rounded tile with transparent corners |
| `favicon.png` | Web favicon | 196×196 opaque PNG |

One consistent purple-and-gold brand tile serves both modes. Native splash
backgrounds are ivory `#FAF8F4` and midnight `#191321`; the Android adaptive
backdrop is purple `#54258A`. Scaling and padding keep the ring in the safe circle.

Run `bash scripts/generate-icons.sh` to package derivatives from the master.
The script also updates the shared site logo, favicon and social image; it does
not redraw the symbol or recolor the master. The retired Spritz master is at
`archive/spritz-2026-09-09/brand-mark.png`.

See [the design record](../../docs/design/royal-velvet-appearance.md) for the prompt
and theme implementation. Native icon and splash changes require a native rebuild.
