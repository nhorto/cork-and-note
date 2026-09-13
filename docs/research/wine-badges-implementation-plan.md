# Wine Journey badges: implementation plan

**Date:** September 12, 2026. **Epic:** #293. **Decision doc:** [`wine-badges-2026-09-12.md`](./wine-badges-2026-09-12.md). **Brief:** [`../design/wine-badges-concept-2026-09-12.html`](../design/wine-badges-concept-2026-09-12.html).

This is the step-by-step build plan, written so that an engineer or model with no prior context can implement it one pull request at a time. Every file path, function signature, SQL statement and hook point below was checked against `main` on the date above. Where the plan says "line N" treat it as "near line N"; the surrounding comment text is the real anchor.

## 0. Ground rules

- One PR per sub-issue, in order: #294 then #295 then #296. Branch from `main` after the previous PR merges. Branch names: `fix/cellar-origin-visits`, `feat/badges-engine`, `feat/badges-surfaces`.
- Run `npm test` before opening each PR. Run a single file with `npx jest __tests__/<name>.test.js`.
- Never touch the live database. Migrations are files under `supabase/migrations/` named `<14-digit timestamp>_<snake_case>.sql`, idempotent (`if not exists`, `drop policy if exists`), and Nick applies them. The offline test `__tests__/migrationHygiene.test.js` fails if the client writes to a table no migration creates.
- No em dashes anywhere in app copy, comments or docs. Use commas, colons or full stops.
- Copy the repo's component style: `const { colors, styles } = useScreenTheme();` with `const useScreenTheme = createThemedStyles((theme) => StyleSheet.create({...}))` at the bottom of the file, importing `createThemedStyles` from `styles/ThemeProvider`. Icons come from `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`).
- Services return `{ success: true, ... }` or `{ success: false, error }` and never throw to screens.
- Achievements must never block or fail a save. Every call into the achievements service from a save path is wrapped so an exception is logged and swallowed.
- Free for every user. Do not import `usePro` or gate anything.

## 1. Data you will read (shapes)

**Visits.** `visitsService.getUserVisits()` in `lib/visits.js` (cached under `CACHE_KEYS.visits`) returns `{ success, visits }`. Each visit:

```js
{
  id, user_id, winery_id, visit_date /* 'YYYY-MM-DD' */, place_type /* 'winery' | 'restaurant' | 'other' | null */,
  place_name, latitude, longitude, notes, photos: [],
  wineries: { id, name, address, latitude, longitude } | null,
  wines: [{
    id, winemaker, wine_name, wine_type /* free text */, wine_varietal /* string[] */, wine_year /* text */,
    overall_rating /* number, 0 means unrated */, additional_notes, photos: [],
    wine_flavor_notes: [{ flavor_notes: { name, category } }]
  }]
}
```

**Cellar.** `cellarService.getCellar({ includeRemoved: true })` in `lib/cellar.js` returns `{ success, bottles }` with every status. Each bottle: `id, producer, wine_name, vintage, wine_type, varietal /* single string */, region, quantity, location, purchase_date, drink_from, drink_by, status, created_at, wineries: { id, name } | null, drinkStatus`. Consumptions are not fetched in bulk today (only per bottle in `getBottle`). PR 2 adds `getCellarHistory()` below.

**Regions.** `regionsAtPoint(lat, lng)` in `lib/avaRegions.js` returns AVA features; each has `properties.id`, `properties.name`, `properties.states` (array of two-letter codes). `findRegion(text)` and `regionCountry(text)` in `lib/wineRegions.js` resolve a cellar region string to its canonical entry and country, or null.

**Varietals.** `parseVarietals(value)` (array or string to clean array), `matchVarietal(text)` (canonical display name or null) and `inferTypeFromVarietal` in `lib/varietals.js`. `varietalKey` is not exported; add `export` to it in PR 2 (it is a pure helper at about line 119).

**Wine identity.** `wineIdentity(x)` in `lib/cellarMatch.js` returns `{ producer, name, varietals: Set, vintage }` already normalized, and accepts a tasting row or a cellar bottle. Use `producer + '|' + name` as the distinct-wine key; when `name` is empty use `producer + '|' + [...varietals].sort().join(',')`; when both are empty use the row id.

## 2. PR 1, issue #294: cellar-origin tastings are not winery visits

**Why.** `cellarService.openBottle()` in `lib/cellar.js` (the block that begins with the comment "Optionally log a tasting") inserts a visit with `place_type: bottle.winery_id ? 'winery' : null`. A bottle opened at home therefore counts as a winery visit in Profile stats and would count toward Winery Explorer.

**Code changes.**

1. `lib/cellar.js`, inside `openBottle`, change the insert to `place_type: null` and leave `winery_id: bottle.winery_id ?? null` as is. Update the comment to say the session keeps the producer link but is not a visit to that place.
2. `lib/visits.js`:
   - `summarizeVisitStats(visits)`: `totalWineries` becomes the size of the set of `v.winery_id` where `v.winery_id` is truthy and `v.place_type === 'winery'`.
   - `summarizeVisits(visits)`: apply the same filter wherever it builds place or winery aggregates (distinct places, most recent place, most visited winery).
   - `_getVisitStats()`: it selects `id, winery_id`; add `place_type` to the select and apply the same filter when counting `totalWineries`.
3. `components/VisitStatsCard.js`, in `loadStats`: the "Places = distinct real wineries" count must also require `place_type === 'winery'`. Simplest is to call `visitsService.summarizeVisitStats(visits)` and read `totalWineries` from it, deleting the duplicated logic.
4. Check `app/log-session.js` and `app/winery/[id].js` still render a visit with `winery_id` set and `place_type` null (the editor should show no place, the winery page should not list it as a visit). Fix only if something breaks; note anything odd in the PR description.

**Migration** `supabase/migrations/20260913000000_cellar_origin_visits.sql`:

```sql
-- Cellar-origin tastings (#294): a bottle opened at home is not a winery visit.
-- openBottle used to write place_type = 'winery' whenever the lot had a
-- winery_id. Clear place_type on every visit that was created by an
-- open-bottle event, identified through cellar_consumptions.wine_id.
-- Idempotent.
update public.visits v
   set place_type = null
  from public.wines w
  join public.cellar_consumptions c on c.wine_id = w.id
 where w.visit_id = v.id
   and v.place_type = 'winery';
```

**Tests.**
- `__tests__/cellarService.test.js`: extend the existing open-bottle test (or add one) asserting the inserted visit has `place_type: null` even when the bottle has a `winery_id`.
- A new `__tests__/visitStats.test.js` for `summarizeVisitStats` and `summarizeVisits`: a visit with `winery_id` and `place_type: null` does not count as a winery; a visit with `place_type: 'winery'` does; a visit with `winery_id: null` never does.
- Run `npx jest __tests__/homeScreen.test.js __tests__/journalScreen.test.js __tests__/bottleScreen.test.js` and fix any fixture that relied on the old count.

## 3. PR 2, issue #295: the engine (no UI, flag off)

### 3.1 Migration `supabase/migrations/20260913010000_user_achievements.sql`

```sql
-- Wine Journey badges (#295). One row per earned badge tier. The app computes
-- progress from the user's own journal and cellar; this table only records
-- what was earned and when. Awards are never revoked. Owner-only RLS.
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  badge_key text not null,
  tier text,
  points integer not null default 0 check (points >= 0),
  earned_at timestamptz not null default now(),
  seen_at timestamptz,
  source text not null default 'live' check (source in ('live', 'backfill')),
  created_at timestamptz not null default now()
);

create unique index if not exists user_achievements_unique
  on public.user_achievements (user_id, badge_key, coalesce(tier, ''));

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_achievements_insert_own" on public.user_achievements;
create policy "user_achievements_insert_own"
  on public.user_achievements for insert to authenticated
  with check (user_id = auth.uid());

-- seen_at is the only column the app updates after insert.
drop policy if exists "user_achievements_update_own" on public.user_achievements;
create policy "user_achievements_update_own"
  on public.user_achievements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, earned_at desc);
```

Also add one line to `public.delete_user_data()` so account deletion clears the table: copy the function from `supabase/migrations/20260705020000_fix_delete_user_data.sql` into a new migration `20260913020000_delete_user_data_achievements.sql` as `create or replace function`, adding `delete from public.user_achievements a where a.user_id = v_user_id;` next to the cellar deletes. Keep everything else identical.

### 3.2 `lib/achievements/catalog.js`

Export these constants and helpers. Keep the file data-only apart from the small helpers.

```js
export const ACHIEVEMENTS_ENABLED = false; // flipped to true in PR 3

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
export const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
export const TIER_POINTS = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

export const GRAPE_TIERS = ['fan', 'lover', 'devotee'];
export const GRAPE_TIER_LABEL = { fan: 'Fan', lover: 'Lover', devotee: 'Devotee' };
export const GRAPE_TIER_POINTS = { fan: 10, lover: 25, devotee: 50 };
export const GRAPE_THRESHOLDS = [3, 10, 25];

// Six tiered families. `metric` names a key on the facts object (section 3.3).
export const FAMILIES = [
  { key: 'winery_explorer', name: 'Winery Explorer', icon: 'map-marker-path', metric: 'distinctWineries',  thresholds: [1, 5, 15, 40],   unit: 'wineries',  rule: 'Distinct wineries with a logged visit.' },
  { key: 'wine_discoverer', name: 'Wine Discoverer', icon: 'glass-wine',      metric: 'distinctWines',     thresholds: [1, 10, 25, 100], unit: 'wines',     rule: 'Distinct wines tasted. Vintages count once.' },
  { key: 'grape_explorer',  name: 'Grape Explorer',  icon: 'fruit-grapes',    metric: 'distinctVarietals', thresholds: [3, 8, 15, 30],   unit: 'varietals', rule: 'Distinct grapes tasted.' },
  { key: 'region_explorer', name: 'Region Explorer', icon: 'map-outline',     metric: 'distinctAvas',      thresholds: [1, 3, 6, 12],    unit: 'regions',   rule: 'Wine regions with a visited winery. US AVAs for now.' },
  { key: 'cellar_curator',  name: 'Cellar Curator',  icon: 'archive-outline', metric: 'distinctCellarWines', thresholds: [1, 10, 25, 75], unit: 'wines',   rule: 'Distinct wines ever added to your cellar.' },
  { key: 'journal_keeper',  name: 'Journal Keeper',  icon: 'notebook-outline', metric: 'tastings',         thresholds: [1, 10, 50, 200], unit: 'tastings',  rule: 'Tastings logged, anywhere.' },
];

// Per-grape tiered badges. `key` is the canonical varietal name from lib/varietals.js.
// `merge` lists other canonical names that count as the same grape.
export const GRAPES = [
  { key: 'Cabernet Sauvignon' }, { key: 'Merlot' }, { key: 'Pinot Noir' },
  { key: 'Syrah', merge: ['Shiraz', 'Syrah/Shiraz'] }, { key: 'Zinfandel' }, { key: 'Malbec' },
  { key: 'Sangiovese' }, { key: 'Tempranillo' }, { key: 'Chardonnay' }, { key: 'Sauvignon Blanc' },
  { key: 'Riesling' }, { key: 'Pinot Grigio', merge: ['Pinot Gris'] },
  { key: 'Cabernet Franc' }, { key: 'Petit Verdot' }, { key: 'Viognier' },
  { key: 'Petit Manseng' }, { key: 'Chambourcin' }, { key: 'Norton' },
];

export const HYBRIDS = ['Norton', 'Traminette', 'Vidal Blanc', 'Petit Manseng', 'Chambourcin', 'Marquette', 'Frontenac', 'Frontenac Blanc', 'Frontenac Gris', 'La Crescent', 'Itasca', 'Vignoles', 'Seyval Blanc', 'Chardonel', 'Cayuga White', 'Catawba', 'Concord', 'Niagara'];

// One-offs. `test(facts)` returns true when earned. Grouped by shelf.
export const ONE_OFFS = [
  { key: 'curious_palate',   shelf: 'grapes',  name: 'Curious Palate',        icon: 'fruit-grapes-outline', points: 15, rule: '3 tastings of a grape outside the launch list.',              test: f => f.maxNonLaunchVarietalCount >= 3 },
  { key: 'off_beaten_vine',  shelf: 'grapes',  name: 'Off the Beaten Vine',   icon: 'leaf',             points: 30, rule: '5 different hybrid or lesser-known grapes.',                    test: f => f.distinctHybrids >= 5 },
  { key: 'full_spectrum',    shelf: 'styles',  name: 'Full Spectrum',         icon: 'palette-outline',  points: 30, rule: 'A red, a white, a rosé, a sparkling and a dessert wine.',       test: f => ['Red','White','Rosé','Sparkling','Dessert'].every(t => (f.typeCounts[t] || 0) > 0) },
  { key: 'bubbles',          shelf: 'styles',  name: 'Bubbles',               icon: 'glass-flute',      points: 15, rule: '5 sparkling wines.',                                           test: f => (f.typeCounts.Sparkling || 0) >= 5 },
  { key: 'think_pink',       shelf: 'styles',  name: 'Think Pink',            icon: 'glass-wine',       points: 15, rule: '5 rosés.',                                                     test: f => (f.typeCounts['Rosé'] || 0) >= 5 },
  { key: 'sweet_tooth',      shelf: 'styles',  name: 'Sweet Tooth',           icon: 'candy-outline',    points: 15, rule: '5 dessert wines.',                                             test: f => (f.typeCounts.Dessert || 0) >= 5 },
  { key: 'regular',          shelf: 'places',  name: 'Regular',               icon: 'store-outline',    points: 30, rule: '5 visits to the same winery.',                                 test: f => f.maxVisitsToOneWinery >= 5 },
  { key: 'day_tripper',      shelf: 'places',  name: 'Day Tripper',           icon: 'car-outline',      points: 15, rule: '3 wineries in one day.',                                       test: f => f.maxWineriesInOneDay >= 3 },
  { key: 'home_turf',        shelf: 'places',  name: 'Home Turf',             icon: 'home-map-marker',  points: 30, rule: '10 wineries in one state.',                                    test: f => f.maxWineriesInOneState >= 10 },
  { key: 'crossed_lines',    shelf: 'places',  name: 'Crossed State Lines',   icon: 'sign-direction',   points: 15, rule: 'Wineries in 2 states.',                                        test: f => f.distinctStates >= 2 },
  { key: 'road_tripper',     shelf: 'places',  name: 'Road Tripper',          icon: 'road-variant',     points: 30, rule: 'Wineries in 5 states.',                                        test: f => f.distinctStates >= 5 },
  { key: 'cork_popped',      shelf: 'cellar',  name: 'Cork Popped',           icon: 'bottle-wine',      points: 15, rule: 'First bottle opened from your cellar.',                        test: f => f.bottlesOpened >= 1 },
  { key: 'patience',         shelf: 'cellar',  name: 'Patience',              icon: 'timer-sand',       points: 30, rule: 'Opened a bottle you held for a year or more.',                 test: f => f.longestHoldDays >= 365 },
  { key: 'right_on_time',    shelf: 'cellar',  name: 'Right on Time',         icon: 'check-decagram',   points: 15, rule: 'Opened a bottle inside its drink window.',                    test: f => f.openedInWindow >= 1 },
  { key: 'well_travelled',   shelf: 'cellar',  name: 'Well Travelled Cellar', icon: 'earth',            points: 30, rule: 'Cellar bottles from 5 regions.',                               test: f => f.distinctCellarRegions >= 5 },
  { key: 'globe_trotter',    shelf: 'cellar',  name: 'Globe Trotter',         icon: 'airplane',         points: 30, rule: 'Cellar bottles from 3 countries.',                             test: f => f.distinctCellarCountries >= 3 },
  { key: 'critic',           shelf: 'journal', name: 'Critic',                icon: 'star-outline',     points: 15, rule: '25 rated tastings.',                                           test: f => f.ratedTastings >= 25 },
  { key: 'wordsmith',        shelf: 'journal', name: 'Wordsmith',             icon: 'pencil-outline',   points: 15, rule: '25 tastings with notes.',                                      test: f => f.tastingsWithNotes >= 25 },
  { key: 'shutterbug',       shelf: 'journal', name: 'Shutterbug',            icon: 'camera-outline',   points: 15, rule: '10 tastings with a photo.',                                    test: f => f.tastingsWithPhotos >= 10 },
  { key: 'flavor_hunter',    shelf: 'journal', name: 'Flavor Hunter',         icon: 'nose',             points: 30, rule: '25 different flavor notes used.',                              test: f => f.distinctFlavorNotes >= 25 },
  { key: 'year_round',       shelf: 'journal', name: 'Year Round',            icon: 'calendar-month',   points: 50, rule: 'Tastings in all 12 months of the year.',                       test: f => f.distinctMonths >= 12 },
];

export const SHELVES = [
  { key: 'grapes', name: 'Grapes' }, { key: 'styles', name: 'Styles' }, { key: 'places', name: 'Places' },
  { key: 'cellar', name: 'Cellar' }, { key: 'journal', name: 'Journal' },
];

export const LEVELS = [
  { level: 1, points: 0,    title: 'Split' },
  { level: 2, points: 50,   title: 'Half Bottle' },
  { level: 3, points: 150,  title: 'Bottle' },
  { level: 4, points: 300,  title: 'Magnum' },
  { level: 5, points: 500,  title: 'Jeroboam' },
  { level: 6, points: 800,  title: 'Methuselah' },
  { level: 7, points: 1200, title: 'Salmanazar' },
  { level: 8, points: 1700, title: 'Balthazar' },
  { level: 9, points: 2300, title: 'Nebuchadnezzar' },
];

export function levelForPoints(points) { /* returns { level, title, points, next: { level, title, points } | null } */ }
export function grapeBadgeKey(grapeKey) { return `grape:${grapeKey}`; }
export function badgeByKey(key) { /* family, grape or one-off definition, or null */ }
```

Icon names are `MaterialCommunityIcons`. If a name does not exist in the installed set, pick the nearest one; do not block on icons.

### 3.3 `lib/achievements/facts.js`

`export function buildFacts({ visits = [], bottles = [], consumptions = [] })`. Pure, synchronous, no imports from services. Returns:

| Fact | How |
|---|---|
| `tastings` | Total wine rows across visits. |
| `distinctWineries` | Set of `v.winery_id` where truthy and `v.place_type === 'winery'`. |
| `distinctWines` | Set of wine keys from `wineIdentity` (section 1). |
| `varietalCounts` | Map canonical grape name to tasting count. For each wine, for each element of `parseVarietals(wine.wine_varietal)`: `matchVarietal(el) || el.trim()`; then apply `GRAPES[].merge` so merged names collapse onto the launch key. Count a grape once per wine even if listed twice. Skip values whose canonical name contains "Blend". |
| `distinctVarietals` | Size of `varietalCounts`. |
| `maxNonLaunchVarietalCount` | Max count among grapes not in `GRAPES`. |
| `distinctHybrids` | Count of `HYBRIDS` present in `varietalCounts`. |
| `typeCounts` | Map of `Red`, `White`, `Rosé`, `Sparkling`, `Dessert` to counts. Normalize `wine_type`: lowercase, trim; `red blend` and `red` map to Red, `white blend` and `white` to White, `rosé`, `rose`, `rosé blend` to Rosé, `sparkling` to Sparkling, `dessert` to Dessert; when `wine_type` is empty use `inferTypeFromVarietals(wine.wine_varietal)`; anything else is ignored. |
| `visitsPerWinery` | Map winery_id to count of visits with `place_type === 'winery'`. `maxVisitsToOneWinery` is its max or 0. |
| `maxWineriesInOneDay` | Group winery visits by `visit_date`, count distinct `winery_id`, take the max. |
| `distinctAvas` | For each distinct visited winery with `wineries.latitude` and `wineries.longitude`, `regionsAtPoint(lat, lng)`; collect `properties.id`. Wrap the call in try/catch so a bad point never throws. |
| `wineryStates` | Per visited winery: `wineries.state` if present (PR 2 adds it to the select, see 3.5), else the union of `properties.states` from the AVA hits, else a two-letter state parsed from `wineries.address` with `/\b([A-Z]{2})\s+\d{5}/`. `distinctStates` is the set size; `maxWineriesInOneState` is the max count per state. |
| `distinctCellarWines` | Set of wine keys from `wineIdentity(bottle)` across all bottles. |
| `distinctCellarRegions` | Set of `findRegion(bottle.region)?.name` or the trimmed raw string when unknown. Empty strings skipped. |
| `distinctCellarCountries` | Set of `regionCountry(bottle.region)` values that are non-null. |
| `bottlesOpened` | `consumptions.length` where `reason !== 'in_cellar'`. |
| `longestHoldDays` | Max of `(consumed_date - bottle.purchase_date)` in days across consumptions whose bottle has a `purchase_date`. |
| `openedInWindow` | Count of consumptions where the bottle has `drink_from` and `drink_by` and the consumed year is between them inclusive. |
| `ratedTastings` | Wines with `overall_rating > 0`. |
| `tastingsWithNotes` | Wines with non-empty `additional_notes`. |
| `tastingsWithPhotos` | Wines with `photos.length > 0`, else `photo_url` parsed as a JSON array with length > 0. |
| `distinctFlavorNotes` | Set of `flavor_notes.name` across `wine_flavor_notes`. |
| `distinctMonths` | Set of `visit_date.slice(5, 7)` across visits that have at least one wine. |

`consumptions` is an array of `{ bottle_id, consumed_date, reason, quantity, bottle: { purchase_date, drink_from, drink_by } }`; the service in 3.5 builds it by flattening `cellar_consumptions` nested under each bottle.

### 3.4 `lib/achievements/evaluate.js`

```js
// earned: array of { badge_key, tier } rows already in user_achievements.
export function evaluate(facts, earned = []) -> {
  families: [{ key, name, icon, unit, rule, count, tier /* 'bronze'..'platinum' | null */, tierIndex, nextThreshold, nextTier, progress /* 0..1 */, thresholds }],
  grapes:   [{ key /* 'grape:Chardonnay' */, grape, name /* 'Chardonnay' */, count, tier /* 'fan'|'lover'|'devotee'|null */, nextThreshold, progress }],
  oneOffs:  [{ key, shelf, name, icon, rule, points, earned: boolean }],
  newlyEarned: [{ badge_key, tier, points, name, label /* e.g. 'Winery Explorer · Silver' */, icon }],
  points: number, level: levelForPoints(points)
}
```

Rules: a family tier is earned when `count >= thresholds[i]`; every tier at or below the reached tier is "earned" (a jump from 0 to 25 wines earns Bronze, Silver and Gold at once). `newlyEarned` lists every earned `(badge_key, tier)` not present in `earned`. Points are the sum over all earned rows (existing plus new), never over live counts. `grapes` only includes entries with `count > 0` for display, but `newlyEarned` covers all. One-off `badge_key` is the catalog key with `tier: null`.

### 3.5 `lib/achievements/index.js` and service touch-ups

- `lib/cache.js`: add `achievements: 'achievements'` to `CACHE_KEYS`.
- `lib/cellar.js`: add `getCellarHistory()` returning `{ success, bottles, consumptions }` from one query: `.from('cellar_bottles').select('*, wineries ( id, name ), cellar_consumptions ( * )').eq('user_id', user.id)` with no status filter, cached under `CACHE_KEYS.consumptions`. Flatten consumptions with a `bottle` reference to `{ purchase_date, drink_from, drink_by }`. Every place that already invalidates `CACHE_KEYS.cellar` must also invalidate `CACHE_KEYS.consumptions` (add it to the `invalidate(...)` calls in `addBottle`, `updateBottle`, `deleteBottle`, `adjustQuantity`, `linkTasting`; `openBottle` already does).
- `lib/visits.js` `_getUserVisits()`: extend the nested `wineries ( ... )` select with `directory_id, winery_directory ( state )`, and after fetching set `visit.wineries.state = visit.wineries?.winery_directory?.state ?? null`. Keep everything else unchanged.
- `lib/varietals.js`: export `varietalKey`.

`lib/achievements/index.js` exports:

```js
export async function getAchievements()      // { success, facts, result: evaluate(...) , earnedRows } using cached reads; cached under CACHE_KEYS.achievements
export async function refreshAchievements()  // recompute, insert newlyEarned rows, return { success, newlyEarned, result, backfill: boolean }
export async function markSeen(keys)         // set seen_at = now() on the given rows
export async function getUnseen()            // rows with seen_at null
```

`refreshAchievements()` flow: if `!ACHIEVEMENTS_ENABLED` return `{ success: true, newlyEarned: [] }`. Load visits, cellar history and existing rows (`.from('user_achievements').select('badge_key, tier, points, earned_at, seen_at, source').eq('user_id', user.id)`). Build facts, evaluate, insert `newlyEarned` with `source = existingRows.length === 0 && newlyEarned.length > 1 ? 'backfill' : 'live'`. Use `.upsert(rows, { onConflict: 'user_id,badge_key,tier', ignoreDuplicates: true })`; if the unique index expression prevents `onConflict`, fall back to inserting rows one at a time and ignoring unique-violation errors (code `23505`). Invalidate `CACHE_KEYS.achievements`. Never throw.

### 3.6 Tests for PR 2

`__tests__/achievementsFacts.test.js`, `__tests__/achievementsEvaluate.test.js`, `__tests__/achievementsService.test.js` (the last one with `test-utils/fakeSupabase.js`, following `__tests__/cellarService.test.js`). Use a fixture builder that produces visits in the shape of section 1. Mock `lib/avaRegions` with `_setRegionsForTests` or `jest.mock` returning fixed features for known coordinates.

Required cases:
- Each family threshold boundary (count equal to threshold earns, one below does not).
- Two vintages of the same producer and name count as one distinct wine; a nameless wine with the same producer and varietal counts once.
- Shiraz, Syrah and "Syrah/Shiraz" merge into Syrah; Pinot Gris merges into Pinot Grigio; "Red Blend" is not a grape.
- Two visits to one winery: `distinctWineries` 1, `maxVisitsToOneWinery` 2.
- A visit with `winery_id` and `place_type: null` counts for nothing winery-related.
- A point inside a nested AVA yields both AVAs.
- A consumed lot still counts toward `distinctCellarWines`.
- Jump from 0 to 25 distinct wines yields three `newlyEarned` rows and Gold as the family tier; the same evaluate with those rows passed as `earned` yields zero `newlyEarned`.
- Points equal the sum of earned rows only; deleting visits later (lower facts) does not lower points.
- `levelForPoints(0)` is Split with next Half Bottle at 50; `levelForPoints(2300)` is Nebuchadnezzar with `next: null`.
- Service: with `ACHIEVEMENTS_ENABLED` mocked true, first refresh over a seeded journal inserts rows with `source: 'backfill'`; a second refresh inserts nothing; a Supabase failure returns `{ success: false }` and does not throw.

## 4. PR 3, issue #296: surfaces (flag on)

Flip `ACHIEVEMENTS_ENABLED` to `true`.

### 4.1 `components/AchievementBadge.js`

Props: `{ icon, tier /* 'bronze'|'silver'|'gold'|'platinum'|'fan'|'lover'|'devotee'|'earned'|null */, size = 56, locked = false, label }`. Renders a circle with a 3 px ring whose colour comes from a `TIER_COLORS` map defined in the component using theme tokens (bronze: a warm brown, silver: a cool grey, gold: `colors.accent` or the gold token in `styles/theme.js`, platinum: a teal or the theme's secondary; fan/lover/devotee reuse bronze/silver/gold; `earned` uses primary). Locked renders the icon at 35 percent opacity with a dashed ring. Always render the tier label as text under the badge when `label` is passed, so colour is never the only signal.

### 4.2 `components/AchievementSheet.js`

Bottom sheet modelled on `components/CellarOptionSheet.js` (Modal, overlay, handle). Props `{ visible, awards /* newlyEarned */, level, levelUp /* previous level object or null */, onClose, onViewCollection }`. Title "New badge" or "New badges"; each award as a row with `AchievementBadge` at 44 px, `label` and `+N pts`; if `levelUp` show a line "Level up: Level 4 · Magnum"; buttons "See collection" and "Done". Call `tapMedium()` from `lib/haptics.js` when it becomes visible.

### 4.3 `hooks/useAchievementCelebration.js`

```js
export function useAchievementCelebration() -> { check, sheet }
```

`check()` runs `refreshAchievements()`, and if `newlyEarned.length > 0` and the celebration preference is on, sets state that renders `sheet` (the `AchievementSheet` element). It must swallow every error. Preference: `lib/achievements/prefs.js` with `getCelebrationPref()` and `setCelebrationPref(bool)` on AsyncStorage key `achievements:celebrate` defaulting to true, mirroring `getPrefs`/`setPrefs` in `lib/notifications.js`.

### 4.4 Wiring `check()` into save paths

Call `check()` after a successful save and after the existing success alert or navigation, never before, and never awaited in a way that delays the alert:

- `app/log-session.js`: after `notifySuccess()` in both the `updateSession` and `createVisit` branches. Note the create branch does `router.replace('/(tabs)/home')`; the sheet must therefore be hosted somewhere that survives that navigation. Simplest: host the celebration hook in `app/(tabs)/home.js` and `app/(tabs)/profile.js` and have those screens call `check()` inside their existing `useFocusEffect` load, so any save that lands on Home or Profile celebrates on arrival. Then the log-session screen only needs `check()` in the edit branch (which stays on the screen). If the edit branch also navigates away, skip it and rely on the tab screens.
- `app/cellar/add.js`: after `notifySuccess()`; the screen stays open, so render `sheet` in that screen.
- `app/cellar/[id].js`: after `await load()` in the open-bottle handler; render `sheet` in that screen.
- `app/(tabs)/cellar.js`: call `check()` inside the focus load, so deletes and quantity edits are picked up.

Only one sheet should show per event. `refreshAchievements()` inserts rows, so a second screen calling `check()` later finds nothing new. The unseen rows are for the History section, not for repeated sheets.

### 4.5 Screen `app/profile/achievements.js`

Register in `app/_layout.js` as `<Stack.Screen name="profile/achievements" />` next to the other profile screens. Layout, top to bottom:

1. Header row: back button, title "Achievements".
2. Level card: `AchievementBadge` (icon `bottle-wine-outline`, tier `earned`), "Level 5 · Jeroboam", "540 pts", progress bar to the next level with "260 to Salmanazar", or "Top level" at Nebuchadnezzar.
3. Section "Families": one row per family with badge, name, "7 of 15 toward Gold", a progress bar, and the rule text. Use `result.families`.
4. Section "Grapes": grid of `GRAPES` (3 per row) showing tier or locked; caption "N of 18 Fan or better". Under it, a small list of other grapes with counts from `result.grapes` not in `GRAPES` (optional).
5. Section "Collection": five shelves from `SHELVES`; each badge shows name and, when locked, the rule in plain words.
6. Section "History": earned rows sorted by `earned_at` desc with the date; rows from `source: 'backfill'` grouped under one heading "Recognized from your journal".
7. Call `markSeen` for unseen rows when the screen mounts.

Copy the loading, error and empty patterns from `app/sommelier/taste.js`. Empty state before any tasting: "Log your first wine to earn your first badge."

### 4.6 Profile card and Home nudge

- `components/AchievementsCard.js`: level line, three most recent earned badges as 40 px `AchievementBadge`s, "12 of 41 earned", chevron; `onPress` routes to `/profile/achievements`. Insert in `app/(tabs)/profile.js` directly below the `statsContainer` view that holds `VisitStatsCard`, wrapped in the same container style. Data from `getAchievements()` in a `useFocusEffect`.
- `app/(tabs)/home.js` `JourneyCard`: add one optional prop `nextMilestone` (string). Compute it in the Home load from `getAchievements()`: choose the family with the highest `progress` below 1 and format "2 more wineries to Winery Explorer · Silver". Render as a line under `journeySub` with a chevron that opens `/profile/achievements`. If achievements fail to load, render nothing.

### 4.7 Settings toggle

In `app/profile/notifications.js` add a section "Badges" with one `Switch` labelled "Celebrate new badges" bound to `getCelebrationPref`/`setCelebrationPref`. Follow the existing `Switch` row markup in that file.

### 4.8 Tests for PR 3

- `__tests__/achievementBadge.test.js`: renders locked and each tier; label text present.
- `__tests__/achievementSheet.test.js`: renders N awards and the level-up line; buttons call handlers.
- `__tests__/achievementsScreen.test.js`: with mocked `getAchievements` returning a fixture result, the screen shows level, a family progress line, a locked one-off with its rule, and history rows; `markSeen` called on mount.
- Extend `__tests__/homeScreen.test.js` and a new `__tests__/profileScreen.test.js` (if none exists) to assert the nudge line and card render from a mocked result, and render nothing when the mock fails.
- Run the whole suite.

### 4.9 Manual check on the iOS simulator

Log a first tasting at a winery and confirm one sheet shows Winery Explorer Bronze, Wine Discoverer Bronze and Journal Keeper Bronze (plus Region Explorer Bronze if the winery sits inside an AVA), 30 or 40 points, still Level 1 Split with "20 to Half Bottle" or "10 to Half Bottle" on the level card. Open a cellar bottle at home and confirm Cork Popped appears and no winery badge changes. Turn the toggle off and confirm no sheet appears while badges still land in History.

## 5. PR 4, issue #297: follow-ups

Not planned in detail. Candidates: custom artwork; level-up local push via `lib/notifications.js`; share card; non-US region layers feeding `distinctAvas` through the same metric name; threshold tuning from real journals.

## 6. Definition of done per PR

- Tests pass locally, including `migrationHygiene`.
- PR description lists the migration files Nick must apply before the build ships, in order.
- No em dashes in any new copy.
- Screens checked in light and dark appearance on the iOS simulator.
