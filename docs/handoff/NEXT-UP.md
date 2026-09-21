# NEXT UP (read this first)

Last updated: 2026-09-21 by Claude, for the next agent picking up this repo.

## Where things stand

- **1.0 is in App Review again, build 31.** The two earlier rejections: 2026-09-16 (Guideline 2.1, documentation only) and 2026-09-21 (Guideline 5.1.1, the app had a login wall). The login wall was fixed with guest mode: epic #316, PR #321 (merged), doc `docs/research/guest-mode-5-1-1-2026-09-21.md`.
- Review submission `13dbf800-041a-4c2c-b821-54a81dccde7a` was created via the ASC API with the 1.0 version item (build 31). Nick adds the subscription group, Pro Monthly and Pro Annual in the ASC UI (there is no API for a first subscription group), replies in Resolution Center, and submits.
- **Hard rule while in review: do NOT publish an EAS Update to the `production` channel.** The reviewer must see exactly build 31. Check the state first:
  `GET /v1/apps/6780661381/appStoreVersions` gives `appStoreState`. Wait until it is `READY_FOR_SALE` or `PENDING_DEVELOPER_RELEASE`.

## The task: guest and Pro visibility polish (issue #322)

Owner feedback from testing build 31 on 2026-09-21. **Do not start until Nick says go.** Build it on a branch, get it reviewed and merged, and ship it as an **EAS Update after approval**, not a new binary. It is JS-only; `runtimeVersion.policy = appVersion` (1.0.0), so an update on the `production` channel reaches build 31.

### 1. Make "create an account" obvious for guests

- Today: guests see a small outlined "Sign in" pill in the Home header (`app/(tabs)/home.js`, look for `isGuest ?` near `styles.signInPill`). Nick: "needs to be a little bit bigger and brighter."
- Change: a filled, high-contrast button (`colors.primary.base` background, `colors.onPrimary` text, the same weight as the paywall CTA), reading **"Create account"** for guests. Keep a secondary "Log in" reachable (Profile already has both; see the `guestCta` block in `app/(tabs)/profile.js`).
- Check that it fits next to `UpgradePill` on a small phone (iPhone SE width 375) without wrapping the "WELCOME TO / Cork & Note" title.
- Consider making `components/GuestAccountCard.js` more prominent too (it is the dismissible card on Home).

### 2. Make going Pro as easy as possible

- Nick: "it's not always obvious how I can sign up for pro. We need to make that as absolutely easy as possible."
- Today's entry points: `components/UpgradePill.js` (a tiny gold PRO chip in headers), `components/ProUpsellCard.js` (cards on Home, Somm, Cellar, Profile; props `title`, `subtitle`), meter hits via `usePro().gate()`, and `app/choose-plan.js` right after sign-up. Everything opens the paywall through `usePro().presentPaywall(source)` (`hooks/usePro.js`), which routes to `app/paywall.js`.
- Change: one unmistakable, always-visible Pro entry for every non-Pro user, **guests included** (guests can buy; owner decision 2026-09-21). Suggested: turn the header PRO chip into a labelled "Go Pro" button, and put a full-width Pro card high on Home rather than lower in the feed. Keep it one tap to the paywall. Everything must render nothing for Pro users and nothing while `isLoading` (existing rule: a paying user must never see an upgrade prompt flash).

### 3. Show the price where we ask

- Nick: "whenever we ask people if they want to go pro, maybe give them the price right then."
- **Never hardcode prices.** `$9.99` is wrong in 174 of 175 territories (comment in `lib/pro.js`). Use the StoreKit strings from the RevenueCat offering: `fetchOffering()` in `lib/purchases.js`, formatted with `packagePriceLine(pkg)` / `packagePeriod(pkg)` in `lib/pro.js`, the same way `app/choose-plan.js` and `app/paywall.js` do it.
- Change: `ProUpsellCard` (and the new Go Pro button, if it has room) shows e.g. "From $4.99/mo, billed yearly" or "$9.99 / month", derived from the offering. The offering loads async and can fail offline, so fall back to the current price-less copy and never block rendering. Cache the offering in `ProProvider` rather than fetching per card.
- Annual has a 3-day free trial for eligible users (`fetchTrialEligibility`). If a card mentions the trial, it must match the paywall's eligibility logic exactly (Apple 3.1.2).

### Constraints (these have bitten before)

- **No em dashes in any user-facing copy** (owner hard rule).
- `__tests__/theme-tokens.test.js` fails on literal colours (hex, rgba) in components. Use palette tokens (`colors.*`, e.g. `colors.overlay.dark`).
- Any screen or component importing `AuthContext` from `app/_layout` needs `jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({ user: null }) }))` in its test, or `lib/supabase` throws on missing env.
- Guest detection: `isGuestUser(user)` from `lib/guest.js`; `AuthContext` also exposes `isGuest`.
- Full suite: `npx jest` (87 suites / 1,184 tests green at `c062df3`). Lint: `npx eslint <files>`.
- Verify on the iOS simulator in light and dark mode, and as a guest, a Free account and a Pro account (demo accounts: see the `cork-and-note-demo-account` memory; passwords are never in the repo).

### Shipping it

1. PR, green CI, merged to `main` (Vercel deploys `main`; this touches app code only).
2. Only after App Store approval (see the hard rule above): `LANG=en_US.UTF-8 eas update --channel production --environment production --message "Guest and Pro visibility polish (#322)"`.
3. Nick checks it on his phone (updates apply on the next launch or foreground).

## Other open items, in priority order

1. **Sommelier streaming backend.** Nick (2026-09-21): the backend changes that enable streaming "still haven't been pushed." Streaming client code merged in PR #289 (2026-09-13). The deployed `chat` edge function is v21. Verify whether the deployed function matches `supabase/functions/chat` + `_shared` on `main` (`supabase functions download chat`, diff), and deploy with the SupabaseCLI skill if not. This is server-only (no build, no review), but **ask Nick before deploying while 1.0 is in review**: the reviewer is using the Somm tab.
2. **Anonymous user cleanup.** Guests create `auth.users` rows (`is_anonymous = true`). Add a scheduled cleanup of anonymous users older than ~30 days that own no rows. Not urgent.
3. **Next binary is build 32.** The EAS cloud iOS quota is exhausted until Oct 1, so build locally: `eas env:pull --environment production --path .env.eas-prod`, `set -a; source .env.eas-prod; set +a`, `LANG=en_US.UTF-8 eas build -p ios --profile production --local`. Upload with `xcrun altool --upload-app -f <ipa> -t ios --apiKey <ASC_KEY_ID> --apiIssuer <ASC_ISSUER_ID>` (seconds, versus about 2 hours in the free EAS submit queue). This Mac runs Xcode 27; `plugins/withPodsDeploymentTarget.js` handles the pod minimums.
4. Android: guest mode ships in the same JS, but the Play closed-test build predates it. Rebuild Android when convenient (see the `cork-and-note-play-track` memory).
