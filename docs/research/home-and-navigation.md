# Home & Navigation: Competitive UX Research for cork-and-note

> Competitive research for cork-and-note (GitHub `nhorto/cork-and-note`, issue #13). The app is moving from a **map-first** layout to a **home-centric** layout: the map becomes a secondary tab and a new Home/overview screen becomes the landing. This document surveys how leading wine and drink-logging apps structure their home/landing screen and navigation, distills common patterns, and ends with a concrete proposal for cork-and-note's home contents and tab layout.
>
> Researched June 2026. Every claim is cited inline; full source list at the bottom.
>
> **Status:** Research draft generated to inform issue #13. The "PROPOSAL" section is a recommendation for the team to decide on — not a committed design.

---

## 1. Per-app breakdown

### 1.1 Vivino — the market leader (wine, social + commerce)

**Home / landing screen.** Vivino recently rebuilt its home around **five content categories**: **Shop**, **Community**, **Food & Wine**, **Learn**, and **Places**. Shop surfaces personalized "Picked for You" recommendations or a "Browse all wines" path; Community is a friends feed of ratings and reviews from people you follow; Food & Wine lets you pick a dish and see pairings; Learn holds "Wine Adventures" and regional wine-style guides; Places is a location guide to nearby venues ([Vivino — updated home, via search](https://www.vivino.com/en/articles/updated-home); [Vivino app store listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)).

**Navigation structure.** Vivino deliberately **slimmed the navigation bar down to three main actions**: a central **camera** (scan a label or a wine list), **Profile** (which nests your ratings, Cellar, and orders), and a **Home** icon to return from anywhere in the app ([Vivino — updated home, via search](https://www.vivino.com/en/articles/updated-home)). So Vivino is not a 5-tab app — it's a 3-action bar with a rich, category-driven Home doing most of the navigational work.

**Map / places.** The map-like surface is the **Places** section, framed as "your guide to great wine near you" — it finds nearby restaurants, bars, and shops, shows each venue's range and top-rated wines, and lets you save spots and share them with friends ([Vivino — Places](https://www.vivino.com/en/articles/places)). Crucially, Places lives *inside Home as a category*, not as a top-level tab.

**Stats.** Personal stats live under **Profile** (ratings history, Cellar). The **Cellar** section is the digital inventory where you track owned bottles by quantity, vintage, and drinking status ([Vivino — Wine Cellar feature, via search](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature); [Vivino app store listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)). A **Taste Profile** records preferred styles, grapes, and regions and powers a "Match for You" score ([Vivino app store listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)).

**Primary CTA / how you start logging.** The **camera is the entry point** — snap a label to unlock ratings, reviews, tasting notes, and food pairings, then add your own rating and notes ([Vivino app store listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)). The scan button is the visual center of the navigation bar.

**AI.** Vivino has shipped a **personal AI Sommelier** that knows your ratings, scans, and preferences and answers wine questions ([Vivino app store listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)) — directly relevant since cork-and-note also plans an AI Sommelier.

**Takeaway for cork-and-note:** Vivino is the strongest precedent for the exact migration you're doing. It collapsed a busy nav into **3 actions + a categorized Home**, demoted the map ("Places") into a Home category, and made the scan/log button the literal center of the bar.

---

### 1.2 Untappd — beer, but the gold standard for logging UX

**Home / landing.** The landing surface is the **Activity** feed of recently checked-in beers; at the top you can toggle between **friends**, **friends checked in nearby**, and specific **groups** you belong to. Each check-in shows beer name, brewery, rating, optional location, and Toast/Comment buttons ([AFB review](https://afb.org/aw/20/3/16317)).

**Navigation structure.** Untappd is a **five-tab bottom bar** ([AFB review](https://afb.org/aw/20/3/16317)). The tabs are **Activity** (the feed), **Discover** (search + trending beers/venues + nearby venues and events + global feed; has a QR/scan icon at top), **Inbox/Notifications** (Activity toasts, Venues, News), and **Profile** (account, friends, beer statistics, badges) ([AFB review](https://afb.org/aw/20/3/16317); [Untappd help, via search](https://help.untappd.com/hc/en-us/sections/360008312011-Using-Untappd)). The Discover tab is explicitly where new users are dropped on first sign-in ([AFB review](https://afb.org/aw/20/3/16317)).

**Map / nearby.** There is no dedicated map *tab*; location lives inside **Discover** as a list of verified nearby venues, nearby events, and local venue-specific badges, plus a "friends nearby" toggle on the Activity feed ([AFB review](https://afb.org/aw/20/3/16317)).

**Stats.** Under **Profile**: total and **unique beers**, badges earned, and friends. Unique beers are sortable/filterable into a browsable history ([AFB review](https://afb.org/aw/20/3/16317); [Untappd — View & Sort Unique Beers](https://help.untappd.com/hc/en-us/articles/360033986312--View-Sort-Unique-Beers)). The **badge system** is the engagement engine — badges are awarded by count of unique beers, region, style, and repeat behaviors, split into local/beer/venue/special categories ([Untappd Lounge — badges](https://lounge.untappd.com/everything-you-need-to-know-about-untappd-badges/)).

**Primary CTA / logging.** The **check-in is the central call to action**, doubling as logging and social sharing ([Untappd Wikipedia](https://en.wikipedia.org/wiki/Untappd)). A widely-noted UX weakness in older versions: you had to "hit the search button in the corner to initiate a check-in," which critics called unintuitive for the app's primary function — prompting redesign proposals to add a **floating action button** for check-in ([Designing a Friendlier Untappd, Medium](https://medium.com/@philkt/designing-a-friendlier-untappd-6ee9bb041404)). Untappd 4.0 also replaced top tab-clicking with **swipe between Activity/Notifications** ([Hop Culture — Untappd 4.0](https://www.hopculture.com/untappd-4-0-dark-mode/)).

**Takeaway for cork-and-note:** Activity-feed-as-home + a tab dedicated to discovery, with stats and badges concentrated in Profile. The big lesson is a *cautionary* one: **do not bury your primary log action behind a search/secondary control** — make it an unmistakable, centered/floating CTA.

---

### 1.3 CellarTracker — the cellar-management standard (wine)

**Home / landing.** CellarTracker's modernized app gives a "cleaner, more useful **Home** page that surfaces recent tasting notes on wines in your cellar and from people you follow," with **one-click access to Search** on Home ([CellarTracker app store listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275); [CellarTracker mobile, via search](https://mobileapp.cellartracker.com/)).

**Navigation structure.** Bottom navigation includes **Home**, **Search**, **Camera/Barcode search**, **Lists**, and **Collection** (the cellar). The recent update specifically promoted **Lists into the bottom nav** ([CellarTracker app store listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

**Map.** None — CellarTracker is inventory-first, not place-first. There is no map tab.

**Stats.** Concentrated in **Collection**: cellar value, consumption trends, inventory across storage locations, and per-wine full history ([CellarTracker app store listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

**Primary CTA / logging.** Adding a wine via **barcode scan, label scan, or digital-receipt forwarding**; a streamlined **"single-tap consume"** flow lets you mark a bottle drunk and add a rating/note at the same moment ([CellarTracker app store listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

**AI.** CellarTracker has built AI on top of 20+ years of tasting-note data, surfacing **Insights** on wine-detail pages (how it tastes, community sentiment, food pairings) ([CellarTracker mobile, via search](https://mobileapp.cellartracker.com/)).

**Takeaway for cork-and-note:** A clean Home = recent tasting notes (yours + people you follow) + one-tap search. The **Collection/Cellar is a dedicated tab**, and consume-with-rating is a single elegant action. This is the closest precedent for cork-and-note's planned **Cellar tab**.

---

### 1.4 Delectable — the discovery/feed-first wine app

**Home / landing.** A **social, Facebook-style newsfeed** of wine posts and editorial content; the interface is intentionally simple with few tabs. A **"Featured"** surface carries articles on wine/beer/spirits, region spotlights, featured users, and a "Word of the Week" ([The District Nerd review](https://www.thedistrictnerd.com/index.php/2016/05/01/app-review-delectable-vs-vivino/)).

**Navigation.** Minimal — the **wine catalogue is the second tab**; the rest of the app keeps tab count low ([The District Nerd review](https://www.thedistrictnerd.com/index.php/2016/05/01/app-review-delectable-vs-vivino/)).

**Map.** None notable.

**Stats / logging.** Scan-and-rate driven; can log a large back-catalogue of wines and offers a **skippable rating** so you can keep a tasting note without forcing a numeric score, plus a human "manual review" fallback when image recognition fails ([Travelling Corkscrew — best wine apps 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/)).

**Takeaway for cork-and-note:** Feed-first, very few tabs, and a humane logging detail — **don't force a score** to capture a note.

---

### 1.5 Notable others

- **OENO by Vintec** — cellar-management app (works without owning a Vintec fridge) that embeds **Vivino's scanner**, tracks consumed bottles, and gives serving/aging recommendations ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/)). Confirms cellar apps lean on a scan partner rather than building recognition.
- **Sommo** — AI-first: photo/menu scan pulls all wine info, plus a wine journal, WSET flashcards, and a personalized "Wine Character Reading" ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/)). Precedent for an **AI-forward** wine home.
- **VinoMemo** (launched 2025) — private, offline, **WSET-structured tasting notes** (appearance/nose/palate/quality) with search and filter ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/)). Precedent for a structured-notes logging path.
- **Pocket Sommelier** — pairing-first, photo-based meal recognition returning three pairings, with restaurant wine-list scanning ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/)).

---

## 2. Common patterns & best practices for a home-centric wine app

Synthesizing across all apps above:

1. **Home is a feed or a digest, not a control panel.** Untappd (Activity), Delectable (newsfeed), and CellarTracker (recent tasting notes from you + people you follow) all open onto *content* — recent activity — rather than a menu. Vivino opens onto categorized content blocks ([AFB](https://afb.org/aw/20/3/16317); [The District Nerd](https://www.thedistrictnerd.com/index.php/2016/05/01/app-review-delectable-vs-vivino/); [CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275); [Vivino updated home](https://www.vivino.com/en/articles/updated-home)).

2. **The primary log action is a single, central, unmissable CTA.** Vivino centers the **camera** in a 3-action bar; the strongest critique of older Untappd is precisely that it *hid* check-in behind a search button, leading designers to propose a **floating action button** ([Vivino updated home](https://www.vivino.com/en/articles/updated-home); [Designing a Friendlier Untappd](https://medium.com/@philkt/designing-a-friendlier-untappd-6ee9bb041404)).

3. **Maps are demoted, not eliminated.** None of the four majors gives the map a top-level tab. Vivino folds it into a **Places** Home category; Untappd folds "nearby venues" into **Discover** ([Vivino — Places](https://www.vivino.com/en/articles/places); [AFB](https://afb.org/aw/20/3/16317)). This validates cork-and-note's planned demotion of the map.

4. **Stats live in Profile (or the Cellar), surfaced as a digest on Home.** Untappd concentrates unique-count/badges in Profile; CellarTracker concentrates value/consumption in Collection; both echo a lighter summary on Home ([AFB](https://afb.org/aw/20/3/16317); [CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

5. **Keep the tab bar at 3–5 items.** Vivino runs **3 actions**; Untappd and CellarTracker run **5**; Delectable runs few. None approaches 7. Depth is handled by a rich Home and by nesting (Vivino nests Cellar + orders under Profile) ([Vivino updated home](https://www.vivino.com/en/articles/updated-home); [AFB](https://afb.org/aw/20/3/16317); [CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

6. **Logging should capture a note even without a score, and combine consume+rate in one step.** Delectable's skippable rating and CellarTracker's single-tap "consume + rate" are the humane patterns ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/); [CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

7. **AI sommelier is becoming table stakes — and it's personalized, not a generic chatbot.** Vivino's AI Sommelier and CellarTracker's Insights both ground answers in *your* ratings and a large note corpus ([Vivino listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255); [CellarTracker mobile](https://mobileapp.cellartracker.com/)). It's typically reached from Home or a wine detail page — not given its own tab.

---

## 3. PROPOSAL — for user to decide

> The following is a recommendation for the cork-and-note team to weigh and adapt. Nothing here is a committed design.

**The core problem:** Today's tabs are **Map, Wishlist, Wines, Profile** (4). Adding a **Cellar** tab and an **AI Sommelier** tab, while keeping Map after the home-centric shift, would push you toward **Home + Map + Wishlist + Wines + Cellar + Sommelier + Profile = 7 tabs.** Every competitor surveyed stays at 3–5, and the market leader (Vivino) sits at 3 actions by pushing depth into Home and nesting. **7 tabs is too many** and will read as cluttered — the opposite of an elegant château wine-label aesthetic.

### 3a. Proposed tab layout — 5 tabs

A centered logging CTA, flanked by two tabs each:

```
  Home        Cellar      [ + Log ]      Explore       Profile
 (landing)  (inventory)  (center CTA)  (discover+map)  (you + AI)
```

1. **Home** — the new landing (contents in 3b).
2. **Cellar** — your collection/inventory (bottles owned, vintages, drinking windows, value), following the CellarTracker Collection model ([CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).
3. **Log (center)** — a prominent, centered **add/scan** button, the way Vivino centers its camera. This is the primary CTA and avoids Untappd's classic "hidden behind search" mistake ([Vivino updated home](https://www.vivino.com/en/articles/updated-home); [Designing a Friendlier Untappd](https://medium.com/@philkt/designing-a-friendlier-untappd-6ee9bb041404)).
4. **Explore** — discovery surface that **absorbs the Map** (winery/vineyard map + nearby places) the way Vivino's Places and Untappd's Discover do, plus search and recommendations ([Vivino — Places](https://www.vivino.com/en/articles/places); [AFB](https://afb.org/aw/20/3/16317)).
5. **Profile** — you, your stats, **Wishlist nested here**, settings, and the **AI Sommelier** launched from here (and from wine detail pages), mirroring Vivino nesting Cellar/orders/AI under Profile/Home ([Vivino updated home](https://www.vivino.com/en/articles/updated-home); [Vivino listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)).

### 3b. What goes on Home

A vertical scroll of "wine-label" cards — restrained, serif-headed, lots of cream/white space:

1. **Greeting + personal stat strip** — small chips: *Wines tried · Places visited · Wishlist · This year*. Tapping any chip deep-links to the full view (Untappd-style stat concentration, surfaced as a Home digest) ([AFB](https://afb.org/aw/20/3/16317)).
2. **Primary CTA reinforcement** — a "Log a wine" / "Scan a label" hero card at the top of the scroll, reinforcing the center tab button (Vivino camera-first) ([Vivino listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)).
3. **Recent activity / your tasting notes** — your latest logs and, optionally, notes from people you follow (CellarTracker + Untappd feed model) ([CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275); [AFB](https://afb.org/aw/20/3/16317)).
4. **"Continue exploring" map teaser** — a small map snippet of recently visited / nearby wineries that deep-links into the Explore tab, so the demoted map still has a Home presence (Vivino Places lives inside Home) ([Vivino — Places](https://www.vivino.com/en/articles/places)).
5. **Ask the Sommelier** — an entry card to the AI Sommelier, personalized to your ratings (Vivino/CellarTracker AI pattern) ([Vivino listing](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255); [CellarTracker mobile](https://mobileapp.cellartracker.com/)).
6. **Recommendations / "Picked for you"** — taste-profile-driven suggestions (Vivino Shop "Picked for You") ([Vivino updated home](https://www.vivino.com/en/articles/updated-home)).

### 3c. The consolidation, explicitly

| Planned surface | Recommended placement | Precedent |
|---|---|---|
| Home | **Tab 1** (new landing) | All four majors |
| Map | **Folded into Explore tab** + a Home map teaser | Vivino Places; Untappd Discover |
| Wishlist | **Nested under Profile** (+ a Home stat chip) | Vivino nests Cellar/orders under Profile |
| Wines (all tried) | **Nested under Profile/Cellar** + recent items on Home | Untappd "unique beers" under Profile |
| Cellar | **Tab 2** | CellarTracker Collection |
| AI Sommelier | **Launched from Home card + Profile + wine detail — not its own tab** | Vivino AI Sommelier; CellarTracker Insights |
| Logging | **Center "+" CTA**, not a tab competing for space | Vivino camera; anti-pattern: old Untappd |

This takes you from a would-be **7 tabs to 5**, keeps the **log action front-and-center**, demotes the map exactly as the migration intends while keeping it one tap away, and reserves the AI Sommelier as a contextual assistant rather than a tab — matching how the market leaders actually ship it.

### 3d. Aesthetic note (château wine-label)

The home-as-feed-of-cards pattern suits a label aesthetic well: treat each Home card like a **wine label** — serif/engraved display headings, thin gold or burgundy rules, cream paper background, generous margins, and a single restrained accent per card. Keep the tab bar minimal (line icons, no heavy fills) so the 5 tabs read as an elegant footer rather than a toolbar. The skippable-rating and consume-in-one-tap logging details from Delectable/CellarTracker keep the *interaction* as understated as the *visuals* ([Travelling Corkscrew](https://travellingcorkscrew.com.au/blog/best-wine-apps/); [CellarTracker listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)).

---

## Sources

- [Vivino — Your guide to Vivino's new look (updated home)](https://www.vivino.com/en/articles/updated-home)
- [Vivino — Coming soon: Places](https://www.vivino.com/en/articles/places)
- [Vivino — Drink the Right Wine (App Store listing)](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255)
- [Vivino — Discover Vivino's Wine Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature)
- [Untappd — Wikipedia](https://en.wikipedia.org/wiki/Untappd)
- [AccessWorld (AFB) — Review of DigitalPour and Untappd](https://afb.org/aw/20/3/16317)
- [Untappd Help — Using Untappd](https://help.untappd.com/hc/en-us/sections/360008312011-Using-Untappd)
- [Untappd Help — View & Sort Unique Beers](https://help.untappd.com/hc/en-us/articles/360033986312--View-Sort-Unique-Beers)
- [Untappd Lounge — All About Untappd Badges](https://lounge.untappd.com/everything-you-need-to-know-about-untappd-badges/)
- [Hop Culture — Untappd 4.0 / Dark Mode](https://www.hopculture.com/untappd-4-0-dark-mode/)
- [Phil K.-T. (Medium) — Designing a Friendlier Untappd](https://medium.com/@philkt/designing-a-friendlier-untappd-6ee9bb041404)
- [CellarTracker — #1 Wine Tracker (App Store listing)](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275)
- [CellarTracker — Mobile App site](https://mobileapp.cellartracker.com/)
- [The District Nerd — Delectable vs Vivino](https://www.thedistrictnerd.com/index.php/2016/05/01/app-review-delectable-vs-vivino/)
- [Travelling Corkscrew — Wine Apps You NEED to Check Out in 2026](https://travellingcorkscrew.com.au/blog/best-wine-apps/)
