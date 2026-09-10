# Google Play Console setup — click-by-click

**Prepared:** 2026-09-10 · Companion to [`app-store-listing.md`](../app-store-listing.md) (Apple) — this is the Android equivalent, for the first Google Play release.

Assumes: the developer account exists (fee paid, identity/phone/device verified — done). Nothing app-side exists in Play Console yet. Everything below is in submission order; each section says exactly what to click and what to paste.

**Assets in this folder, ready to upload:**

| File | Size | Used for |
|---|---|---|
| [`icon-512.png`](icon-512.png) | 512×512 PNG | App icon (Store listing) |
| [`feature-graphic-1024x500.png`](feature-graphic-1024x500.png) | 1024×500 PNG | Feature graphic (Store listing) |

Phone screenshots: Play accepts the existing portrait set in [`docs/marketing/screenshots/`](../../marketing/screenshots/) (min 2, 16:9–9:16 aspect, ≥320px). They were captured on an iPhone simulator — fine for a closed test; recapture on an Android emulator before production if the status bar bothers you.

> **⚠️ Android billing is NOT wired yet.** `lib/purchases.js` only configures RevenueCat on iOS (no Android API key). On Android the app runs, but Pro cannot be purchased. Do not promise purchases in the Android listing, and tell testers Pro upsell screens won't complete a purchase. Wiring Android billing (RevenueCat Google key + Play billing setup) is a separate later task.

---

## 1. Create the app

1. [play.google.com/console](https://play.google.com/console) → **Create app**.
2. **App name:** `Cork & Note: Wine Journal` (25/30 — matches the Apple listing; plain `Cork & Note` also fits if you prefer, but the longer name helps search).
3. **Default language:** English (United States) — en-US.
4. **App or game:** App. **Free or paid:** Free. (Once published as Free this can never change to Paid; Free + in-app subscriptions is correct.)
5. Tick both declarations (Developer Programme Policies, US export laws) → **Create app**.

The package name is fixed by the first uploaded build: `com.nicholashorton.corkandnote`.

## 2. App content declarations

Dashboard → **App content** (left nav, bottom). Work through every card:

### 2.1 Privacy policy
- URL: `https://cork-and-note.vercel.app/privacy`

### 2.2 App access
- The app requires login for everything, so choose **All or some functionality is restricted** → **Add instructions**, and provide the review credentials:
  - Username: the demo account email (currently `review@corkandnote.com` — see `app-store-listing.md` §10; replace if that mailbox changes before the domain is owned).
  - Password: from the credentials held outside the repo (never commit it).
  - Instructions: "Sign in with the demo account. All features are reachable; the account is pre-seeded with tastings, wineries and cellar bottles."

### 2.3 Ads
- **No, my app does not contain ads.** (Verified: no ad SDK in `package.json`; the app shows no ads.)

### 2.4 Content rating (IARC questionnaire)
- Category: **Utility, Productivity, Communication or Other**.
- Answer everything **No/None** except:
  - **Alcohol, tobacco or drug references:** YES — the app **contains references to alcohol** (it is a wine journal). It does not *glamorise* or instruct illegal use; it references legal consumption. Answer the sub-questions truthfully: references to alcohol use, no promotion of excessive use.
  - **Does the app allow users to interact or exchange content?** No — journals are private, there is no social feature. (The AI chat is user-to-service, not user-to-user.)
  - **Does the app share the user's current location with other users?** No.
  - **Digital purchases:** answer "No" while Android billing is unwired; **revisit this questionnaire when Android purchases ship** (it becomes Yes — offers in-app purchases).
- Expected rating: mature-leaning (alcohol reference ratings vary by region — e.g. ESRB Teen/Mature). This mirrors the Apple questionnaire answer "Alcohol References: Frequent/Intense" → 18+ (`app-store-listing.md` §6).

### 2.5 Target audience and content
- **Target age group: 18 and over ONLY.** Do not tick any under-18 group — the app is about alcohol and must not be child-directed.
- "Appeal to children" question: No, the store listing could not unintentionally appeal to children.

### 2.6 News app
- No.

### 2.7 Data safety
See §3 below — it is the longest card.

### 2.8 Government apps / Financial features / Health
- No / None of the above / No health features.

### 2.9 Account deletion (required — the app has account creation)
- "Does your app allow users to create an account?" **Yes.**
- "Provide a link users can use to request account deletion": `https://cork-and-note.vercel.app/delete-account`
  (This page ships in the same PR as this doc. It covers both the in-app path and an email path that works without the app — exactly what Google requires. **Confirm the `cork_and_note@yahoo.com` mailbox is live before submitting.**)
- "Can users delete some data without deleting the account?" Yes — individual tastings, photos, bottles etc. can be deleted in-app.
- Data deleted on account deletion: all of it (photos, database rows, auth user — see `supabase/functions/delete-account/index.ts`). No retention period after deletion.

## 3. Data safety form — answers

Top-level answers:

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all of the user data collected by your app encrypted in transit?** **Yes.** (All traffic is HTTPS: Supabase client, Supabase Edge Functions, Anthropic API, Google Places proxy.)
- **Do you provide a way for users to request that their data is deleted?** **Yes** — in-app (Profile → Account settings → Delete account) and via https://cork-and-note.vercel.app/delete-account.

Per-type answers. Note on "Shared": Google exempts transfers to **service providers** processing data on your behalf from the "shared" disclosure. Supabase (hosting/auth/storage), Anthropic (AI responses, commercial terms — not used for training), and the Google Places API (called from our server proxy, never with user identity) all act on our behalf per the privacy policy, so "Shared = No" below relies on that exemption. **Flagged for owner sign-off — if you'd rather be conservative, declare the Anthropic transfer as shared with purpose "App functionality".**

| Data type (Google category) | Collected? | Shared? | Purpose | Optional? | Notes (ground truth in code) |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | Account management | Required at signup | Full-name field in `app/register.js` |
| Personal info → Email address | Yes | No | Account management | Required | Supabase auth |
| Personal info → User IDs | Yes | No | App functionality, Account management | Required | Supabase account id. (RevenueCat app-user id is iOS-only today — add it here when Android billing ships) |
| Photos and videos → Photos | Yes | No (service-provider exemption: Supabase storage; Anthropic only when the user scans a label/card or attaches a photo to the sommelier) | App functionality | Optional | User-attached wine/visit/cellar photos |
| App activity → Other user-generated content | Yes | No (Anthropic receives chat text + journal context to generate responses — service provider) | App functionality | Optional | Tastings, ratings, flavor notes, sommelier messages (`supabase/functions/chat/index.ts` → api.anthropic.com) |
| Location → Precise location | Yes | No (coordinates go to our Places proxy as a 5 km search bias, without user identity — `supabase/functions/places/index.ts`) | App functionality | Optional — only with permission, foreground only (`expo-location`) | Map position, nearby wineries, tagging a visit |
| Financial info → Purchase history | **No** (on Android today) | — | — | — | RevenueCat is not configured on Android (`lib/purchases.js` returns no Android key). **Change to Yes/collected when Android billing ships** |
| App info and performance → Crash logs / Diagnostics | No | — | — | — | No crash/analytics SDK installed |
| Device or other IDs | No | — | — | — | None collected |

For every "Collected = Yes" row: **Is this data processed ephemerally?** No. **Data usage:** App functionality (Account management too for name/email/IDs). **Not used for advertising or tracking.** All collected data is **deletable** via account deletion.

**Uncertain / owner to confirm:**
1. The service-provider stance on Anthropic and Google Places (above). The privacy policy already discloses both, so either answer is defensible.
2. Whether Supabase auth stores any device metadata (IP addresses in auth logs). Supabase keeps request IPs in its own logs as processor infrastructure; typically not declared, but noted here for completeness.

## 4. Store listing (Grow → Store presence → Main store listing)

- **App name:** `Cork & Note: Wine Journal` (25/30)
- **Short description** (77/80):

```
A wine journal with an AI sommelier. Log tastings, wineries, and your cellar.
```

- **Full description** (~1,600/4,000 — adapted from the Apple description; live-winery-data, drink-window and Pro-purchase promises removed because Pro is not purchasable on Android yet):

```
Remember what you tasted. Discover what you like.

You remember liking it — the label, the porch, the second pour. A week later the name is gone. Cork & Note fixes that.

LOG ANY WINE, ANYWHERE
A bottle at home, dinner out, or a flight at the tasting bar — capture each wine as you taste it: ratings, flavour notes, a photo, and how it made you feel. Tag the place, or don't. No wine vocabulary needed.

ASK A SOMMELIER
An AI wine companion grounded in your own ratings, not crowd scores. Ask what to open with dinner, how to describe a wine you like, or what the wines you've loved have in common. Beginner questions are its favourite kind.

KEEP EVERY WINERY
Each place you visit gets its own page — your visits, the wines you poured, your notes and photos — on a map that fills in as you travel. The record of your last visit helps you plan the next one.

SCAN THE LABEL
Point your camera at a bottle or a tasting-room card and let Cork & Note fill in the producer, the vintage and the grapes, so you can get back to drinking.

KEEP A CELLAR
Track the bottles you own, so you always know what's on hand — and can open your original tasting notes when you finally open the bottle.

YOURS, PRIVATELY, FOREVER
No feed, no followers. Your notes are private and never deleted — on any plan. And it tells you when you are offline instead of pretending to save.

Cork & Note is for people of legal drinking age. Please drink responsibly.
```

- **App icon:** upload `icon-512.png`.
- **Feature graphic:** upload `feature-graphic-1024x500.png`.
- **Phone screenshots:** at least 2 from `docs/marketing/screenshots/` (`1-home.png`, `5-sommelier.png`, `3-winery-visits.png` are the strongest three).
- **Category:** Food & Drink. **Tags:** wine, journal.
- **Contact details:** email `cork_and_note@yahoo.com` (**confirm mailbox first**), website `https://cork-and-note.vercel.app`.

Do **not** mention Pro pricing anywhere in the Android listing until Android billing is wired and subscription products exist in Play Console.

## 5. Internal testing track (first build, minutes to distribute)

1. Left nav → **Testing → Internal testing** → **Create new release**.
2. First release: Play prompts for **app signing** — accept **Google-generated signing key** (recommended; EAS uploads with an upload key).
3. Upload an `.aab`. Build one with `eas build -p android --profile production` (produces an app bundle; the existing `preview` profile makes an APK, which Play won't take). *Do not edit `eas.json` on this branch — a parallel branch owns it; if `production` doesn't target Android yet, coordinate there.*
4. Release name auto-fills from the build; **Release notes:** "First internal build of Cork & Note for Android."
5. **Testers tab → Create email list**: name it e.g. `corkandnote-internal`, paste comma-separated Gmail addresses (testers must join with the same Google account their Play Store uses), save, and tick the list.
6. Copy the **"Join on the web" opt-in link** and send it to testers — they must open it and tap "Become a tester" before the app appears for them in Play.
7. Internal testing allows up to 100 testers and needs **no review**; builds appear within minutes.

## 6. Closed testing — the 14-day requirement for new personal accounts

Personal developer accounts created after 13 Nov 2023 **must run a closed test before production access is granted**:

- At least **12 testers opted in, continuously, for the last 14 days** before you can apply for production. (Opted-in means they joined via the link; ideally they also install and use the app — Google reviews engagement when you apply.)
- Set it up under **Testing → Closed testing** → create a track (the default "Alpha" is fine) → promote the internal build to it → add the same email list (grow it past 12 — aim for 15–20 so drop-outs don't reset you) → **Start rollout**. Closed-testing releases go through Google review (usually hours to a couple of days).
- Add testers exactly as in §5: Testers tab → email lists → share the opt-in URL.
- After 14 continuous days with ≥12 opted-in testers, the Dashboard shows **Apply for production access**; you answer a short questionnaire about the testing you did.
- Practical note: recruit testers before the clock matters — friends/family Gmail addresses count. The 14 days run continuously; if the opted-in count dips below 12, the clock can restart.

**What testers must know:** Pro upsell screens exist in the app but **purchases will not work on Android yet** — no RevenueCat Android key is configured. That is expected, not a bug.

## 7. After production access (not yet — for later)

- Promote the closed-test build to **Production** (staged rollout at 10–20% first if cautious).
- Revisit before that day: Android billing wiring + Play subscription products + Data safety "Purchase history" row + content-rating digital-purchases answer + Pro copy in the listing; Android-captured screenshots.

---

**Blocking items for the owner (nothing else in this doc works without them):**

1. Confirm `cork_and_note@yahoo.com` is live and monitored (it's on the deletion page, the listing contact, and the account-deletion flow).
2. An Android `.aab` build (parallel branch owns `eas.json` / billing).
3. 12+ tester Gmail addresses for the closed test.
