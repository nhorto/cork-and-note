# Pre-launch test campaign: plan and running status

**Date:** 2026-09-11 · **Trigger:** owner request to find real bugs before App Store submission, not to pad coverage
**Related:** [`app-store-readiness-2026-09-10.md`](../business/app-store-readiness-2026-09-10.md) §4, epic [#160](../../issues/160)

The app ships with few external testers, so the test suite has to do the job a QA team would. This document is the plan of record for that work and is updated as tracks land.

## Baseline on 2026-09-11 (main at `fc03253`)

| Fact | Value |
|---|---|
| Test files / tests | 41 / 641 |
| Screens ever rendered by a test | 5 of 36 |
| Components ever executed by a test | 20 of 58 |
| Edge functions with executed tests | 0 of 5 (only `_shared/entitlements.ts` and `_shared/claudeResponse.ts`) |
| `lib/` code with no executed assertion | about 35 percent (3,395 of 9,797 lines) |
| Error boundary | none anywhere in the app |

**The suite was flaky, not red.** At the default worker count on a busy machine with a cold transform cache, the three heaviest render suites (map, AVA layer, report modal) failed their first test with a timeout and then every later test in the file failed with "Can't access .root on unmounted test renderer". The same files pass alone or at half the worker count. The mechanism: React Native's index loads most modules lazily, so the first render in a file transforms hundreds of modules inside the first test's timeout. PR #249 raised the timeout to 20 seconds, which was not enough under load.

Rule for every track: a test must assert behavior (the calls made and their arguments, navigation, what the user sees on failure). Render-and-contains-text tests are not accepted. A test that finds a bug is fixed in the same PR when the fix is a few lines, and the failing test is kept; larger fixes get an issue.

## Tracks

### 1. Foundation (this PR)

- `maxWorkers: 50%` and a 60 second per-test timeout in the jest config, so the only thing that can hit the timeout is a hung test. `cacheDirectory` pinned to `.jest-cache` and restored by `actions/cache` in CI so the first render on a cold runner is cheap. Haste no longer scans `.claude/worktrees`.
- `jest.setup.js` registers the AsyncStorage and Reanimated mocks once. `test-utils/fakeSupabase.js` is an in-memory supabase-js client that records every query and evaluates the builder chain against seeded rows, so a service can be run for real and both its calls and the rows it leaves behind can be asserted. `test-utils/mocks.js` holds the expo-router, maps and `usePro` factories screen tests kept re-declaring.
- `react-test-renderer` is now a declared devDependency (it was only reachable as a transitive dependency of jest-expo).
- Coverage collection covers `app/`, `components/`, `hooks/`, `utils/` and `styles/`, not just `lib/`, so the number is honest.
- Structural tests that catch whole classes of bugs: every navigation target resolves to a route file and every route is reachable (`structure.routes.test.js`); iPhone-only, permission strings, New Architecture off, no committed API keys, every invoked edge function exists, every required asset exists (`structure.config.test.js`).
- First data-layer suite on the fake client: `cellarService.test.js` (open bottle through the RPC, kept-bottle semantics, owner scoping, allowed-column filtering, cache invalidation).

### 2. Data layer (in progress)

Behavior tests on the fake client for `lib/visits.js` (the primary write path and photo upload partitioning), `lib/chat.js`, `lib/wineries.js`, `lib/wishlist.js`, `lib/places.js`, `lib/notifications.js`, `lib/cache.js` across sign-out, `lib/cellarScan.js` normalization, and the real `ProProvider` and `usePro`. The photo pipeline gets its own set: resize thresholds, bucket and path per photo type, HEIC handling, and what the user sees on each failure.

### 3. Edge functions executed for real (merged, #282)

Each function exports `createHandler(deps)` with `Deno.serve` behind `import.meta.main`, so `deno test` drives it with a fake Supabase client, a fake fetch and a fake clock (`_shared/testing.ts`). 76 tests: auth 401, body validation, the 402 and 429 shapes and copy, fail-closed 503 paths, model and token selection per task, the exact request to Anthropic, `pause_turn` resumption, the webhook secret and every RevenueCat event type, places and routes caps and field masks, the directory write-back guard, and the CORS origin rule. The CI deno job runs `deno test` after `deno check`. No handler bugs found.

### 4. Screens and components (branch `test/screens-and-components`)

Render tests with interaction for the untested surfaces, in launch-risk order: auth (done), paywall and choose-plan and the real Pro provider, cellar tab and detail and add including the 25-bottle cap, home, journal and wine detail, sommelier tab paywall handling, scanners and the photo picker with mocked camera and picker, log form, map modals, age gate, offline banner, plus an error boundary in the root layout.

Suspects handed to this track from the code read, each to be pinned by a failing test first: wishlist dereferences `item.wineries.name` with no null guard; the sommelier tab renders a server 402 as an assistant bubble instead of opening the paywall; the chat image picker is the only call site without a try/catch; reset-password enforces a weaker password rule than register (fixed on the branch); winery directions build a URL with undefined coordinates; the journal treats a failed load as "no wines".

### 5. Device runs (after the simulators are free)

Maestro flows checked into `.maestro/` so they are rerunnable: signup, age gate, plan choice, log a wine with a library photo, label scan, map clusters and search and the AVA toggle, cellar add and open, free versus Pro chat, paywall offerings, account deletion. iOS simulator first, then the Android emulator for function only (its colors are a known false alarm on this display). Known Android issues filed from the owner's own emulator pass are checked against the run rather than re-diagnosed.

### 6. Backend parity (merged, #283)

`scripts/verify-backend-parity.mjs` checks every migration file is recorded as applied on the live project and that a sentinel schema object from each structural migration exists, that no deployed function is older than the last commit touching it or the shared files it imports, that the three storage buckets exist with the right visibility, and that row-level security is on for every user table. `scripts/rls-probe.mjs` creates two throwaway users through the app's sign-up, has one write a row in each of 13 user-scoped tables and an object in every bucket, proves the other (and a signed-out client) can read, update and delete none of it and cannot open the first user's bottle, then deletes both through the app's own delete-account path and verifies zero residue. `__tests__/migrationHygiene.test.js` keeps the repo's migration story straight offline.

Run live on 2026-09-11: every table and RPC held; both accounts left no residue. One leak found (table below).

## How to run

```sh
npm test                         # full jest suite (44 suites as of this PR)
npx jest --coverage              # honest coverage across app, components, hooks, lib, utils, styles
cd supabase/functions && deno test   # edge function tests (Track 3)
node scripts/verify-backend-parity.mjs   # Track 6, read-only, needs a Supabase access token
```

## Bugs found by this campaign

Each has a test that fails on the previous code and is fixed in the same PR.

| Where | What | Found by |
|---|---|---|
| `lib/cache.js` | A read still in flight during sign-out wrote its result back after the next sign-in, so the new account got a cache hit on the previous account's rows. `clearAll()` now bumps every generation counter. | `cache.test.js` |
| `app/(tabs)/sommelier.js` | The server's 402 for a spent free meter was rendered as an assistant bubble ("Sorry, I encountered an error...") with no way to upgrade. It now opens the paywall like every other AI surface. | `sommelierSend.test.js` |
| `app/winery/[id].js` | A hand-added winery without a pin still offered Directions and opened Apple Maps at `ll=null,null`. URL logic moved to `lib/directions.js`; the button hides without coordinates. | `directions.test.js` |
| `components/ChatInput.js` | The only picker call site with no guard; a native picker rejection became an unhandled promise rejection from an Alert button. | `chatInput.test.js` |
| `app/(tabs)/wines.js` | A handled backend failure (`{ success: false }`) rendered "No wines found" or the previous list instead of the retry state. | `journalScreen.test.js` |
| `app/(tabs)/wishlist.js` | `item.wineries.name` with no null guard crashed the tab when a row's winery was not readable. | `wishlistScreen.test.js` |
| `lib/ai.js` | The tasting-menu parser's array fallback was unreachable whenever the array held objects (the greedy object match ran first and failed to parse), so a reply that dropped the fence was reported as unreadable. The fenced-JSON reader matched tags by prefix, so asking for `wine_list` on a `wine_list_picks` block read the picks as a list. | `aiParsers.test.js` |
| `lib/cellarScan.js` | The convenience wrappers destructured their argument, so a null image threw instead of returning the service's soft failure. Both callers guard today; the wrappers now match the service's contract. | `cellarScan.test.js` |
| `app/_layout.js` | No error boundary anywhere: a render throw was a blank white screen. `components/ErrorBoundary.js` now wraps the navigator inside the providers with a retry that remounts. | `errorBoundary.test.js` |
| Storage policies on `visit-photos` and `wine-photos` | The read policies had no owner or role condition, so any caller could list every object name. The anon key ships in the app and the buckets are public, so a signed-out client could fetch every user's photos. Migration `20260911200000_photo_buckets_owner_list.sql` scopes reads to the owner; public URL display is unaffected. **Committed, not yet applied live.** | `scripts/rls-probe.mjs` |

Pinned, not changed (documented reliance on row-level security): the chat usage counters in `ProProvider` and the per-conversation chat reads carry no `user_id` filter. `deletePhotos` removes by the last path segment, which is only correct for flat visit and wine photo names.

## Live actions owed (need a deliberate deploy step)

1. `supabase db push` to apply `20260911200000_photo_buckets_owner_list.sql`, then `node scripts/rls-probe.mjs` (expect zero problems).
2. Redeploy all five edge functions from main (the `createHandler` refactor plus the shared-module drift the parity check flags on `places` and `revenuecat-webhook`), then `node scripts/verify-backend-parity.mjs` (expect "Live backend matches the repo").

## Status log

- 2026-09-11: baseline measured; flakiness root-caused and fixed; foundation, structural and cellar-service tests added. Tracks 3, 4 and 6 started on their branches; Track 4 has the auth suites and the shared password rule committed; Track 3 has the handler refactor committed.
- 2026-09-11, later: data-layer suites for visits, chat, cache and the real Pro provider; screen suites for the sommelier send path, chat input, journal and wishlist; six bugs found and fixed (table above). PR #266 at 53 suites, 746 tests, green.
- 2026-09-11, night: #266, #267, #282 and #283 merged. Track 3 (edge functions, 76 deno tests) and Track 6 (parity script, RLS probe, migration hygiene) done; the RLS probe found the public-bucket listing leak. Track 4 closed out with the wine entry form suite (#284). Remaining: Track 5 device runs (simulators still in use by another session) and the em-dash sweep.
- 2026-09-11, evening: AI parsers and photo path, scan normalizers, error boundary, cellar add/tab/bottle screens, home, log session, both scan cards, age gate and offline banner, map sheets. Three more defects fixed (table above). PR #266 at 64 suites, 907 tests, green. PR #267 carries the auth suites, the shared password rule, and the paywall suite. Remaining from Track 4: log form internals (varietal to type inference, half-star input), and the Track 3, 5 and 6 branches.
