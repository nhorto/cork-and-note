# Handoff: ship an iOS update with Meta attribution turned on (2026-10-01)

**Goal: a new iOS build in App Store review today**, with the Meta SDK actually compiled in, so the Meta app-install ads starting this week can measure installs.

The owner wants this done by a separate agent. Ask the owner before any step marked **ASK**.

## Why this is needed

Meta attribution (PR #324, commit `edecec4`, merged 2026-09-24) only compiles the Meta SDK in when **both** `META_APP_ID` and `META_CLIENT_TOKEN` are present at build time (`app.config.js`). Without them the app builds and runs, but `extra.metaAppEventsEnabled` is false, the Meta SDK isn't included, and Meta never sees an install.

What EAS shows on 2026-10-01 (`npx eas-cli build:list`, project `3338eff4-c93e-49be-b32c-e802c16d122c`):

| Build | Date | Source commit | Profile / EAS env | Meta compiled in? |
|---|---|---|---|---|
| iOS 1.0.0 #17 | 2026-09-10 | `0a0062e` (this repo) | production | **No**, predates `edecec4` |
| iOS 1.1.0 #33 | 2026-09-28 | `063830e`, which **exists only in `~/Documents/app-platform`** ("build(cork): a testflight profile on the new backend, version 1.1.0 (#816)") | `testflight` → EAS env **preview** | **No**, preview has no Meta vars |

No EAS cloud iOS build exists from this repo after `edecec4`. The owner believes builds have only ever come from this repo. Build #33 suggests an agent built from `app-platform` once. Local builds made on the Mac mini (`eas build --local` or Xcode) don't appear in `build:list`, so confirm in App Store Connect (step 1).

### EAS environment variables (names only)

| EAS env | Vars | Supabase URL |
|---|---|---|
| production | `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `GOOGLE_MAPS_API_KEY`, **`META_APP_ID`, `META_CLIENT_TOKEN`**, `REVENUECAT_ANDROID_API_KEY`, `REVENUECAT_IOS_API_KEY` | `https://ixecayqpogkiawempzgc.supabase.co` |
| preview | `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `GOOGLE_MAPS_API_KEY`, `REVENUECAT_IOS_API_KEY` (**no Meta**) | `https://qfnksajzkzjyvfccxmik.supabase.co` ("new backend" per app-platform #816) |

**The two environments point at different Supabase projects.** Whichever build ships decides which backend real users' accounts and data live on.

## Steps

### 1. Find out exactly what is in App Store Connect (do this first)
App ID `6780661381`, bundle `com.nicholashorton.corkandnote`.
- Which version is submitted or in review (1.0.0 or 1.1.0), and which **build number** is attached?
- What is its status: Waiting for Review, In Review, Pending Developer Release, or Ready for Sale?
- If the build number isn't in the EAS table above, it was a local build. Ask the owner where and how it was built.

### 2. **ASK** the owner which backend production users should be on
- If the submitted build is **1.1.0 #33** (app-platform, preview env), it points at the **new** backend (`qfnk…`). Building from this repo with the `production` profile would silently move users to the **old** backend (`ixecay…`).
- If it's **1.0.0 #17** or a local build from this repo, production (`ixecay…`) is the current backend and the plan below works as written.
- Don't guess. Confirm the backend before building.

### 3. Make the build include Meta
**Preferred path (build from this repo, matching the owner's workflow):**
- `npm ci`, then `npm test`. The Meta tests are `__tests__/metaAppConfig.test.js` and `__tests__/metaAppEvents.test.js`.
- Confirm the config resolves with Meta on:
  ```
  npx eas-cli env:exec production 'npx expo config --type public' | grep -E 'fbsdk|metaAppEventsEnabled'
  ```
  You should see the `react-native-fbsdk-next` plugin and `metaAppEventsEnabled: true`. If `env:exec` isn't available in the installed CLI, pull the env (`npx eas-cli env:pull production`, which writes `.env.local`; never commit it) and run `npx expo config`.
- If the owner chose the **new** backend in step 2, don't use the production env as-is. **ASK** whether to point production's `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` at `qfnk…`, or to add `META_APP_ID`/`META_CLIENT_TOKEN` to preview. Copy the values with `eas env:get`/`env:create`; never paste them into git or chat logs.

**Version number**
- `appVersionSource` is `remote` and production has `autoIncrement`, so the build number takes care of itself (next is likely #34).
- The **marketing version** in `app.json` (currently `1.0.0`) must match the App Store Connect version you'll attach the build to.
  - If 1.0.0 is still Waiting for Review: you can keep 1.0.0. Remove the old build from review and attach the new one.
  - If 1.1.0 is the version in App Store Connect: bump `app.json` `version` to `1.1.0`, or to the next version if 1.1.0 is already approved or live. Commit that bump through a PR.

### 4. Optional but recommended: add Meta's SKAdNetwork IDs
`app.json` has no `ios.infoPlist.SKAdNetworkItems`. Meta's app-install measurement for users who decline tracking relies on SKAdNetwork and Meta's aggregated event measurement (AEM).
- Check what `react-native-fbsdk-next` (v13) adds to the generated `Info.plist` (`npx expo prebuild --platform ios --no-install` in a scratch copy, then inspect `ios/*/Info.plist`).
- If the plugin doesn't add them, add Meta's SKAdNetwork identifiers to `ios.infoPlist.SKAdNetworkItems`. Use the current IDs from Meta's developer docs ("SKAdNetwork" page); historically they were `v9wttpbfk9.skadnetwork` and `n38lu8286q.skadnetwork`. Verify against the docs; don't trust this note.
- Keep it a small, tested PR. If it risks today's deadline, skip it and note it as a follow-up.

### 5. Build and submit
```
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```
(The submit profile already has `ascAppId: 6780661381`.)

Before submitting, install the build through TestFlight on a real iPhone and check:
1. A fresh install shows the age gate, **then** the iOS tracking prompt: "Allow Cork & Note to measure which ads lead to app downloads and improve its advertising." It must not appear before the age gate (`app/_layout.js:110`).
2. Both Allow and Ask App Not to Track reach Home normally.
3. Meta Events Manager → the app's data source → **Test events** (or the App Ads Helper) shows `fb_mobile_activate_app` / install from the test device.
4. Sign-in, the sommelier and scanning still work. This also confirms the backend from step 2.

### 6. App Store Connect changes required alongside the new binary
- **App Privacy.** The current answers say no data is used for tracking. That's no longer true, and Apple rejects apps that show the tracking prompt without declaring tracking. Update to:
  - Data **is** used to track you: **Identifiers → Device ID** (the advertising identifier), purpose **Third-Party Advertising**, linked to the user: No.
  - Also review **Usage Data → Product Interaction** (app installs and launches sent to Meta), purpose Third-Party Advertising / Analytics.
  - **ASK** the owner to confirm the final answers before publishing them.
- **Review notes.** Tell the reviewer the tracking prompt appears right after the 21+ age gate on first launch.
- The privacy policy already discloses Meta measurement (`lib/legalContent.js`, and the website copy updated 2026-09-22). Confirm the hosted policy URL in App Store Connect shows that version.
- **What's New** text, e.g. "Improvements and fixes." Advertising measurement doesn't need to be listed.

### 7. Meta side (owner may already have done this; verify)
In the Meta app (`META_APP_ID` is in EAS production):
- The iOS platform is added with bundle ID `com.nicholashorton.corkandnote` and App Store ID `6780661381`.
- Events Manager shows the app as a data source, and **AEM / SKAdNetwork** is enabled for app campaigns.
- The ad account is linked to the app so App Promotion campaigns can select it.

## Out of scope / don't
- Don't change pricing, paywall or entitlement code. The credits + one-time unlock work is separate.
- Don't port anything to or build from `app-platform` unless the owner says so in step 2.
- Never commit `.env*` files or print the `META_CLIENT_TOKEN` value.
- The ad spend itself is a separate task. Ads can start once the new build is live; until then, Meta install reporting will be close to zero.

## Done when
- [ ] App Store Connect has a new iOS build in review, made with `META_APP_ID`/`META_CLIENT_TOKEN` present, on the backend the owner confirmed.
- [ ] TestFlight check passed: age gate, then the tracking prompt; Meta test event received.
- [ ] App Privacy answers updated for tracking; review notes mention the prompt.
- [ ] Owner told which build number is in review and which Supabase backend it uses.
