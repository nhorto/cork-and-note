# Wine Journey: badges, points and levels

**Date:** September 12, 2026. **Issue:** #104 (engagement: badges and levels). **Status:** decision doc, decisions recorded. **Interactive brief:** [`../design/wine-badges-concept-2026-09-12.html`](../design/wine-badges-concept-2026-09-12.html). Nothing in this doc is implemented.

## 0. Where this came from

Nick had a Version 2 brief written outside the repo (six-product research, three tiered families, a server-side award pipeline, one-off badges and points deferred). This doc is the Version 3 review of that brief against the current `main`, plus the badge ideas Nick asked for: per-varietal badges, region and winery exploration, and a points system. The HTML brief carries the full research, tables and an interactive preview. This file is the decision record and the implementation contract.

## 1. Verdict on the Version 2 brief

| Version 2 said | Verdict | Why |
|---|---|---|
| Named families with Bronze to Platinum tiers | Keep | Clear, lifetime, private |
| Three families | Keep, add three | Grape, Region and Journal families are computable today |
| One-off badges later | Reverse, ship in v1 | With a data-driven catalog a badge is one config line; one-offs are the fun part |
| Points and rank unnecessary | Reverse, with a constraint | Points are only awarded by badges, never per action, so there is nothing to grind and no weighting formula to invent |
| "Explicitly mark as tried" | Drop | Every `wines` row is a tasting |
| Curator needs quantity and location | Simplify | Location is optional on the form; any cataloged wine counts |
| Three data traps (visit stat counts any winery id; cellar-opened tastings look like visits; wine rows are tastings) | Confirmed | See §4 |
| Server evaluation, pending table, rule versions, revocation | Replace | Private, non-monetary badges; compute in the app, persist only awards |
| Opt-in pilot with holdouts | Replace | Feature flag and TestFlight feedback |
| Same rules Free and Pro, no upgrade prompts, no streaks or expiry | Keep | Engagement feature, not monetization |

## 2. Decisions (Nick, 2026-09-12)

1. Points and levels ship in v1.
2. Level titles are bottle sizes: Split, Half Bottle, Bottle, Magnum, Jeroboam, Methuselah, Salmanazar, Balthazar, Nebuchadnezzar.
3. Per-grape badges are tiered at 3, 10 and 25 tastings: Fan, Lover, Devotee.
4. Launch grape set chosen by the author (§3).
5. Region Explorer counts US AVAs only for now. Non-US regions come later when a layer exists; the metric is named "wine regions visited" so the family extends without renaming.
6. A bottle opened at home is not a winery visit. The pre-fix lands first.
7. Earned badges are never revoked. Progress bars recompute live; awards persist.

## 3. The catalog

Thresholds and points live in one config file and can be tuned before anyone earns them.

### Tiered families (Bronze 10 · Silver 25 · Gold 50 · Platinum 100 points)

| Family | Counts | B | S | G | P |
|---|---|---|---|---|---|
| Winery Explorer | Distinct `winery_id` across visits with `place_type = 'winery'` | 1 | 5 | 15 | 40 |
| Wine Discoverer | Distinct normalized producer + wine name across tastings, vintages collapsed | 1 | 10 | 25 | 100 |
| Grape Explorer | Distinct canonical varietals tasted | 3 | 8 | 15 | 30 |
| Region Explorer | Distinct AVAs containing a visited winery (nested AVAs each count) | 1 | 3 | 6 | 12 |
| Cellar Curator | Distinct producer + name across `cellar_bottles`, any status | 1 | 10 | 25 | 75 |
| Journal Keeper | Tastings logged, all sources | 1 | 10 | 50 | 200 |

### Per-grape badges (Fan 3 · Lover 10 · Devotee 25 tastings; 10 · 25 · 50 points)

Launch set of 18. International: Cabernet Sauvignon, Merlot, Pinot Noir, Syrah, Zinfandel, Malbec, Sangiovese, Tempranillo, Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio. Virginia: Cabernet Franc, Petit Verdot, Viognier, Petit Manseng, Chambourcin, Norton.

Badge-level merges on top of `lib/varietals.js` aliases: Syrah + Shiraz + "Syrah/Shiraz" are one grape; Pinot Grigio + Pinot Gris are one grape.

### One-offs

| Shelf | Badge | Rule | Pts |
|---|---|---|---|
| Grapes | Curious Palate | 3 tastings of any single varietal outside the launch set | 15 |
| Grapes | Off the Beaten Vine | 5 distinct hybrids or lesser-known grapes tasted (Norton, Traminette, Vidal Blanc, Petit Manseng, Chambourcin, Marquette, Frontenac, and similar; list in config) | 30 |
| Styles | Full Spectrum | Tasted a Red, White, Rosé, Sparkling and Dessert wine | 30 |
| Styles | Bubbles / Think Pink / Sweet Tooth | 5 sparkling / 5 rosé / 5 dessert | 15 each |
| Places | Regular | 5 logged visits to one winery | 30 |
| Places | Day Tripper | 3 different wineries on one `visit_date` | 15 |
| Places | Home Turf | 10 wineries visited in one state | 30 |
| Places | Crossed State Lines / Road Tripper | Wineries visited in 2 / 5 states | 15 / 30 |
| Cellar | Cork Popped | First `cellar_consumptions` row | 15 |
| Cellar | Patience | Opened a bottle held a year or more (purchase date to consumed date) | 30 |
| Cellar | Right on Time | Opened a bottle inside its drink window | 15 |
| Cellar | Well Travelled Cellar | Bottles from 5 canonical regions | 30 |
| Cellar | Globe Trotter | Bottles from 3 countries (via `regionCountry`) | 30 |
| Journal | Critic / Wordsmith / Shutterbug | 25 rated / 25 with notes / 10 with a photo | 15 each |
| Journal | Flavor Hunter | 25 distinct flavor notes used | 30 |
| Journal | Year Round | Tastings in all 12 calendar months, any years | 50 |

Deliberately absent: a separate "first" badge (Bronze covers it), anything about consumption pace or money, anything needing a region on a tasted wine (no such column).

### Levels

| Level | Points | Title |
|---|---|---|
| 1 | 0 | Split |
| 2 | 50 | Half Bottle |
| 3 | 150 | Bottle |
| 4 | 300 | Magnum |
| 5 | 500 | Jeroboam |
| 6 | 800 | Methuselah |
| 7 | 1200 | Salmanazar |
| 8 | 1700 | Balthazar |
| 9 | 2300 | Nebuchadnezzar |

Catalog ceiling is about 3,100 points, so there is headroom. Displayed as "Level 5 · Jeroboam · 540 pts".

## 4. What the code review found (verified against `main`, 2026-09-12)

- **Cellar-origin tastings are mislabelled.** `cellarService.openBottle()` in `lib/cellar.js` inserts a visit with `place_type: 'winery'` whenever the bottle has a `winery_id`. A bottle opened at home becomes a winery visit. Fix: write `place_type: null`, keep `winery_id` for producer attribution, backfill old rows by following `cellar_consumptions.wine_id` to `wines.visit_id`. `VisitStatsCard` and `summarizeVisitStats` should then count wineries only where `place_type = 'winery'`.
- **`wines` has no `user_id`.** Ownership is through `visits`. `wine_varietal` is `text[]`; `cellar_bottles.varietal` is a single `text`. Free-text varietals are not canonicalized on write, so counting canonicalizes at read time with `varietalKey` and `matchVarietal`.
- **Regions are client-side only.** No AVA table. `assets/data/avas.json` (280 AVAs) plus `regionsAtPoint` in `lib/avaRegions.js`. Cellar regions resolve through `lib/wineRegions.js` and `lib/cellarRegion.js`. This is why facts are computed in the app.
- **Wineries** are per-user rows with lat/lng and address, optional `directory_id` to `winery_directory` which has `state`. State resolution order: directory link, AVA layer states, address text.
- **Cellar history** survives: `getCellar({ includeRemoved: true })` returns consumed, gifted and sold lots. Delete is a hard delete, which is fine (a deleted mistake stops counting; the award stays).
- **Patterns to copy:** `lib/tasteProfile.js` (flatten visits to wines, group, hash source rows), `summarizeVisitStats`, `lib/cache.js` keys and `invalidate()` calls at every write, `lib/haptics.js`, `lib/notifications.js` milestone pushes, `VisitStatsCard` themed-styles block.
- **Nothing exists yet:** no achievement, badge, points or streak code or tables.

## 5. Architecture

A catalog file describes every badge as data. A pure evaluator turns the user's visits, wines, wineries, cellar lots and consumptions into a facts object, then into progress for every badge. After any save, the app runs the evaluator over freshly cached data, diffs against the earned rows it has, inserts new ones, and shows one sheet. Screens only read. Nothing on the server knows what a badge is. If badges ever become public or comparable, the evaluator moves into an edge function unchanged.

**Migration:** one table `user_achievements(user_id, badge_key, tier, points, earned_at, seen_at, source)` with a unique index on `(user_id, badge_key, tier)`, owner-only select and insert, no update of `points`. Account deletion already cascades user-owned tables; confirm this one is covered by `delete-account`. Plus a celebration toggle stored with the other profile preferences.

| Piece | Path |
|---|---|
| Catalog | `lib/achievements/catalog.js` |
| Facts | `lib/achievements/facts.js` (`buildFacts({ visits, wineries, cellar, consumptions })`) |
| Evaluator | `lib/achievements/evaluate.js` (`evaluate(facts, earned)` returns progress and newly earned) |
| Service | `lib/achievements/index.js` (`refreshAchievements()`, `getAchievements()`, `markSeen()`), new `CACHE_KEYS.achievements` |
| Celebration | `hooks/useAchievementCelebration.js`, `components/AchievementSheet.js` |
| Badge visual | `components/AchievementBadge.js` (icon in tier ring, locked state, two sizes) |
| Screen | `app/profile/achievements.js` (Families, Collection, History); card on `app/(tabs)/profile.js`; one nudge line in Home's Your Journey card |
| Tests | `__tests__/achievements.*.test.js` |

**Backfill:** the first evaluation after the feature ships walks all history and awards everything in one pass with one grouped sheet ("Recognized from your journal"), `source = 'backfill'`.

**Tests that matter:** every threshold boundary; vintages collapse to one wine; Shiraz and Syrah merge; repeat visits do not add; nested AVAs each count; cellar lots at zero still count; cellar-origin tastings do not count as visits; backfill yields one grouped result; re-running with no changes awards nothing.

## 6. Delivery

1. **Pre-fix:** cellar-origin tasting provenance and backfill migration. Independent and worth doing regardless.
2. **Engine:** catalog, facts, evaluator, tests, migration, service, cache key. No UI, flag off.
3. **Surfaces:** badge component, Achievements screen, Profile card, Home nudge, celebration sheet wired to save paths, settings toggle. Flag on for TestFlight.
4. **Follow-ups:** custom artwork, optional level-up push through `lib/notifications.js`, share card, non-US region layers, more one-offs.

Epic and sub-issues on GitHub link back to #104.
