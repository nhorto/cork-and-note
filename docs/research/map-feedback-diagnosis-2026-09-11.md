# Map feedback diagnosis (iPhone, TestFlight, 2026-09-11)

Nick walked the Wineries map on his iPhone in dark mode and reported nine
things. This doc traces each one to a root cause in code or data, with the
evidence, and proposes a fix. Product calls are marked **PROPOSAL** and are
Nick's to make. Tracking: epic #268.

Live-DB figures below were read from production on 2026-09-11 (Management
API, read-only queries).

## 1. Summary

| # | What Nick saw | Root cause | Fix (proposal) |
|---|---|---|---|
| 1 | Two "Janemark Winery & Vineyard" pins, one visited-looking, one not | The Overture seed contains **two directory rows** for Janemark (ids 8191 and 14220, 2.2 km apart). Tapping one promoted it to a user pin (purple); the other stayed apricot. Neither is a pin Nick dropped. Directory-wide: 959 same-name groups, 1,180 extra rows | Dedupe pass on `winery_directory` (same name + state within 3 km, keep the row with a website/address); persist a `directory_id` on user pins so the map can hide the twin regardless of distance |
| 2 | Tapping an apricot pin turns it purple, and the next tap shows the "View winery & your notes" menu | `handleDiscoverPinPress` calls `findOrCreateWinery`, which **inserts a `wineries` row on every tap**. Purple = "user pin with no visit/wishlist". 26 rows were created in Nick's account today from browsing; 34 of the 53 `wineries` rows in production are tap orphans with no visit, wishlist, or bottle | Stop creating rows on tap. Open a read-only preview from the directory row; create the `wineries` row only on an explicit action (log visit, add to wishlist) |
| 3 | Permanently closed wineries still on the map | Two layers. (a) Only **22 of 14,482** directory rows have any status: status is only learned when a Pro user opens a page (Google `businessStatus` write-back). (b) The ones Nick tapped are now his own purple pins, and user pins are never filtered by status. In Nick's sample, 4 of 22 checked were permanently closed and 2 temporarily closed (27%) | Short term: never promote a closed directory row; hide/badge user pins whose directory twin is closed; clean today's orphans. Medium term: bulk pre-validation of the directory via Google (see §4) |
| 4 | Green (visited) is hard to tell apart | Visited, wishlist, discovery and plain pins differ **only by fill colour** (sage, slate, gold, purple), all with the same wine glyph, in a 32 pt circle. In dark mode the sage `#90B49A` sits on a near-black map | Encode state by shape too: check badge on visited, bookmark glyph on wishlist, hollow ring for discovery; add a tappable legend under the chips |
| 5 | Wine regions hard to see in dark mode | Polygons use `primary.base` at **12% alpha fill and a 1.5 pt stroke**. In dark mode `primary.base` is `#64399B` against MapKit's dark grey basemap | Dark-mode region tokens: gold or lavender stroke (`accent.base` / `primary.soft`), 2 pt, fill ~18%; selected region uses a brighter stroke |
| 6 | Overlapping pins and labels in Napa | Cluster radius is **44 px** but each label is up to **140 pt wide**, and labels turn on at zoom 11.5 for every unclustered pin. Napa box holds **1,482** directory rows; the viewport query caps at **750**, so a whole-valley view also silently drops wineries. 4,005 directory rows (28%) have another row within 150 m (Healdsburg has 6 wineries at one coordinate) | Labels only from zoom 13 and only for user pins below 14; wider cluster radius (60) while labels are on; raise or paginate the 750 cap (or tile the bbox) |
| 7 | "Loading wineries…" looks archaic | It is a plain text pill in the notice stack that **flips to loading on every pan** (effect runs on each `region` change, before the 350 ms debounce) | Replace with a small spinner inside the search pill, shown only after ~400 ms of loading; skip the state flip when the new bbox is inside the last loaded one |
| 8 | Are all wine regions in there? | We ship **276** AVAs (UC Davis, commit pinned 2025-12-10). TTB lists **280** as of 2026-08-18. Missing: Tryon Foothills (NC), Nashoba Valley (MA), Nine Lakes of East Tennessee (TN), Columbia Hills (WA, effective 2026-09-16). Upstream does not have them either | Hand-digitise the four from the Federal Register boundary descriptions into an addendum GeoJSON merged at build time; add a CI check that compares our count to TTB's page |
| 9 | Search sheet: list vanishes while typing, no empty state, keyboard won't dismiss, can't scroll | The places sheet is a plain `Modal` with **no keyboard avoidance**; it sizes to content, so with a short list the whole sheet (empty state included) sits **behind the keyboard**. Nothing in the sheet dismisses the keyboard except the return key; tapping the backdrop closes the sheet | Wrap in `KeyboardAvoidingView` (pattern already used in `ManualWineryEntryModal`), give the sheet a fixed height when a tab is active, `keyboardDismissMode="on-drag"`, tap-outside-input dismisses keyboard, and a Cancel/Done affordance |

## 2. Findings in detail

### 2.1 Duplicate Janemark pins (directory duplicates, not dropped pins)

Production `winery_directory`:

```
id     name                          lat        lng         city        operating_status
8191   Janemark Winery & Vineyard    38.670288  -76.735845  Brandywine  null
14220  Janemark Winery & Vineyard    38.680784  -76.757085  Brandywine  null
```

Nick's `wineries` row 364 ("Janemark Winery & Vineyard", created 2026-09-11,
address "Brandywine, MD", 0 visits) has the exact coordinates of directory
row 14220, so it was created by tapping that discovery pin
(`app/(tabs)/map.js` `handleDiscoverPinPress` → `findOrCreateWinery`). The
map hides a discovery pin only when a user pin is within 150 m
(`haversineKm(...) < 0.15`), so row 8191 stays visible as a second pin.

Nick's visited pin in that area is "Robin hill" (winery 327, visit
2026-07-26), 31 m from directory row 6209 "Robin Hill Farm and Vineyards".
There is no visit or wine on the account linked to Janemark; the green pin
he saw next to it is Robin Hill.

Directory-wide duplicate scale (same lower-cased name in the same state):
959 groups, 1,180 surplus rows. Same name within roughly 5 km: 524 pairs.
The seed SQL in `data/winery-directory/README.md` dedupes on exact
name+coordinates only, which Overture's near-duplicates slip past.

**User-pin vs directory reconciliation** also needs more than distance.
Nick's seven visited pins against their nearest directory row:

```
Daveste Vineyards        → Davesté Vineyards                        11 m
Paradise Springs         → Paradise Springs Winery                  24 m
Robin hill               → Robin Hill Farm and Vineyards            31 m
Hark                     → Hark Vineyards                           35 m
Prince Michel Vinyard…   → Prince Michel Vineyard & Winery          38 m
Apple works winery       → Apple Works Winery                      167 m   (shows twice today)
Chisolm Winery           → Chisholm Vineyards at Adventure Farm    194 m   (shows twice today)
```

Two of seven already exceed the 150 m threshold and render as a green pin
next to an apricot twin. Widening the radius alone would swallow legitimate
neighbours (28% of directory rows have another row within 150 m, e.g. the
Healdsburg and Woodinville tasting-room blocks).

**PROPOSAL**

- Add `wineries.directory_id` (nullable FK to `winery_directory`). Set it
  when a pin originates from a directory row (tap, Near You, Find, region
  sheet). For legacy pins, backfill once with a name-token + 300 m match and
  let the winery page offer "Is this &lt;directory name&gt;?" to confirm the
  link.
- Map dedupe becomes: hide any discovery pin whose id is linked from a user
  pin, plus the existing 150 m fallback for unlinked pins.
- One-off directory dedupe: within (lower(name), state), cluster rows within
  3 km, keep the one with website, then address, then lowest id; mark the
  rest `operating_status = 'duplicate'` (new enum value, so nothing is
  hard-deleted and the loader's re-ingest logic keeps working). Expected to
  retire roughly 1,000 rows.
- Fuzzy pass after that (same normalised name ignoring "Winery", "Vineyards",
  "&", "and", "at …" suffixes) reviewed by hand before applying.

### 2.2 Tapping a pin creates a winery ("yellow turns purple")

`handleDiscoverPinPress` promotes a directory row to a `wineries` row before
navigating, so the page has an id to load, the Google card has a row to
enrich, and `PastVisitsSection` has something to query. The side effects:

- The pin re-renders purple (`getMarkerColor`: not visited, not wishlisted →
  `primary.base`). Purple reads as "mine".
- The next tap opens `PinActionModal` ("View winery & your notes / Log a
  visit / Add to wishlist / Remove pin"), one extra step to get back to the
  page.
- Browsing pollutes the account. Nick's account gained 26 rows today
  (ids 348 to 373). Across production, 34 of 53 `wineries` rows are orphans
  with no visit, wishlist entry or cellar bottle. These rows also appear in
  the log form's PlacePicker suggestions.
- Closed wineries become permanent user pins (see 2.3).

**PROPOSAL**

- Discovery pin tap opens the winery page in **preview mode** keyed by
  `directoryId` (route `/winery/directory/<id>` or `/winery/new?directoryId=`),
  which renders the same page from the directory row plus the Google card,
  with no `wineries` row. The Google card already accepts `directoryId` and
  the places function already writes status back by directory id, so
  enrichment keeps working.
- "Log a visit", "Add to wishlist", and "Save to my places" on that page are
  the only actions that call `findOrCreateWinery` (with `directory_id`).
- Pin colours then mean what they look like: gold = directory, purple =
  saved but not visited (rare, explicit), slate = wishlist, sage = visited.
- Same tap behaviour for Near You, Find results, and the region sheet's
  winery list (all currently promote).
- Cleanup migration: delete `wineries` rows with no visit, wishlist, bottle,
  favourite, or report reference, created after 2026-09-09 (the day
  promotion shipped). Run once, after the new build is live.

### 2.3 Permanently closed wineries on the map

How status is learned today (`supabase/functions/places/index.ts`,
`lib/wineryDirectory.js`):

1. A Pro user opens a winery page → details call → Google `businessStatus`
   is written to `winery_directory.operating_status`.
2. Discovery queries filter `operating_status != 'permanently_closed'`.

Production today: 14,460 rows `null` (unknown), 16 `open`, 4
`permanently_closed`, 2 `temporarily_closed`. All 22 stamped rows are the
ones Nick opened today, so the write-back works, and the map already hides
those four apricot pins. What Nick still sees are his own promoted purple
pins for those same wineries (Cardamon Family Vineyards, Great Shoals,
Royal Rabbit, Fridays Creek), which no filter touches.

The bigger point: **27% of the wineries Nick sampled were not operating**
(4 permanently + 2 temporarily closed of 22). Small sample, one region,
but if it holds even loosely across the directory, thousands of the 14,482
rows are dead. Overture's own `operating_status` excluded permanently
closed at extract time, but Overture's coverage of closures is thin. Nobody
has filed a `winery_reports` row yet.

**Why we can't just "know"**: there is no free, authoritative, US-wide list
of operating wineries. TTB publishes bonded winery permits (producers, not
tasting rooms, and it lags closures). State wine boards cover their state
only. Google is the best closure signal and costs money per row.

**PROPOSAL (three tiers, Nick picks how far to go)**

- **Tier 0, ship with the next build**: never promote a directory row with
  `permanently_closed`; if a user pin is linked to a closed directory row,
  show a "Permanently closed" badge on the pin label and page and drop it
  from the Nearby filter; show "Temporarily closed" on the page only.
- **Tier 1, bulk pre-validation (near-zero spend if paced)**: a server
  script that matches each directory row to a Google place id (Text Search
  IDs-Only: free, unlimited) and then fetches `businessStatus` with a
  field mask of just `id,businessStatus`. `businessStatus` sits in the
  Place Details **Pro** SKU (verified 2026-09-11 on the Places (New) docs):
  $17 per 1,000, with **5,000 free calls per month**. So 14,482 rows costs
  about $161 if run in one go, or **$0 if paced at 5,000 rows a month over
  three months**, and a quarterly refresh (≈4,800 rows a month) stays
  inside the free cap forever. Start with the states users are actually in
  (VA, MD, PA, NC, CA). This also fills `google_place_id` for every row,
  which makes the existing per-page write-back hit every time. The Google
  project's quota cap (Details 500/day) is fine for the paced run (≈170 a
  day), and the script must use a field mask that never touches Enterprise
  fields (rating, hours) or the cost jumps to $20 to $25 per 1,000.
- **Tier 2, keep it fresh**: quarterly Overture re-ingest (already built,
  flags `possibly_closed`), the Tier 1 status refresh on the same cadence,
  in-app "Report a problem" (already built) surfaced more visibly on
  closed-looking pages, and a simple owner dashboard query for reports.
- Trip planner: exclude anything not `open`/`null` and warn in the plan when
  a stop's status is unknown ("hours not verified").

### 2.4 Pin state legibility (visited green)

`app/(tabs)/map.js` `renderPinMarker` / `renderDiscoverMarker`: every pin is
a 32 pt circle with the `wine` glyph. State is only the fill:

| state | light | dark |
|---|---|---|
| visited | `#55745E` sage | `#90B49A` |
| wishlist | `#596F8B` slate | `#A8B8D4` |
| saved, no visit | `#54258A` purple | `#64399B` |
| directory | `#D6B45D` gold | `#E0BE6C` |

Sage vs slate is a close pair, and on the dark basemap the desaturated
sage is the least distinct of the four. The chips carry a colour dot but no
legend explains it.

**PROPOSAL**: visited = filled sage with a white check badge at the top
right; wishlist = filled slate with a bookmark glyph; directory = hollow
ring (gold stroke, translucent fill) with the outline wine glyph; saved =
purple filled (only after the 2.2 change makes it explicit). Add a
one-line legend beneath the chips that appears for the first three
sessions and behind the ? button after.

### 2.5 Wine regions in dark mode

`Polygon` props: `fillColor = withAlpha(primary.base, 0.12)`, `strokeColor =
primary.base`, `strokeWidth 1.5`. Dark `primary.base` is `#64399B`, a mid
purple, on Apple's dark basemap (greys around `#2B2B2B`). Contrast of the
stroke is roughly 1.9:1; the fill is invisible.

**PROPOSAL**: theme-aware region tokens in `styles/mapTheme.js`:

- dark: stroke `accent.base` (`#E0BE6C`) at 2 pt, fill `withAlpha(accent.base, 0.16)`, selected stroke 3 pt + fill 0.26
- light: keep purple, raise fill to 0.16 and stroke to 2 pt

Label the region name at the polygon centroid from zoom 8 (one `Marker` per
visible region with `tracksViewChanges=false`), which also answers "which
region is this" without a tap.

### 2.6 Overlap in dense areas (Napa)

- `buildClusterIndex` uses `radius: 44`, `maxZoom: 15`. Pins 45 px apart do
  not cluster.
- Labels render for every unclustered pin once `zoom >= 11.5`
  (`showLabels`), each up to 140 pt wide, so two pins 50 px apart get
  overlapping labels.
- `getInBounds` caps at 750 rows ordered by id. The Napa box
  (38.2..38.7, -122.6..-122.1) holds 1,482 rows, so a whole-valley view
  shows about half, chosen by id, and the padded bbox (0.3) makes it worse.
- Coordinate stacking is real data, not a bug: 90 coordinates carry 202
  rows (Healdsburg 6 at one point, Woodinville 5). Clustering handles
  those, but at `maxZoom 15` they never split, so the user can never tap
  the individual tasting rooms.

**PROPOSAL**

- Labels: user pins from zoom 12, directory pins from zoom 14; cluster
  radius 60 while labels are on, 40 below.
- Data cap: raise the limit to 2,000 when the bbox is under ~0.6° wide, and
  request in two halves when over; or move to a PostGIS RPC returning
  server-side clusters for wide views (bigger change, defer).
- Stacked coordinates: `maxZoom 17` so the last cluster expands into a
  spiderfied ring (offset each pin 12 px around the centre) at zoom 17+.

### 2.7 "Loading wineries…"

The status pill is `Text` inside the notice stack. The bounds effect sets
`discoveryStatus('loading')` synchronously on every `region` change and the
fetch runs 350 ms later, so every pan flashes the text even when nothing
new will load. The empty/error strings share the same look.

**PROPOSAL**: a 16 pt `ActivityIndicator` inside the search pill (right
side, replacing the list icon while loading), shown only if loading lasts
more than 400 ms; keep the text pill only for error (tappable retry) and
for "no wineries here" after a completed fetch. Skip the loading state when
the new bbox is fully inside the previously fetched bbox and that fetch was
under the cap.

### 2.8 AVA coverage

- App asset: 276 features (`assets/data/avas.json`, meta commit
  `5208ac65…`, fetched 2026-09-11). UC Davis `master` is unchanged since
  2025-12-10 and also has 276.
- TTB "Established AVAs" page, last updated 2026-08-18: **280**, California
  154. Diff by normalised name:
  - Tryon Foothills, NC (27 CFR 9.298)
  - Nashoba Valley, MA (9.299, established 2026-03)
  - Nine Lakes of East Tennessee, TN (9.300)
  - Columbia Hills, WA (9.301, effective 2026-09-16)
- Proposed, not yet established (do not add): Champlain Valley of Vermont,
  Kaw Valley (KS), Rancho Santa Fe (CA).
- Every other name matched (the ten "mismatches" in the raw diff were
  dash/apostrophe encoding differences only).

**PROPOSAL**: add `data/ava-addendum/*.geojson` hand-traced from each
Federal Register boundary description (they cite USGS quad lines, roads and
elevation contours; 1 to 2 hours each), merged by `build-ava-regions.mjs`
with a `source: 'addendum'` property; a `scripts/check-avas.mjs` that
fetches the TTB page and fails CI if the count differs from ours; ship the
sheet copy "280 AVAs" only after the four land. Also open a PR upstream to
UC Davis so the next rebuild can drop the addendum.

### 2.9 Search sheet keyboard UX

`app/(tabs)/map.js`, "Searchable list of visited places" `Modal`:

- `listSheet` has `maxHeight: '75%'` and no min height, so it is as tall as
  its content. With a short list or an empty state the sheet is ~250 pt,
  and the iOS keyboard (~336 pt on a 6.7" phone) covers it entirely. That
  is the "whole screen goes away" and "gibberish shows nothing" report:
  the `ListEmptyComponent` renders, behind the keyboard.
- No `KeyboardAvoidingView`. The pattern exists in
  `components/ManualWineryEntryModal.js:141`.
- Keyboard dismissal: only the return key (`returnKeyType="search"`, no
  `onSubmitEditing`). No `keyboardDismissMode="on-drag"` on the FlatList,
  no tap-to-dismiss on the sheet body. Tapping the dimmed backdrop closes
  the whole sheet.
- Scrolling: the FlatList is fine, but it is under the keyboard.
- Minor: opening via the top search pill sets the tab to Find but the
  header still says "Your places".

**PROPOSAL**

- Sheet gets a fixed height (72% of the window) whenever it is open, so
  the list area is stable, wrapped in `KeyboardAvoidingView`
  (`behavior="padding"` on iOS) so the list shrinks above the keyboard.
- `keyboardDismissMode="on-drag"` + `keyboardShouldPersistTaps="handled"`
  on the FlatList; a `Pressable` wrapper on the sheet body that calls
  `Keyboard.dismiss()`; `onSubmitEditing` dismisses.
- Header title follows the tab ("Find a winery" / "Your places"); a Done
  button in the header.
- Empty and loading states render at the top of the list area (they do
  now, they were just hidden).
- Consider `@gorhom/bottom-sheet` later; not needed for this fix.

## 3. Sequencing (proposal)

1. **Build-blocking, small**: 2.9 search sheet, 2.7 loading indicator,
   2.5 dark-mode regions, 2.6 label thresholds. Pure client changes, one PR
   each or one combined "map polish" PR.
2. **Behaviour change**: 2.2 preview-not-promote (touches map, Near You,
   Find, region sheet, winery page) + `wineries.directory_id` migration +
   orphan cleanup. This is the change that fixes the purple-pin confusion
   and stops closed wineries becoming user pins.
3. **Data**: 2.1 directory dedupe migration; 2.3 Tier 0 in the same PR as
   step 2; Tier 1 bulk validation as a script with a budget line for Nick
   to approve.
4. **Pins and legend**: 2.4.
5. **AVA addendum**: 2.8, can run in parallel, no dependencies.

## 4. Decisions needed from Nick

1. Preview-not-promote (2.2): agree that tapping a directory pin should not
   create a saved place, and that "Save to my places" becomes explicit?
2. Closed wineries (2.3): approve Tier 1 bulk validation (free if paced at
   5,000 rows a month, about $161 if run at once), or stay with lazy
   per-page validation?
3. Directory dedupe (2.1): OK to retire ~1,000 duplicate rows by flagging
   (not deleting)?
4. Pin shapes (2.4): check badge / bookmark glyph / hollow ring, or a
   different vocabulary?
5. AVAs (2.8): worth hand-tracing four boundaries now, or ship "276 of 280"
   with a note until upstream catches up?
