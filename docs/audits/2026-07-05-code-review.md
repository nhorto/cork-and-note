# Production-Readiness Code Review — Cork & Note

**Review date:** 2026-07-05
**Branch reviewed:** `claude/objective-panini-9356f0` (even with `main` @ a874ce9 at review time)
**Scope:** four parallel deep reviews — data layer/Supabase, screen logic, component logic, config/infra — plus a same-day fix pass.
**Fix commits (same branch):** `8a276b0` data/security · `51a6b53` auth · `4c5fc9b` screens · `13c6d39` components · `b1847f6` config · `1a46827` pruning.
**Status legend:** ✅ FIXED (commit) · 🔲 OPEN (not yet done) · 👤 USER (only Nick can do it).

> ⚠️ The three new migrations are **written but not applied** to the remote Supabase project. Until `supabase db push` (or SQL-editor apply) runs: the photo-deletion hole and the flavor-notes 42501 bug still exist in production.

---

## Critical

| # | Finding | Where | Status |
|---|---|---|---|
| C1 | `visit-photos`/`wine-photos` storage UPDATE/DELETE policies checked only `authenticated` — any user could enumerate (public SELECT) and destroy every user's photos. Same class as the chat-photos fix (20260221/20260609010000). Fix scopes on `owner_id` (not filename parsing — BottlePhotoPicker uploads under `cellar/` without owner-prefixed names). | 20260608000000_create_storage_buckets.sql:23-41 → **new migration 20260705000000** | ✅ 8a276b0 (👤 needs db push) |
| C2 | Password reset broken end-to-end: reset email deep-links to `corkandnote://reset-password` but no such route existed, no PASSWORD_RECOVERY handling, nothing called `updateUser({password})`; token was discarded and the user bounced to login. | app/_layout.js:263-273; new **app/reset-password.js** (fragment tokens + PKCE code handled; nav guard exempts the route) | ✅ 51a6b53 |
| C3 | Nick's reported 42501: `flavor_notes` has RLS but **no INSERT policy in any migration** (20260619000000's comment references one that only ever existed ad-hoc). Compounding: the error was swallowed (console.error) and the save reported success — custom notes silently dropped. | lib/visits.js:280-304 → **new migration 20260705010000** + `notesFailed` propagated through createVisit/updateWine/updateSession and surfaced in log-session save alerts | ✅ 8a276b0 (👤 needs db push) |
| C4 | App icon / adaptive-icon / splash are Expo template placeholders (adaptive + splash byte-identical). Store submission blocker. Real logo at `assets/images/cork_and_note_logo.png` (1.2 MB, unused). | app.json:7,23,55 | 👤 OPEN |
| C5 | Google Maps Android API key committed in plaintext. Restrict to Maps SDK for Android + package `com.nicholashorton.corkandnote` + release SHA-1 (or rotate), then inject via app.config.js/EAS env. | app.json (android.config.googleMaps.apiKey) | 👤 OPEN |

## Major

### Data layer
| Finding | Where | Status |
|---|---|---|
| Multi-step writes non-transactional: createVisit (visit→wines), openBottle (visit→wine→consumption→quantity) — mid-flow failure leaves orphan sessions / inventory disagreeing with history; quantity update is an unguarded read-modify-write (two devices double-count). Proper fix = single plpgsql RPC per flow (SECURITY INVOKER), or compensating deletes + `.eq('quantity', prev)` optimistic guard. | lib/visits.js:152-192, lib/cellar.js:333-464 | 🔲 OPEN |
| `delete_user_data()` declared variable `user_id` shadowing the column — `WHERE user_id = user_id` is ambiguous (raises by default; under `use_column` would delete EVERYONE's data, SECURITY DEFINER). Rewritten: `v_user_id`, qualified predicates, auth guard, covers cellar/chat tables. | DataBase Schema.txt:587-645 → **new migration 20260705020000** | ✅ 8a276b0 (👤 needs db push) |
| Edge-function 4xx bodies (e.g. "Daily limit reached") never reached users — functions.invoke buries them in `error.context`. Now extracted and thrown as the real message. | lib/ai.js:138-150 | ✅ 8a276b0 |
| Cache pinned `{success:false}` results for the 5-min TTL, and invalidate() didn't cancel in-flight reads (pre-mutation read could re-store stale data). Now: failures never cached; per-key generation counter + inflight drop on invalidate. | lib/cache.js | ✅ 8a276b0 |
| No repo artifact creates `public.users` rows (the `handle_new_user` trigger lives only in the prod dashboard) — a DB rebuilt from migrations breaks on first user-scoped insert. Commit the trigger as a migration. | supabase/migrations/ (absent) | 🔲 OPEN |

### Screens
| Finding | Where | Status |
|---|---|---|
| Visit dates rendered one day early west of UTC (`new Date('YYYY-MM-DD')` = UTC midnight, formatted local). LogSessionForm/TastingLinkCard already had `timeZone:'UTC'`; four surfaces missed it. | wines.js:228, wine/[id].js:121, PastVisitsSection.js:83, VisitStatsCard.js:85 | ✅ 4c5fc9b/13c6d39 |
| Fetch failures rendered as empty accounts: cellar showed "Start your cellar" onboarding on error (and the failure was cached), home rendered zeros, map showed the first-run hint. All now show inline error + retry. | cellar.js:65, home.js:43, map.js:85 | ✅ 4c5fc9b |
| wines & wishlist tabs loaded once per user (no focus refetch) — new logs invisible until pull-to-refresh. Converted to useFocusEffect. | wines.js:52, wishlist.js:30 | ✅ 4c5fc9b |
| Free-text date field passed any string to Postgres (raw DB error after filling a whole session; region-ambiguous strings silently interpreted by server DateStyle). Now validated (regex + UTC round-trip) with error-red preview. | LogSessionForm.js:282,446 | ✅ 13c6d39 |
| Google/Apple sign-in buttons had no `onPress` (dead UI; Apple requires SIWA if Google is shown). Removed with the OR divider until real OAuth ships. | login.js:134, register.js:250 | ✅ 51a6b53 (OAuth itself 🔲/👤 if wanted) |
| Duplicate-email signup showed "Account Created!" (Supabase returns no error + `identities: []` for existing emails) and left auth `isLoading` stuck on confirm-email signups (nav guard disabled). | register.js:96, _layout.js:218-240 | ✅ 51a6b53 |
| PII (user emails/ids) in console logs shipping to device logs. Removed; plus babel strips console.log/info/debug in production (errors/warns kept). 149 console statements existed repo-wide. | _layout.js:66-140; babel.config.js (new) | ✅ 51a6b53/b1847f6 |

### Components
| Finding | Where | Status |
|---|---|---|
| Photo-viewer pagers hardcoded 400pt page width while pagingEnabled snaps to screen width (photos drift/clip per swipe); WineEntryForm's "N of M" indicator had no scroll handler at all. Now Dimensions-based + onMomentumScrollEnd. | WineEntryForm.js:859/1224, PastVisitsSection.js:300/618, wine/[id].js:376-401 | ✅ 13c6d39/4c5fc9b |
| TonightsPickCard loaded the cellar once on mount — empty-cellar CTA never cleared after adding a bottle; AI grounded on stale inventory. Now reloads on focus. | TonightsPickCard.js:84-96 | ✅ 13c6d39 |
| WineEntryForm "Save Wine" had no double-tap guard → duplicate wines in a session. | WineEntryForm.js:709 | ✅ 13c6d39 |
| Header.js contained TWO `export default`s (a stale pasted copy of _layout.js with the old purple + a stale-closure bug) — bundle-breaking if ever imported. Deleted. | components/Header.js | ✅ 1a46827 |

## Minor (all findings, with status)

**Chat/AI:** WineChatModal told the AI untyped wines were "Red (default)" and omitted winemaker from prompt + hasAnyData (✅); init() had no cancellation — rapid close/reopen raced (✅); synthetic error bubbles were replayed to the AI as assistant history, raw error text included (✅); double-tap could create two conversations (✅); ChatInput cleared the message before the send resolved — text/photos lost on failure (✅).

**Forms:** CellarFilterModal price inputs ate decimal points via the Number round-trip — "12.5" became 125 (✅); CellarBottleForm `num()` produced NaN→null silently and rating wasn't clamped 0–5 (✅); AutocompleteVarietal dropdown lingered after blur (✅); LogSessionForm wine cards keyed by index (✅ — photo-array keys in WineEntryForm/PastVisits/ChatInput left as-is, 🔲 cosmetic).

**Screens:** cellar deep-link status param never cleared — re-tapping the same Home tile did nothing (✅ router.setParams); sommelier silently degraded on failed message loads and could clobber a conversation title via re-auto-titling, startNewChat failures were silent (✅); wine detail silently router.back()'d on load failure despite having a "not found" view (✅); "Rate Cork & Note" opened placeholder store URLs `idXXXXXXXXXX` (✅ removed until real IDs); account-settings push toggle was a no-op that claimed success (✅ removed; real prefs in profile/notifications.js); wines filter modal ignored Android back (✅ onRequestClose); dead `inProtectedRoute` var (✅).

**Components:** VisitStatsCard container `opacity: 0.3` faded the icon too — now translucent bg color (✅); WineryActionButtons dead conditional `? "Want to Visit" : "Want to Visit"` — active now "On Your List" (✅ — note: it still has no visual loading state while toggling, 🔲); ManualWineryEntryModal silently pinned wineries to hardcoded Virginia coords when GPS failed — now asks (✅); MapErrorBoundary crashed itself on first fallback render (✅ deleted — unused); login.js referenced undefined `styles.socialButtonTextGoogle` + dead styles with invalid hexes `#00000`/`#0000` (✅ removed with social buttons).

**Data layer:** unchecked `wine_flavor_notes` delete before re-insert on edit → stale/merged notes reported as success (✅ now throws); getAllWineriesWithStatus crashed on null winery_id — dead code (✅ deleted); lib/supabase.js was ~60% commented dead code with no env-var fail-fast (✅ cleaned + guard + url polyfill re-enabled).

**Config/infra:** EAS `production` profile had no update channel — OTA updates silently never reached store builds (✅ channel added; cli.version pinned ≥13); hardcoded "1.0.0" in profile/feedback/help-support vs EAS remote versioning (✅ expo-constants); `expo-file-system` imported but undeclared (✅ installed); expo-camera injected an unused iOS mic permission + Android RECORD_AUDIO (✅ disabled via plugin props — note expo-image-picker still adds RECORD_AUDIO, 🔲 pass it `microphonePermission: false` if unwanted); obsolete READ/WRITE_EXTERNAL_STORAGE (✅ removed); expo-maps plugin compiled into builds but never imported (✅ removed); package name "testproject" (✅ → cork-and-note); README was the Expo template and documented a `reset-project` script that would have moved `app/` away (✅ rewritten; script deleted); unused deps lodash/react-native-webview/react-native-autocomplete-dropdown/@react-native-picker/picker + post-prune expo-blur/expo-symbols/expo-web-browser/expo-haptics (✅ uninstalled); dead files test_layout.js (syntax errors), WineCard, ConversationList, WinerySearchModal, Expo template components/ui/hooks/constants, orphan test (✅ deleted; 404 rebuilt on-theme); tsconfig/metro comment nits (✅).

**Deliberately left alone:** vercel.json catch-all rewrite (defeats expo-router static per-route HTML — revisit with a deploy to test against, 🔲); supabase/config.toml `project_id = "testProject"` (renaming risks local-stack link, 🔲 cosmetic); map.js controlled `region` + setState on every pan re-renders all markers (perf, 🔲); wines.js getFilteredWines unmemoized (fine at current scale, 🔲); `DataBase Schema.txt` + `notes from using the app.txt` at repo root (schema doc will drift from migrations — move to docs/ or replace with `supabase gen types`, 🔲); mockups/ at root duplicates docs/design/mockups (🔲 cosmetic).

## Verified sound (no action needed)
- RLS on visits/wines/wine_flavor_notes/wishlist/favorites/cellar_*/conversations/messages/wineries: correctly owner-scoped, with belt-and-suspenders user_id filters in lib queries.
- supabase/functions/chat: JWT verified at gateway and in code; server-side model allowlist; tamper-resistant chat_usage rate limiting; upstream errors logged not echoed.
- No secrets in git history (no .env ever tracked); Supabase creds via EXPO_PUBLIC_* env vars; Anthropic key server-side only.
- AI parsing defensive throughout (field whitelists, vintage validation, fence-gated suggestions, anti-prompt-injection instructions in scan prompts); no stuck-spinner paths in the AI components.
- app/_layout.js auth subscription + AppState listener correctly unsubscribed; nav guard loop-free.
- lib/cache.js clears on auth change — no cross-account bleed.

## Remaining work, ordered
1. 👤 Apply the three 20260705* migrations (`supabase db push`) — until then C1/C3 remain live in prod.
2. 👤 Restrict/rotate the Google Maps key; then move it out of app.json via app.config.js + EAS env.
3. 👤 Replace icon/splash placeholders from the real logo.
4. 🔲 Commit the `handle_new_user` trigger as a migration (repo can't rebuild the DB without it).
5. 🔲 Transactional RPCs for createVisit/openBottle (+ optimistic quantity guard).
6. 🔲 Design-review roadmap (see 2026-07-05-design-review.md) — auth retheme first.
7. 🔲 The "deliberately left alone" list above, as taste dictates.
