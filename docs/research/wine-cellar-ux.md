# Wine Cellar — UX & Experience Research and Recommendations

**Repo:** `nhorto/cork-and-note` · **Epic:** #6 (Wine Cellar) · **Companion to:** [`docs/research/wine-cellar.md`](./wine-cellar.md) (data‑model research, issue #23)
**Status:** Research + prioritized recommendations. No code changed by this document. Implementation is tracked in the sub‑issues listed in §6.
**Date:** 2026-06-09
**Target user:** the wine **enthusiast** — owns *dozens* of bottles (not hundreds), cares about drink windows, ratings, light organization, and connecting bottles to tasting notes. **Not** a 500‑bottle serious collector; **not** a barely‑interested casual.

---

## 0. Why this document exists

The earlier research ([`wine-cellar.md`](./wine-cellar.md)) answered *how to **store** a cellar* — the data model. The cellar epic then shipped a clean, lot‑based inventory on top of that model. This document answers the next question the owner asked:

> "Go research how the wine‑cellar experience is *typically done* across the industry, see how that differs from how **we** do it, and figure out what we can take to make our cellar better and more user‑friendly — especially the **UX**, not just the UI."

So this is the **experience** companion: how adding, browsing, drinking, and getting value out of a cellar *feels* in the best apps, where Cork & Note's shipped feature falls short for an enthusiast, and a prioritized plan to close the gap while leaning into our differentiators (an existing **AI sommelier**, the **Château** theme, and a **home‑centric** flow).

Apps surveyed (June 2026): **Vivino, Delectable** (mass‑market, scan‑first/social), **CellarTracker, Wine‑Searcher** (power‑user / pricing), **InVintory** (premium, 3D), and a sweep of newer indies — **Cellared, Sommo, PairIt, WineIQ, Oeni, CellarEye, VinoCell, Vinotag, CellWine, My Wine Cellar**. Full source list in §7.

---

## 1. TL;DR — the five moves that matter most

For an enthusiast, the experience lives or dies on **getting bottles in fast**, **finding them**, **knowing what to drink**, and **closing the loop to a tasting note**. Our biggest differentiator is an AI sommelier the competitors mostly *paywall*. The headline recommendations:

1. **Point the AI sommelier at the user's own cellar — "What should I drink tonight?"** Make a *Tonight's pick* card the hero of the cellar/home surface: one inventory‑grounded recommendation, a one‑line *why*, and two alternatives. This is the single highest‑leverage, most on‑brand move, and it's an emerging 2025 category (InVintory's "Vincent," CellarTracker's RAG "CellarChat," Cellared, Sommo) that we can do **for free** where others charge. → **P0**
2. **Give the cellar real browsing — search, filter, sort, and group‑by.** Today there is no search and a single binary filter. An enthusiast with dozens of bottles can't find anything. → **P0**
3. **Make adding a bottle fast — reuse what we already know, smart defaults, progressive disclosure.** Today every field is blank free‑text with zero reuse of the wineries/wines the user has already logged. → **P0**
4. **Turn the drink‑window badge into a first‑class "Ready to Drink" surface, and have the sommelier seed the window at entry.** We compute a badge but bury it; enthusiasts can rarely state a drink window themselves, so propose one ("drink 2027–2034, peak ~2030") they can accept or edit. → **P0**
5. **Finish the consume loop:** show consumption history, allow a quick/Coravin note *without* removing a bottle, make rating optional, and surface the linked tasting. We built the clever "open → auto‑log a tasting" bridge; make it visible and forgiving. → **P1**

Everything else (insights dashboard, restrained notifications, photos, label scanning) is real but secondary, and a few popular collector features are **deliberate non‑goals** for our persona (§5).

---

## 2. How the industry does it (synthesis by theme)

### 2.1 Adding a bottle — scan‑first, autocomplete, defer the boring fields

The entire market has converged on **low‑friction, reference‑data‑driven entry**, and manual blank‑form entry is universally the *worst* moment in every app.

- **Scan the label as the hero path.** Vivino ("snap a label → ratings, notes, pairings," with an on‑screen capture frame and even OS‑level Apple Visual Intelligence), Delectable (the category's fastest — a "two‑click" upload), InVintory ("snap → confirm the match → log where you put it," ~90% recognition against a sommelier‑curated DB). When recognition *misses*, the good apps offer **inline tap‑to‑correct** (Delectable) rather than dumping you into an empty form (Vivino's most‑complained‑about moment).
- **Autocomplete against a wine database.** CellarTracker's add is search‑first: type a few characters of producer → pick the exact wine → all reference data prefills; their own guidance is literally "type less." This eliminates misspellings and duplicate records.
- **Defer optional fields / batch them.** CellarTracker builds a "cart" of wines, then enters price/quantity/location once at the end. Progressive disclosure is the general mobile‑form best practice — show the few required fields, hide the rest behind "More details." (Smashing Magazine, Jotform.)
- **Smart defaults & reuse.** Default quantity 1, purchase date today, bottle size 750 ml; prefill region/varietal from the identified wine; "recently added / add another like the last one" for case purchases; **quantity steppers** instead of a keyboard. InVintory's "recently added" tray makes bulk‑adding feel like one continuous motion.

### 2.2 Browsing a collection — search, filters, sort, group‑by

Once a cellar passes "a handful," browsing is a first‑class problem and every serious app invests here.

- **Search by name / producer / region / vintage** is table stakes (Vivino, CellarTracker, InVintory, Delectable's unified search).
- **Filters in mobile‑appropriate containers** — a modal or collapsible panel, **active filters shown as removable chips**, a **clear‑all**, and ideally **result counts** so users don't over‑narrow (LogRocket, UX Growth, Thierry Meier).
- **Sort** by readiness, vintage, price, rating, quantity (Vivino sorts by quantity / vintage / drinking status).
- **Group / "Summarize by."** CellarTracker's standout is a single **Summarize‑By** pivot (Region, Producer, Varietal, Type, Storage Location, Vintage) with subtotals — ~80 % of its analytics power in one control. A lightweight **segmented view** ("Ready now / Hold / All", "By type / By region") lets enthusiasts pivot without a heavy modal.
- **Empty state = onboarding.** A new cellar is empty, so the empty state should *show or tell* what a populated cellar looks like and drive one primary action ("Scan your first bottle") — not be a dead end (NN/g, Smashing).

### 2.3 Drink window & "what to drink" — the enthusiast's killer feature

This is where enthusiasts get the most differentiated value and where most apps' UX is richest.

- **Surface "ready to drink" proactively, on the home screen** — don't make the user apply a filter. InVintory leads its home with currently‑drinkable bottles; Vivino buckets the cellar into "perfect for tonight / worth saving / special occasion."
- **Help users who don't *know* the window set one.** Most people can't state a drink window. InVintory seeds windows from expert guidelines and lets users override; vintage charts (Wine Spectator, Wine Enthusiast) bundle a "drink recommendation"; estimators start from a grape's base aging profile (tannin/acid/concentration) with region/quality multipliers. **This is a natural AI hook: propose a window at entry with a one‑line rationale.**
- **Readable maturity visualization.** Beyond a linear bar: a timeline with **open / peak‑start / peak‑end / decline** marks and a **"peak now" highlight** (Cellared). CellarTracker goes further with *style‑aware* curves (Bordeaux ages slowly = "Late Bell"; Beaujolais/rosé = "Fast Aging") and a **Drinkability Index** that ranks the cellar by urgency — overkill to copy exactly, but the *ranked "drink soon" list* is the act‑on‑able distillation.
- **"Past peak" warnings, not just "entering peak."** CellarEye flags bottles that have aged *past* their window — loss‑aversion that most apps miss.

### 2.4 "What should I drink tonight?" — AI sommelier on your own cellar

A genuinely new (2025–26) category, and the most direct fit for Cork & Note's existing sommelier:

- **Cellared:** "Tell it what you're cooking → recommends the best match **from your cellar**," plus a "four taps, ten seconds, three picks" quiz. The cellar‑aware reasoning is its *paid* differentiator.
- **Sommo:** "Describe your meal → AI picks the perfect bottle **from your collection** with pairing reasoning, flavour highlights, and alternatives."
- **PairIt / WineIQ:** same shape — "tell me what you're eating, I'll pick from what you own."
- **InVintory "Vincent" / CellarTracker "CellarChat" (RAG over your own cellar):** "what should I drink tonight?" / "which of my wines are ready?"

The UX recipe is consistent: **collapse the cellar into one answer** (defeating decision paralysis — Laws of UX, Paradox of Choice), **constrain inputs to taps** (occasion/cuisine/mood) with free text optional, and **always show reasoning + alternatives** so it feels like advice, not a black‑box command.

### 2.5 Food & wine pairing

Best apps support **both directions** — dish→wine and wine→dish (Vi, Pocket Wine, Decanto) — but for a *cellar* the dominant, most useful direction is **dish → a wine I already own**. What reads as substantive vs. gimmicky: **specificity** (name the *actual bottle*, explain why) and **placement where the decision happens** (pairing on the bottle's page, not a separate toy). "Pinot with salmon" with no inventory awareness is the gimmick to avoid.

### 2.6 Consuming a bottle & tasting notes

- **Consuming = the tasting moment.** Vivino/Delectable fuse "I drank this" with "here's what I thought"; decrement happens automatically.
- **A small, real consume taxonomy** — Drank / Gift / Sold / Spoiled as first‑class buttons (CellarTracker's strength), with an optional "with whom / where" note. CellarEye captures a *reason for removal*.
- **Notes attach to the wine, with dated entries** — you can log many tastings of the same wine over time.
- **Quick note *without* consuming** (Coravin / a taste at a restaurant). CellarTracker leaves the bottle in inventory and annotates a note; Wine‑Searcher users *beg* for a fast quick‑note. Make "taste, keep the bottle" a real action.
- **Rating should be optional.** Vivino's *mandatory* rating is its most‑complained logging friction; Delectable's "don't touch the bar = no rating" respects in‑the‑moment tasting.

### 2.7 Organization / location

- The genuinely useful, enthusiast‑grade idea is a **cheap location label** ("Wine fridge", "Rack A") + an optional shelf/slot — InVintory's "virtual Dewey Decimal System" so search can answer *where the bottle physically is*.
- The **full 3D cellar build** (InVintory VinLocate, VinoCell's rack grids) is **collector vanity / the paywall driver** — overkill for someone with a fridge or two, and an explicit non‑goal (§5).
- **Novel middle ground:** CellarEye tags bottles onto a real **photo** of your shelf; NFC "tap‑to‑log" stickers (InVintory CellarStickers, CellarEye SmartStickers) collapse entry to one gesture. Interesting, optional, not core.

### 2.8 Insights / value / delight

- **"Collection at a glance"** dashboards are loved: composition by type/region/vintage, optional total value, consumption trends (InVintory home; CellarTracker valuation subtotals; Delectable's "Taste Insights" of Top Styles/Regions/people).
- **Value:** show purchase cost vs. current market value, benchmarked (Wine‑Searcher's real‑time, ex‑tax, per‑bottle model feels more alive than CellarTracker's quarterly auction value). For us this is **later / optional** — it needs a pricing data source.
- **Delight without noise:** *streaks are the wrong primitive for wine* (don't gamify daily drinking). Lean on **discovery/mastery milestones** — "first wine from a 10th region," "first vertical (3 vintages of one wine)," "50 bottles" — which match the refined Château tone. Skip points/leaderboards.

### 2.9 Notifications — restraint is the whole game

The frequency cliff is real: **46 % disable push after 2–5 *irrelevant* notifications/week**; ~60 % churn past ~5/week (Appbot, Boundev). Rules: **event‑driven, batched, early‑evening, local‑timezone.** One "**3 bottles just entered their peak**" nudge — never per‑bottle spam. Default to a gentle *in‑app* "Drink soon" surface; reserve push for genuine peak‑entry milestones; let users tune it.

### 2.10 The biggest anti‑patterns the market punishes

- **Paywalling the *core*.** Vivino's and InVintory's #1 complaints are gating *basic* cellar / drink‑window features. Keep "what should I drink," drink windows, search, and rating **free**; reserve monetization for advanced extras.
- **Clutter & overwhelm.** CellarTracker is "dated, crowded, overwhelming… most use <50 %." Wine‑Searcher is *praised* for being uncluttered and ad‑free. Progressive disclosure wins.
- **Mandatory ratings** and **blank manual forms** on scan‑miss.

---

## 3. How Cork & Note does it today

Audited against `origin/main` (`app/(tabs)/cellar.js`, `app/cellar/add.js`, `app/cellar/[id].js`, `components/CellarBottleForm.js`, `lib/cellar.js`, `supabase/migrations/20260609000000_cellar_inventory.sql`).

### 3.1 What we shipped — and it's a solid v1

- **Lot‑based inventory** with add / edit (in‑place on the detail screen) / delete, a quantity stepper, and a 4‑option bottle‑size picker.
- **A genuinely clever "open a bottle → optionally auto‑log a tasting" bridge:** opening decrements quantity, writes a `cellar_consumptions` event with a reason (drank/gift/sold/spoiled), and — if "drank" — can auto‑create a `wines` tasting prefilled from the bottle and link it back via `cellar_consumptions.wine_id`. This is the integration that makes the cellar feel native, and **no competitor does the "own → tasted" link better.**
- **A derived drink‑window status** (`too_young / ready / drink_up / past_peak`, computed client‑side in `lib/cellar.js`) shown as a color badge, plus a binary **"Ready to drink"** filter and thoughtful **empty states**.
- **A Home‑tab summary** ("N bottles · M ready").
- **Polished visuals** — Georgia serif, gold accents, on‑theme.

### 3.2 Where it falls short for an enthusiast (the gaps)

| # | Gap | Today | Impact |
|---|---|---|---|
| 1 | **No search** | — | A cellar of dozens is unsearchable by name/producer/region/vintage. |
| 2 | **No real filters / sort / grouping** | One binary "Ready" filter; always sorted newest‑first | Can't slice by type/region/price/rating or sort by readiness/vintage. |
| 3 | **All‑manual, zero‑reuse entry** | Every field blank free‑text; no autocomplete; no link to wineries/wines already in the app | Slow, error‑prone, creates duplicate "Opus One" / "Opus One Winery". |
| 4 | **Drink window is buried & unguided** | Badge only; empty state says "set a drink‑from/by year" with no help | Most users can't state a window, so the feature stays empty. |
| 5 | **No "what to drink" surface** | — | The sommelier exists but isn't pointed at the cellar — our biggest unused asset. |
| 6 | **Consume flow is thin** | Cramped modal; rating not capturable inline; no quick/Coravin note; tasting auto‑log is all‑or‑nothing and can't be edited before saving | The clever bridge is hard to use and unforgiving. |
| 7 | **No consumption history view** | Only a "Times opened: N" count | Can't see when/why/what you drank, or jump to the linked tasting. |
| 8 | **No insights** | Home shows counts only | No composition/value/trend "at a glance." |
| 9 | **No photos** | Schema has no image column | Hard to recognize bottles when browsing. |
| 10 | **No notifications** | — | Bottles silently pass their peak. |
| 11 | **Can't adjust quantity without "consuming"** | Must edit the bottle | No quick inventory correction; "open" conflates "remove one" with "log a reason." |
| 12 | **Schema capacity unused by UI** | `bin`, `currency`, `current_value` exist but aren't surfaced | Room to grow without migrations. |

**Net:** a clean foundation with one standout idea (the tasting bridge), but the *experience* is thin exactly where an enthusiast spends time — finding bottles, adding them quickly, and deciding what to open.

---

## 4. Recommendations (prioritized)

Each maps to a GitHub sub‑issue under Epic #6 (numbers filled in §6). Priorities: **P0** = highest leverage + on‑brand, do first; **P1** = strong follow‑ups; **P2** = nice‑to‑have / bigger lift.

### P0 — do first

**R1. "Tonight's pick": point the AI sommelier at the user's own cellar.** *(cellar + ai‑sommelier)*
A hero card on the cellar (and/or Home) surface: one inventory‑grounded recommendation with a one‑line *why* and two alternatives, plus a tap‑first occasion/cuisine/mood picker and optional free text ("something for grilled salmon"). Feed the sommelier the user's in‑cellar bottles + drink‑window status as context (RAG/prompt). This is the differentiator competitors paywall — keep it free. *Why:* turns our existing sommelier from a chat novelty into the app's beating heart and defeats decision paralysis. *Patterns:* Cellared, Sommo, InVintory Vincent, CellarTracker CellarChat.

**R2. Real browsing — search, filter, sort, group‑by.** *(cellar)*
Search by name/producer/region/vintage; filters in a modal with removable chips + clear‑all + result counts (type, region, varietal, ready‑status, price, rating); sort (readiness, vintage, price, rating, quantity); a single **Group‑by** control (Region / Type / Vintage / Producer / Drink‑by year) and a segmented **Ready now / Hold / All** view. *Why:* the cellar is unusable past a handful of bottles without this.

**R3. Faster bottle entry — reuse, defaults, progressive disclosure.** *(cellar + logging‑ux)*
Autocomplete producer/wine from wineries & wines already in the app (prefill type/varietal/region; link `winery_id` to dedupe); required fields only up front (name + vintage + qty) with everything else behind "More details"; smart defaults (qty 1, size 750 ml, purchase date today); "add another like the last one." *Why:* removes the worst friction; stops duplicate producers. *(Label‑scan entry is the bigger, separate R9.)*

**R4. Make the drink window first‑class + AI‑seeded.** *(cellar)*
Promote "Ready to Drink" to a proper home surface (Too young / Ready / Drink soon / Past peak), add a readable maturity **timeline** (open / peak / decline + "peak now") on the detail screen, and at entry have the sommelier **propose a drink window** ("drink 2027–2034, peak ~2030") with a one‑line rationale the user accepts or edits. *Why:* solves the "I don't know the window" problem that blocks the whole feature; we already compute the status — surface and seed it.

### P1 — strong follow‑ups

**R5. Finish the consume loop.** *(cellar + logging‑ux)*
Roomier "open a bottle" flow: optional rating + inline note (don't force a rating); a **quick/Coravin "tasted, keep the bottle"** action that logs a tasting *without* decrementing; let the user edit the auto‑prefilled tasting before saving; a **consumption history** list on the detail screen (date, reason, qty, note, link to the logged tasting); and a plain **quantity‑adjust** that doesn't require a "reason." *Why:* makes our best idea visible and forgiving.

**R6. "Your collection at a glance" insights.** *(cellar)*
A home dashboard card: composition by type/region/vintage, total bottles & ready count, consumption trend; optional total value later. *Why:* enthusiasts return to this for pleasure; cheap to build on existing data.

**R7. Restrained drink‑soon / past‑peak notifications.** *(cellar)*
Event‑driven, **batched**, early‑evening, local‑timezone ("3 bottles just entered their peak"; occasional "past peak" loss‑aversion nudge), user‑tunable, default gentle/in‑app. *Why:* high value if disciplined; churn risk if not.

### P2 — nice‑to‑have / bigger lift

**R8. Bottle photos / label images.** *(cellar)* Visual browse + recognition. (Note: Storage buckets aren't restored yet — see the Supabase project memo — so this depends on Storage being back.)

**R9. Label‑scan‑to‑add with AI prefill.** *(cellar + ai‑sommelier)* Snap a label → AI fills producer/varietal/vintage/region → confirm qty → save in ~2 taps, with inline tap‑to‑correct on a miss. The category's hero interaction; larger lift (camera + recognition), hence P2.

**Smaller follow‑ups (folded into the doc, file later if wanted):** Wishlist ↔ Cellar link ("I bought this → move to cellar"); discovery/mastery **milestones** (not streaks); surface the unused `current_value`/market‑value once a pricing source exists.

---

## 5. Explicit non‑goals (for *this* persona)

Saying no is part of the design. For a dozens‑of‑bottles enthusiast we deliberately **skip**:

- **3D cellar builders / VinLocate‑style rack maps** — collector vanity and the main paywall driver elsewhere. A cheap text location + optional shelf/slot captures ~90 % of the value.
- **Heavy per‑bottle barcode / NFC / sensor hardware** — interesting but out of scope.
- **Hardcore valuation / auction tracking** as a core feature — defer until a pricing source exists; show purchase price now, market value later.
- **Power‑user clutter** (walls of reports/menus) — progressive disclosure instead.
- **Streaks, points, leaderboards** — off‑brand for the Château tone; use discovery milestones if anything.
- **Paywalling the core experience** — the market punishes this hardest; keep "what to drink," drink windows, search, and rating free.

---

## 6. Proposed phasing & sub‑issues

**Phase 1 (P0) — "make the cellar usable & smart":** R1 Tonight's pick · R2 Browsing · R3 Faster entry · R4 Drink‑window surface + AI seeding.
**Phase 2 (P1) — "close the loops & reward":** R5 Consume loop · R6 Insights · R7 Notifications.
**Phase 3 (P2) — "delight & reach":** R8 Photos · R9 Label scan (+ smaller follow‑ups).

Sub‑issues filed under Epic #6 (links added on creation): R1–R9. See the Epic for the live checklist.

---

## 7. Sources

**Mass‑market / social:** Vivino — [Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature), [App Store](https://apps.apple.com/us/app/vivino-drink-the-right-wine/id414461255), [UX case study](https://norikogondo.com/vivino/); Delectable — [App Store](https://apps.apple.com/us/app/delectable-scan-rate-wine/id512106648), [Taste Insights](https://www.prnewswire.com/news-releases/delectable-wine-app-introduces-taste-insights-300060284.html), [review](http://www.vinovagabonds.com/blog/delectable-wine-app-review).
**Power‑user / pricing:** CellarTracker — [add bottles](https://support.cellartracker.com/article/82-how-to-add-bottles), [adding new wines](https://support.cellartracker.com/article/19-adding-new-wines), [sort & filter](https://support.cellartracker.com/article/83-how-to-sort-and-filter-your-wine-cellar), [interface overview](https://support.cellartracker.com/article/51-interface-overview), [Ready‑to‑Drink](https://support.cellartracker.com/article/28-ready-to-drink-report), [What's Poppin / Drinkability](https://support.cellartracker.com/article/104-how-drinkability-alert-is-created), [Coravin](https://support.cellartracker.com/article/27-coravin-bottle-tracking), [valuation](https://support.cellartracker.com/article/20-automatic-cellar-valuation), [CellarChat / AI](https://www.starkinsider.com/2025/07/ai-wine-pairing-cellartracker.html); Wine‑Searcher — [app](https://www.wine-searcher.com/app), [Get PRO](https://www.wine-searcher.com/get-pro), [help](https://www.wine-searcher.com/help).
**Premium / 3D:** InVintory — [App Store](https://apps.apple.com/us/app/invintory-wine-cellar-manager/id1434754695), [site](https://invintory.com/), [free tier](https://invintory.com/free), [edit drink windows](https://help.invintory.com/en/articles/10824388-how-to-edit-drink-windows), [home screen](https://help.invintory.com/en/articles/14301522-navigating-the-home-screen), [hands‑on](https://wifihifi.com/invintory-app-wine-cellar-fridge-organize/).
**Indies / AI sommelier:** [Cellared](https://cellared.ai/), [Sommo](https://apps.apple.com/us/app/sommo-all-in-one-ai-wine-app/id6757319027), [PairIt](https://apps.apple.com/us/app/pairit-wine-sommelier/id6532580126), [WineIQ](https://www.wineiq.app/), [Oeni](https://apps.apple.com/us/app/oeni-1-wine-cellar-manager/id6445827140), [CellarEye](https://apps.apple.com/us/app/cellareye/id1581071593), [VinoCell](https://apps.apple.com/us/app/vinocell-wine-cellar-manager/id521577043), [Vinotag](https://vinotag-app.com/index.php/en/home/), [CellWine](https://cell.wine/), [My Wine Cellar](https://apps.apple.com/us/app/my-wine-cellar/id1407910298); pairing — [Vi](https://medium.com/@try_vi/a-new-tool-for-pairing-food-and-wine-f56d0c79a62), [Pocket Wine](https://apps.apple.com/us/app/pocket-wine-pairing-sommelier/id815128988), [Decanto](https://apps.apple.com/us/app/decanto-wine-food-pairing/id1509960397).
**Drink windows / vintage data:** [Wine Spectator vintage charts](https://www.winespectator.com/vintage-charts), [Wine Enthusiast chart](https://www.wineenthusiast.com/wine-vintage-chart/), [drink‑windows guide](https://tradinggrapes.com/blogs/learn-about-wine/wine-drink-windows-guide-when-to-open-wine).
**General mobile UX:** [Laws of UX — Choice Overload](https://lawsofux.com/choice-overload/), [Smashing — mobile forms](https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/), [Smashing — empty states](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/), [NN/g — empty states](https://www.nngroup.com/articles/empty-state-interface-design/), [LogRocket — filtering UX](https://blog.logrocket.com/ux-design/filtering-ux-ui-design-patterns-best-practices/), [Appbot — push 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/), [Appcues — gamification](https://www.appcues.com/blog/getting-gamification-right).

*Sourcing note:* a few first‑party pages (some `vivino.com`, `invintory.com/blog`, Jancis Robinson) return HTTP 403 to automated fetching; those specifics were taken from search‑result summaries and corroborated against accessible pages (App Store listings, help centers) cited above.
