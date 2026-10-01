# Competitive landscape (2026-09-30, V1 submitted)

Research on the wine apps a user might pick instead of Cork & Note, what they do, what their reviews praise and complain about, and what that means for the next release. Ratings and prices come from the US App Store on 2026-09-30 unless noted.

Our target persona (owner, 2026-09-30): **winery tourists and casual enthusiasts first**, light collectors second. The cellar is a feature, not the core. Social features are wanted but not yet defined.

## TL;DR

- **No competitor combines a tasting journal, an AI sommelier that knows you, a cellar, and winery visits/trips.** The big apps each own one piece: Vivino (discovery and buying), CellarTracker and InVintory (serious cellars). The AI apps mostly do one job.
- **Winery visits are the clearest gap.** None of Vivino, Delectable, CellarTracker, InVintory, Hello Vino or Cork has a visits feature. Only small regional passport apps and a few 0-rating apps touch it. Our 14.5K-winery US map, visits and trip planner make up the moat, and they match the target persona.
- **The biggest all-in-one threats are both 2026 launches:** **Sommo** (4.8 from 60 ratings, $29.99/yr, 3D racks, Taste DNA, blind tasting parties) and **Cork – Wine Journal & Maps** (Swiss, $2/mo, cellar-aware "Ask Cork", vineyard atlas, no visits).
- **Pricing:** no app pairs a one-time unlock with AI credits. "Own the app, pay only for the AI you use, no subscriptions" is a real differentiator against the $5–7/week scanner apps that users hate.
- **Premium feel is our weakest area:** system fonts, almost no motion, leftover template assets. InVintory and Cork set the bar.

## Competitor summary

| App | Rating (count) | Model / price | Owns | Notable weakness |
|---|---|---|---|---|
| Vivino | 4.8 (138K) | Free + ads; Premium ~$5–6/mo, ~$48–57/yr | Label scan, 70M crowd ratings, marketplace, Match % | Ads *and* paywall, features taken back, weak cellar, "feels like a shop" |
| Delectable | 4.7 (26K) | $5.99/mo premium | Social feed of somms/critics | Abandoned since 2021; can't search own history; public-by-default profiles |
| CellarTracker | 4.9 (13K, new app) | $40–500/yr by cellar size | Collector data, valuation, CellarChat AI | New app has more taps and less info per screen; crowded; spreadsheet feel |
| InVintory | 4.8 (4.8K) | Free; $99.99–149.99/yr | 3D cellar (VinLocate), Vincent AI, widgets, Siri, import | Paywall pushback; fiddly 3D setup; ~25% scan misses |
| Hello Vino | 4.6 (6.7K) | Small IAPs | Beginner picks and pairings | Abandoned since 2017 |
| Pocket Wine | 4.69 (656) | $0.99/mo, $5.99/yr, $19.99 lifetime | Wine education reference | No scan, no AI; "held my database hostage" |
| **Sommo** | **4.8 (60)** | 5 free scans; $4.99/mo, $29.99/yr | All-in-one: 3D racks, SAT journal, Taste DNA radar, WSET prep, blind parties, CSV/PDF export | Subscription; no winery visits |
| **Cork – Wine Journal & Maps** | none yet (May 2026) | Free + Cork Plus $2/mo | Cellar-aware AI, 14.6K vineyard satellite atlas, palate charts, CellarTracker import | No visits; Europe/terroir focus |
| Winary | 5.0 (1) | €69/yr; free = 5 notes, 5 cellar items | 9M-wine database, fair-price check | Harsh free cap; no warmth |
| Cork Wine | 0 | Free | AI structured notes, flavor wheel | Dormant side project |
| Uncorked | 5.0 (5) | $4.99 paid up front | Memory-style journal ("every bottle has a story") | No AI |
| Wine Tripper | 0 (rebuilt Jul 2026) | Free | Winery map, check-ins, CarPlay | One-person project; no AI |
| Vinoperte | 4.7 (98) | Free | Wine-list scan → 3 ranked picks | Single purpose |
| Palett | 5.0 (3) | Free (B2B restaurants $100–250/mo) | Taste radar + "Wine Personality" | Consumer app is a funnel |
| Sommelio | none | $4.99/mo, $34.99/yr, $149 lifetime | Match score with reason; list/shelf scan | Few users |
| Vino AI | none | $2.99/wk or $29.99/yr (site differs) | Dish photo → wine | Tiny free tier |
| Wine Whisperer | none | Scan packs (3/£1.99) + Pro | Passport, check-ins, points, region battles | One update since launch |
| Hugo | 2.0 (1) | Credits only ($3.99–12.99) | Credits never expire; price shown before scanning | Single purpose |
| Vinea | 5.0 (2) | Tokens + subs (30 for $2.99 … 200 for $14.99) | Label/list scan, value flags | Most expensive |

Winery passport and trail apps with good ideas: CT Wine Passport and Ohio Wines VIP (geo check-ins, stamps, points, leaderboards), Wine Trails (GPS audio tours, "personal wine country atlas"), Map My WA Wine (shareable itineraries).

## What users consistently complain about (our openings)

1. **Ads plus paywalls, and features taken back** (Vivino, Hello Vino). A paywall on open or weekly plans (template scanner apps) gets the angriest reviews.
2. **Logging takes too many taps** (CellarTracker, Vivino redesigns). Entering a wine that isn't in the database is clunky (InVintory).
3. **Scan misses on obscure or older wines.** Every app misses 10–25%. A good correction flow matters as much as the hit rate.
4. **Weak search and filtering of your own history** (Delectable, CellarTracker).
5. **Data ownership.** Vivino's export leaves out notes; Pocket Wine locked existing data behind a paywall; Delectable profiles showed up on Google.
6. **Journal apps have weak cellars and cellar apps have weak journals.** No app does both well.
7. **Almost nobody tracks winery visits,** and nobody links visits to the journal or to the AI's picture of your palate.
8. **Thin Apple platform integration.** Only InVintory has widgets and Siri. None of the apps checked has a verified Apple Watch app or Live Activities.

## Where Cork & Note already stands

Already strong: logging with detailed ratings and ~185 flavor tags; winery tasting-card scan (many wines at once, which no competitor mentions); label scan; a 14.5K-winery US map with visited/wishlist; trip planning; an AI sommelier with Tonight's Pick from your own cellar, wine-list pick and a taste report; cellar with drink windows and reminders; 50 achievements; guest mode.

Gaps compared with the field:
- No palate visual (radar chart or personality title) that people would want to share.
- The wine-list pick doesn't use a "best match / safe bet / adventurous" format with value flags.
- No passport, stamps or check-in framing for visits, even though the data exists.
- No shareable cards and no social features at all.
- No import (Vivino, CellarTracker, CSV). Export covers tastings only, not the cellar, and is Pro-only.
- No offline log queue. Cell coverage in wine country is poor, so this matters for the core persona.
- No widgets, Live Activities or Siri shortcuts.
- No visual cellar. The 3D shelf is not in this repo; `docs/research/wine-cellar-ux.md` lists it as a non-goal.
- Premium feel: system fonts only (Playfair/Lora planned, never shipped), `react-native-reanimated` installed but unused, no `expo-image`, leftover template assets (`SpaceMono`, `react-logo*`), and old "Château Label" naming.

## Monetization notes for the credits + one-time unlock model

- Benchmarks:
  - Lifetime or up-front prices: Pocket Wine $19.99, Uncorked $4.99, Vino AI $79.99, Sommelio $149.
  - Credit pricing runs about $0.07–0.10 per scan (Vinea) up to about $0.40–0.66 in small packs (Wine Whisperer).
- Copy Hugo's rules: credits never expire and survive a reinstall; the cost scales with the job; the cost is shown before spending.
- Give a few free AI credits up front so the "wow" moment comes before any ask. Market the model as "No subscriptions."
- Keep the core journal, visits and a reasonable cellar free and unlimited. Reviews punish tight caps (Winary: 5 items) and data held hostage (Pocket Wine). Reconsider the free 25-bottle cellar cap and the proposal in PR #326 to make photos Pro: photos are the emotional core of memory-style journals.
- Unit economics to check before pricing credits: Sonnet chat with web search versus Gemini Flash scans have very different costs, so weight credits per action.
- Migration work: the code is subscription-based today (RevenueCat $9.99/mo and $59.99/yr, `entitlements`, `chat_usage` meters). Moving to credits needs RevenueCat consumables, a server-side credit ledger, and a plan for existing subscribers.

## Naming / App Store search

"Cork" is crowded (Cork, Cork Wine, Corked, Cork Club, Corkdork, CorkRules…). **Cork Notes** (corknotes.com, a pre-launch wine diary) is the closest name to ours: **check trademark**. Lead with the full "Cork & Note" name, plus a keyword subtitle such as "Wine Journal, Winery Map & Somm".

## Key sources

Vivino https://apps.apple.com/us/app/id414461255 · CellarTracker https://apps.apple.com/us/app/id6446102275 · InVintory https://apps.apple.com/us/app/id1434754695 · Delectable https://apps.apple.com/us/app/id512106648 · Sommo https://apps.apple.com/us/app/id6757319027 · Cork https://apps.apple.com/us/app/id6766049243 · Winary https://apps.apple.com/us/app/id6759975538 · Pocket Wine https://apps.apple.com/us/app/id373322732 · Vinoperte https://apps.apple.com/us/app/id6758808124 · Palett https://apps.apple.com/us/app/id6759835123 · Hugo https://apps.apple.com/us/app/id6746042473 · Vinea https://apps.apple.com/us/app/id6763097970 · Wine Tripper https://apps.apple.com/us/app/id336715795 · Uncorked https://apps.apple.com/us/app/id6747992402
