# Cork & Note — App Store Launch & Business Plan

**Prepared:** 2026-09-03
**Owner-only tasks:** see [`owner-checklist.md`](owner-checklist.md).
**Status:** Owner decisions taken 2026-09-03 on pricing ($9.99/mo · $59.99/yr, no lifetime), free meters (as proposed), and platform (iOS only). Navigation option (§3 Layer A vs B) pending mockup review. No product code changed in this PR.
**Builds on:** [`monetization-and-marketing-strategy.md`](monetization-and-marketing-strategy.md) (June 2026 research), the 2026-07-05 [code review](../audits/2026-07-05-code-review.md) and [design review](../audits/2026-07-05-design-review.md), issue #148, and three fresh audits of the current `main` (UX/findability, launch readiness, payments/pricing research).

---

## 1. Where the app is today

**Product.** The core is genuinely complete for a v1: log a winery visit or a single wine, scan a label or a tasting card to prefill, flavor tags and ratings, photos, a map of places with wishlist pins, a cellar with drink windows and "Tonight's Pick," and an AI sommelier (Claude Sonnet-class for chat, Haiku for label reads) with per-user rate limits. About 158 PRs merged since June 2026, zero open PRs, six open issues, 23 of 27 QA follow-ups closed.

**Distribution.** Nothing has reached testers since **build 5 on 2026-06-24**. Every EAS production build since then fails with an Apple 403: *"A required agreement is missing or has expired."* Issue #148 traced it to an unsigned Apple Program License Agreement (and possibly a lapsed $99/yr membership). Only the Account Holder can fix it, in a browser, in about two minutes. Consequences:

- Two months of merged work (the July design fixes, tasting-card scan, cellar↔tasting links, the varietal `text[]` migration) has never been in a tester's hands.
- Testers on pre-July builds **crash** on any wine with varietals, because the old client calls `.trim()` on what is now an array.
- The remote build number has ticked to 7 from failed attempts; the next successful build will be 8.

**Business plumbing.** None exists yet: no in-app purchase SDK, no entitlement or tier concept anywhere in code, no privacy policy or terms, account deletion is a "Coming Soon" alert, app icons are still the Expo placeholders, and an Android Google Maps key is committed in `app.json`.

**Bottom line.** You are roughly 3–4 focused weeks from a submittable App Store build, and the first day of that is not engineering.

---

## 2. Path to the App Store

### 2.0 This week, you personally (no code)
1. ~~Sign in to App Store Connect as the Account Holder and accept the pending agreement.~~ **DONE 2026-09-03.** Still confirm the $99/yr membership expiry date while you're there.
2. Enroll in the **App Store Small Business Program** (15% commission instead of 30% under $1M/yr). Do this before the first paid subscriber exists.
3. Move `AuthKey_9L4MP9Y7C6.p8` out of `~/Downloads` to `~/.private_keys/`. Never commit it.
4. Re-run the production build (command in #148). Build 8 goes to TestFlight and un-crashes your testers.

### 2.1 Must fix before submission (engineering, ~1 week)
| # | Item | Why | Where |
|---|---|---|---|
| 1 | **In-app account deletion** | Guideline 5.1.1(v); guaranteed rejection | `app/profile/account-settings.js:139` is a stub. Needs `rpc('delete_user_data')` + a service-role edge function to delete the `auth.users` row, then sign out |
| 2 | **Privacy policy + Terms of Use, hosted and linked in-app** | Required in ASC metadata, in Settings, and on any paywall; must disclose photos, location, and that chat content goes to Anthropic | New `app/profile/legal` links; host at your domain (repurpose the failing Vercel deploy as `corkandnote.com`) |
| 3 | **Real app icon, adaptive icon, splash** | `adaptive-icon.png` and `splash-icon.png` are byte-identical Expo placeholders; metadata rejection | `assets/images/`, source `cork_and_note_logo.png` |
| 4 | **Apply the three `20260705*` migrations to prod** | Flavor-note RLS fix, owner-scoped photo buckets, `delete_user_data` | `supabase db push` |
| 5 | **Restrict/rotate the Google Maps key** | Live secret in git history | Restrict to Maps SDK for Android + package + SHA-1; move to `app.config.js` + EAS env |
| 6 | **Set an Anthropic spend cap + alert** | Today every account gets 150 vision-capable Sonnet calls/day free, and the rate limiter fails open if `chat_usage` is unreachable | Anthropic console; also make `chat/index.ts:139-142` fail closed |
| 7 | **Age rating: answer "Frequent alcohol references" → 18+** | Apple's 2026 tiers are 4+/9+/13+/16+/18+; Delectable ships as 18+ | ASC questionnaire; optional first-run "I'm 21+" acknowledgement |
| 8 | **Remove dead social links** | Reviewers tap them; 404s read as broken | `app/profile/feedback.js:435-449` |
| 9 | **Verify a production build on the current EAS image (Xcode 26)** | Apple has required iOS 26 SDK builds since 2026-04-28. Expo SDK 53 is three versions behind; upgrade to SDK 54+ if the build fails | `eas.json` `image: latest`; `npx expo install --fix` after upgrade |
| 10 | **Subscription compliance (only if the paywall ships in v1)** | Guideline 3.1.2: price, period, auto-renew text, Restore Purchases, terms + privacy links on the paywall | RevenueCat Paywalls UI covers most of this |

### 2.2 App Store Connect metadata to prepare
- **Name:** "Cork & Note: Wine Tasting Journal" (30 chars max for name; subtitle 30 chars: "Log tastings & winery visits").
- **Category:** Food & Drink (secondary: Lifestyle).
- **Keywords (100 chars):** wine,tasting,journal,winery,cellar,notes,sommelier,vineyard,scan,label,vivino,tasting room.
- **Screenshots:** 6.9" iPhone set required (6.5" optional). Five screens: Home, Log a tasting, Winery page with visits, Map, Sommelier. Caption each with the job it does.
- **App Privacy labels:** Contact info (email), Photos, Precise location, User content (notes, chat), Identifiers (RevenueCat app user id), Usage data. All "linked to you," none "used to track."
- **Review notes:** a demo account with seeded visits, and a sentence explaining the sommelier sends text/photos to Anthropic's API.
- **Support URL + Marketing URL:** the same landing site as the privacy policy.
- Budget **2–5 days** for first review; subscription apps get extra scrutiny.

### 2.3 Should fix shortly after (already tracked)
Overall rating to the bottom of the wine form; transactional RPCs for `createVisit`/`openBottle`; commit the `handle_new_user` trigger as a migration; a support `mailto:` in Help; NetInfo + offline banner; tighten CORS on the edge function; adopt `expo-updates` so OTA fixes actually surface; first tests around `lib/visits.js` and `lib/cellar.js`.

---

## 3. UX pass: "How do I get to the wines I've tasted?"

### 3.1 Diagnosis
The June information-architecture doc decided Wines and Wishlist would be **nested under Profile**. That never shipped. Today:

| To reach… | Path | Taps | Problem |
|---|---|---|---|
| Wines I've tasted | Home → the bare "Wines" number tile, or "RECENT ▸ See all" | 1 | Nothing says it's a list. The only menu-style route is Profile → "Recent wines → View all," which only renders once you have wines |
| One tasting's notes | Wines → card → Wine details | 2 | Flat list, no date grouping, no sort |
| Wineries I've visited | Home "Places" → **the map** → floating pill "Your places & wishlist" → sheet | 2–3 | There is no list screen at all; the pill looks like a search box and only appears once pins exist |
| A winery's visit notes | …→ pin → sheet → "View details" (3rd row) → scroll past hero, buttons, canned "About" → **Your visits** → expand a date row | 4–6 | The sheet's primary row "Log visit" actually opens the same page; notes are collapsed by default |

Structural causes, from the code:
- **The ＋ hub is create-only.** The most discoverable control (`components/HubMenu.js`) offers Log / Add bottle / Wishlist / Sommelier and nothing to *look at*.
- **Wines, Wishlist and Sommelier are hidden tab routes with no back button** and no highlighted tab when you're on them (`wines.js:449`, `wishlist.js:164`, `sommelier.js:274`). You land there and the only exit is another tab.
- **Six names for two concepts.** Wines / tastings / journal / logs / sessions / visits; Places / Explore / Your places / Visited / Châteaux / pins. "Châteaux" in the Profile stats card is decorative jargon for "wineries visited."
- **No first-run orientation.** The only hint (the map's long-press banner) self-destructs after the first pin, and there is no "?" to bring it back (your own note).
- **Wines filters** are unbounded horizontal chip rows built from every winery and varietal you've ever logged (`wines.js:339-359`), while `CellarFilterModal` already has the right pattern (searchable, counted, wrapped facets).

### 3.2 Proposed fix, in two layers

**Layer A — Findability (1–2 days, no structural change).** Ship this regardless of the tab decision.
1. **Profile menu rows:** "Your tastings", "Your places", "Wishlist", "Cellar" above the settings rows. Restores the IA promise.
2. **Home tiles become labeled links:** "Wines tasted ▸", "Places visited ▸", "Wishlist ▸". "Places" opens a list, not the map.
3. **New `app/places.js` list screen:** every winery you've logged, sorted by last visit, with visit count and last date; tap → winery page. Search box at top. This is the "where have I been" screen that doesn't exist.
4. **`<ScreenHeader>` with a back chevron** on Wines, Wishlist and Sommelier (component already exists and is used on 10 screens).
5. **Hub gets a "Browse" section** under the create actions: Tastings · Places · Wishlist.
6. **PinActionModal:** first row "View winery & your notes" (opens the page), second "Log a visit here" (opens `/log-session` directly). Wishlist and Remove pin below.
7. **Winery page:** move "Your visits" above "About"; auto-expand the most recent visit; delete the canned "Discover this winery…" paragraph when no description exists.
8. **One vocabulary:** Tastings, Places, Wishlist, Cellar. Rename "My wines" → "Your tastings", "Châteaux" → "Places", "WHERE YOU'VE BEEN" stays.
9. **PastVisits empty-state CTA** navigates to `/log-session?mode=winery&wineryId=…` instead of showing an Alert that names a button that doesn't exist.
10. **Overall rating to the bottom** of `WineEntryForm` (your note #1).

**Layer B — Structural (recommended, +2–3 days): a Journal tab.**
Casual tasters are the wedge, and the thing they create most, tastings, is the one thing without a tab. Proposed bar:

```
   Home        Journal        ＋        Explore       Profile
            Tastings·Places
              ·Wishlist
```

- **Journal** is one screen with a three-segment control: Tastings (grouped by visit/date, with the fixed filter sheet), Places (the new list), Wishlist.
- **Cellar** moves off the bar to: a Home card with bottle count, a Profile row, and the hub's "Add a bottle". Cellar users are a subset of tasters; they will still find it in one tap from Home.
- Explore stays the map; Profile stays.

Why not add a sixth tab: every major wine app stays at five, and the raised ＋ needs a center slot. Why Journal over Cellar on the bar: your testers ask "where are my wines," not "where are my bottles."

**Layer C — Orientation (1 day).**
- A three-card first-run overlay after signup: "Log here (＋)", "Find your tastings here (Journal)", "See where you've been (Explore)". Dismissable, replayable from Help.
- Persistent "?" on the map that re-shows the drop-pin hint.
- Wines filters rebuilt on the `CellarFilterModal` pattern; sort split from filters.

### 3.3 Still open from the July design review
Pre-login screens rethemed (done since), `gold.text`/pewter tokens (done), `<ScreenHeader>` (done for detail screens, **not tab screens**). Still open: Georgia hardcoded in 36 files (Android falls back to sans), button/chip recipe drift, accessibility labels on icon buttons, 44pt touch targets. None block launch; the serif guard is a two-hour fix worth taking with Layer A.

---

## 4. Business model

### 4.1 Payments: not Stripe (on iOS)
Apple Guideline 3.1.1 requires **in-app purchase** for anything that unlocks features inside the app. A Stripe-only Pro would be rejected outside the US and is risky even inside it. The US link-out carve-out (post Epic v. Apple) is real but legally unsettled: the Supreme Court granted cert on 2026-06-30 and a commission on link-outs is being set on remand. Don't build the business on it.

**Recommendation:** Apple IAP through **RevenueCat** (`react-native-purchases` + `react-native-purchases-ui`), free under $2,500/month tracked revenue, then 1%. Stripe can come later for a web checkout, honored in-app under 3.1.3(b). At the 15% Small Business rate, $9.99 nets **$8.49**; $59.99/yr nets **$50.99** (about $4.25/mo).

### 4.2 Tiers: one paid tier at launch
Two paid tiers before you have any conversion data is premature. Launch with Free + Pro and add a higher tier only if usage shows a heavy-AI segment.

| | **Free** | **Pro** |
|---|---|---|
| Manual logging: visits, tastings, ratings, flavor notes, photos | Unlimited | Unlimited |
| Map, places, wishlist | Unlimited | Unlimited |
| Cellar | Up to 25 bottles | Unlimited + insights, drink windows, Tonight's Pick |
| Label scan / tasting-card scan | 3 per month | Unlimited |
| AI sommelier chat | 5 messages per month | Unlimited (fair-use cap ~300/day, already enforced) |
| Export (CSV of tastings) | — | Yes |
| Price | $0 | **$9.99/mo · $59.99/yr (7-day trial on annual)** — decided 2026-09-03; no lifetime SKU at launch |

Reasoning:
- **Never gate the journal itself.** Logging is the habit loop and the data that makes the sommelier personal. Every rating benchmark says gating the core kills retention before conversion.
- **Gate the things that cost you money or feel magical:** scans and AI. Metered free use (3 scans, 5 messages) lets people feel it, then locks. Sommo, the closest AI-native competitor, ships 5 lifetime scans + a 3-day trial at $4.99/mo.
- **Cellar cap** mirrors CellarTracker's bottle-tiered model and catches the collector segment without touching casual tasters.
- **Price (decided: $9.99/mo · $59.99/yr):** consumer wine apps cluster at $5–6/mo (Vivino $4.99, Delectable $5.99); AI/collector tools at $10–15 (Wine-Searcher $10.99, InVintory $14.95). $9.99 places Cork & Note with the AI/collector tools, so the paywall must lead with the sommelier and unlimited scans, not with "more journaling." Annual at $59.99 (six months' price) is the plan to push, since annual subscribers retain 44% at 12 months versus 17.5% for monthly. If trial-to-paid comes in under ~25%, run a RevenueCat price experiment at $7.99 before touching features.
- **No lifetime SKU at launch** (decided). Revisit after 90 days of data; about 40% of lifestyle apps blend one in later.

### 4.3 Will the AI cost eat the margin? No.
Modeled at 30 chats/month (2k context in, 400 out) plus 20 label scans (1,000px photo ≈ 1,300 image tokens):

| Model | Cost / paying user / month | Share of $8.49 net |
|---|---|---|
| Claude Haiku 4.5 (scans today) | ~$0.18 | 2% |
| Claude Sonnet-class (chat today) | ~$0.36 | 4% |
| A 10× power user on Sonnet | ~$3.60 | 42% |

Two cheap wins before launch: **downscale photos to ~1,000px** on the long edge before upload (`lib/ai.js`), and **prompt-cache the system prompt** (cuts cached input cost ~90%). Free users are the real exposure, which is exactly why the 5-message meter and the Anthropic spend cap matter.

### 4.4 Honest revenue math
RevenueCat's 2026 median for freemium is **2.1%** of downloads paying by day 35 (hard paywalls ~10.7%, but those kill a journal app's retention).

| Lifetime downloads | Payers at 2–3% | Monthly revenue (mixed monthly/annual, net) |
|---|---|---|
| 1,000 | 20–30 | ~$120–250 |
| 10,000 | 200–300 | ~$1,200–2,500 |
| 50,000 | 1,000–1,500 | ~$6,000–12,000 |

Fixed costs: Apple $99/yr, Supabase Pro ~$25/mo, Anthropic $20–100/mo at launch scale, RevenueCat $0 until $2.5k MTR, domain ~$15/yr. The first goal is not profit; it is **retention data and 100 real users** to learn what people pay for. The B2B winery line (sponsored placements, visit analytics) from the June doc is the eventual larger business, but it needs consumer scale first.

### 4.5 Implementation plan for Pro (about 4–5 days)
1. **Products in App Store Connect:** `pro_monthly` ($9.99) and `pro_annual` ($59.99, 7-day intro trial) in one subscription group "Cork & Note Pro".
2. **RevenueCat:** project, entitlement `pro`, offering `default`; paywall designed in the dashboard (Paywalls v2) so copy and price tests don't need a release.
3. **Client:** `npx expo install react-native-purchases react-native-purchases-ui`; identify the user with the Supabase user id at login; `usePro()` hook exposing `isPro` + `presentPaywall()`; Restore Purchases in Account settings; Terms and Privacy links on the paywall.
4. **Server truth:** RevenueCat webhook → a small edge function → `public.entitlements (user_id, is_pro, expires_at, source)`. The chat edge function reads it and enforces the monthly meter for free users using the existing `chat_usage` table (count rows per calendar month; separate `task` for scans vs chat). Never trust `isPro` from the client for the AI call.
5. **Gates in the app:** scan buttons, sommelier send, cellar add past 25, export. Each shows a one-line "3 free scans left this month" before the wall, never a surprise.
6. **Analytics:** RevenueCat charts cover revenue; add a lightweight event layer (PostHog free tier or Supabase table) for activation = first tasting logged, D1/D7/D30 return, paywall view → purchase.

---

## 5. Getting users

The June strategy doc covers channels in depth; this is the concrete first-90-days version.

**Positioning in one line:** *The wine journal for people who visit wineries. Log the tasting room, remember every wine, and ask a sommelier who knows what you actually liked.* Do not fight Vivino on "scan a label to see a score."

**Before submission (parallel with §2):**
- Landing site at your domain (privacy, terms, support, waitlist email form, App Store badge). Repurpose the Vercel project; close #152 either way.
- Ask every current TestFlight tester to be ready to leave an App Store review on launch day. Ten reviews in week one matters more than any ad.
- Pick **one wine region you can drive to** as the launch region.

**Launch month:**
- **Tasting-room QR cards** at 5–10 wineries in that region: "Remember what you tasted today — Cork & Note." This is the channel no incumbent can copy and it reaches people at the exact moment of intent.
- **Founder content:** short vertical videos of you logging at a tasting room, 2–3 per week, TikTok + Instagram Reels. Personality over polish.
- **ASO:** the name/subtitle/keywords in §2.2; iterate monthly.
- **Local communities:** the region's wine Facebook groups, r/wine, local wine clubs. Value first, 90/10 rule.
- **Apple Search Ads:** $10–20/day on "wine journal", "wine tasting notes", "winery app" once the paywall is live and you can see cost per trial.

**What to measure weekly:** downloads, activation (logged a first tasting within 24h), D7 retention, paywall views, trial starts, paid conversions, Anthropic spend. If activation is under ~40%, the onboarding (Layer C) is the problem, not marketing.

---

## 6. Sequenced roadmap

| Week | Work | Outcome |
|---|---|---|
| **0 (you)** | Sign Apple agreements, confirm membership, enroll Small Business Program, rebuild | Build 8 on TestFlight; testers un-crashed |
| **1** | §2.1 must-fixes 1–8; SDK upgrade check (item 9); apply migrations; domain + legal pages | A build Apple would not reject on metadata grounds |
| **2** | UX Layer A + C, rating reorder, filters, serif guard | Testers can find their wines and places; re-test with the same people who complained |
| **3** | Journal tab (Layer B) if approved; Pro tier per §4.5; paywall; App Store metadata + screenshots | Feature-complete v1.0 |
| **4** | Submit; QR cards printed; landing live; content started | In review |
| **5+** | Launch; watch activation and D7; first RevenueCat price test; winery partnerships | Iterate on real data |

Android can wait: it doubles QA and store work, and every tester today is on iOS. Ship it once iOS retention looks healthy.

---

## 7. Decisions needed from you

1. **Journal tab (Layer B) or Profile-nesting only (Layer A)?** Recommendation: B. It demotes Cellar from the bar. *Owner asked for mockups of both before deciding (see `docs/design/mockups/`).*
2. ~~**Pricing**~~ — **Decided:** $9.99/mo · $59.99/yr, no lifetime SKU at launch.
3. ~~**Free meters**~~ — **Decided:** 3 scans + 5 AI messages per month, 25-bottle cellar cap, logging unlimited.
4. **Launch region:** which wine region can you visit regularly for QR partnerships and content?
5. **Domain:** do you own corkandnote.com or similar? Repurpose the Vercel deploy for the landing + legal pages, or delete it?
6. ~~**Apple account**~~ — **DONE 2026-09-03:** agreement signed.
7. **Entity and money:** Apple pays whoever owns the developer account. An LLC is not required to launch but is worth setting up before real revenue. Do you have one?
8. **AI budget:** what monthly Anthropic cap are you comfortable with at launch? Suggest $100 with an alert at $50.
9. ~~**Android**~~ — **Decided:** iOS only for v1.

Answer these and the roadmap in §6 can start immediately: §2.1 items and UX Layer A need no decisions at all.
