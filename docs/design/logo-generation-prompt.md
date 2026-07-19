# Cork & Note — Logo generation prompt

A ready-to-paste prompt for an AI image model (Midjourney, DALL·E, Ideogram,
Firefly, etc.) to generate logo ideas and inspiration. It encodes the app
concept and the "Château Label" color scheme from `styles/theme.js`.

---

## Master prompt (copy/paste)

> Design a logo for **Cork & Note**, a premium mobile app that is a personal
> wine-tasting journal. The app lets wine lovers log winery visits and tastings
> — recording wines, varietals, ratings, flavor notes, and photos — track the
> bottles in their cellar, and chat with an AI sommelier for pairing advice.
> The brand personality is elegant, refined, warm, and timeless, inspired by
> classic French château wine-label typography and estate craftsmanship. It
> should feel like an embossed label on a fine bottle — sophisticated and
> understated, never trendy, techy, or cartoonish.
>
> **Core idea:** marry the two halves of the name — "Cork" (wine) and "Note"
> (a journal / tasting notes). Explore pairings such as a wine glass beside an
> open notebook, a bottle cork stylized as a book spine, a fountain-pen nib
> formed from a falling wine drop, an elegant "C&N" serif monogram, or a
> wax-seal estate-crest emblem.
>
> **Color palette (use these exact tones):**
> - Deep Bordeaux burgundy `#722F37` and rich wine red `#8B1A1A` as the primary
>   color, with darker merlot `#5C1A1A` for depth.
> - Estate gold `#C9A962` as an elegant metallic accent — thin rules, borders,
>   flourishes only, used sparingly and never gaudy.
> - Warm paper neutrals: cream `#FAF8F5` and parchment `#F5F2ED` backgrounds,
>   charcoal `#2C2C2C` for dark elements.
> - Optional soft rosé `#D4A5A5` for a subtle accent.
>
> **Style:** minimal, iconic, and scalable — must read clearly as a small app
> icon and in a single flat color. Prefer clean vector line work or a refined
> serif monogram over photorealism. Thin gold hairline rules, subtle wine-label
> symmetry, generous negative space, flat or lightly embossed. Wordmark set in
> an elegant high-contrast serif (Playfair Display / Lora feel), light weight
> with a little letter-spacing.
>
> **Avoid:** cartoon styles, heavy 3D or busy gradients, cheap clip-art wine
> glasses, drop shadows, neon colors, and photographic realism.
>
> **Deliverables:** several distinct concepts, including (1) a full lockup with
> an icon plus the "Cork & Note" wordmark, and (2) a standalone app-icon mark
> that works inside a rounded square. Show each on both a cream/parchment
> background and a deep burgundy background.

---

## Palette quick-reference

| Role | Name | Hex |
| --- | --- | --- |
| Primary | Bordeaux burgundy | `#722F37` |
| Primary highlight | Wine red | `#8B1A1A` |
| Primary depth | Merlot | `#5C1A1A` |
| Accent metal | Estate gold | `#C9A962` |
| Soft accent | Rosé | `#D4A5A5` |
| Background | Cream | `#FAF8F5` |
| Card background | Parchment | `#F5F2ED` |
| Dark / text | Charcoal | `#2C2C2C` |

One-line palette (for models with short prompt fields):
`Bordeaux burgundy #722F37 + estate gold #C9A962 on warm cream #FAF8F5, charcoal #2C2C2C ink.`

---

## Concept seeds (swap into the "Core idea" line for variety)

Run the master prompt several times, replacing the core-idea sentence with one
of these to explore different directions:

1. **Monogram** — an elegant serif "C&N" monogram with a thin gold hairline
   underline, styled like an embossed wine-label crest.
2. **Glass + journal** — a minimalist line-art wine glass next to a small open
   notebook or ruled page, balanced side by side.
3. **Cork as book spine** — a wine cork stylized so it doubles as the spine of a
   closed book / journal.
4. **Pen-nib wine drop** — a single drop of wine whose point becomes a fountain-
   pen nib, symbolizing tasting notes.
5. **Estate crest / wax seal** — a circular wax-seal emblem containing a vine,
   grape cluster, or "C&N" mark with a fine gold border.
6. **Vine bookmark** — an open journal with a curling grapevine tendril acting as
   a ribbon bookmark.

---

## Tips

- Generate at a **1:1 square** for app-icon exploration; also try a **wide**
  aspect for the horizontal wordmark lockup.
- Ask for a **flat vector / SVG-style** result so it stays crisp when scaled down
  to a favicon or tab-bar size.
- Test every candidate at small size and in **single-color burgundy** — a good
  mark survives both.
- The current placeholder logo (`assets/images/cork_and_note_logo.png`) pairs a
  burgundy "C&N" monogram with a wine glass + notebook and a serif "Cork & Note"
  wordmark on cream — useful as a reference for the intended feel.
