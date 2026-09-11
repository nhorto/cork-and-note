# Cork & Note — App Store Launch & Business Plan

> **Current release status:** use the [September 10 readiness checklist](app-store-readiness-2026-09-10.md). Its live account/code audit supersedes the historical build numbers and remaining-work claims in this business plan; pricing and product decisions below remain useful context.

**Prepared:** 2026-09-03
**Owner-only tasks:** see [`owner-checklist.md`](owner-checklist.md).
**Status (2026-09-08, trial revised 2026-09-09):** every business decision this plan was waiting on has now been made. Pricing ($9.99/mo · $59.99/yr, **3-day** trial on **annual only** — shortened from 7 days on 2026-09-09 and applied in App Store Connect the same day — no lifetime) and free meters were settled 2026-09-03; on **2026-09-08** the owner closed the four that were still open — **launch region Virginia** (§5), **v1 ships with the paywall** rather than free-first, **Anthropic capped at $100/month** (§4.3), and **no LLC: Nicholas Horton personally, Maryland law** (§7). Only **navigation Option A vs B** is left, and it still blocks the Journal tab.

**What is actually left.** One Apple item — **the bank account** on the Paid Apps Agreement, which no subscription can be sold without. One engineering gate — **a fresh EAS build**, because `react-native-purchases` is native code, itself blocked on two EAS variables the owner has to hand over. Then the owner's read-through of the legal pages, a sandbox purchase, the paywall review screenshots, and the listing upload. Everything else in [`owner-checklist.md`](owner-checklist.md) is done or optional.

Delivered since: every §2.1 must-fix that needed no owner decision (account deletion #161 — verified end-to-end in production, legal screens #162, Maps key #164, fail-closed limiter #165, dead links #166), the full §3.2 Layer A findability pass plus most of Layer C (#170), the §3.3 serif guard, and from §2.3 the `handle_new_user` migration and the first test suite. **Build 11 is on TestFlight** (§2.0 complete). The privacy-policy and support URLs Apple requires are live at <https://cork-and-note.vercel.app> without waiting on the domain. **The Pro tier (§4.5) is built** (#192): App Store Connect products, RevenueCat, the paywall, Restore Purchases, the four free gates, and a server-side entitlement the AI calls actually trust. Its store side is now real too: the subscriptions exist in App Store Connect, RevenueCat is wired to them, and the In-App Purchase key is generated and **verified** (sandbox authenticates; the production 401 is expected until the app is released). It needs a fresh EAS build to be testable — `react-native-purchases` is native code — and two browser steps from the owner (webhook secret, EAS key). Still open: icons (#163, needs final artwork), the Journal tab (Layer B, needs the A/B decision), and the rest of §2.3.
**Builds on:** [`monetization-and-marketing-strategy.md`](monetization-and-marketing-strategy.md) (June 2026 research), the 2026-07-05 [code review](../audits/2026-07-05-code-review.md) and [design review](../audits/2026-07-05-design-review.md), issue #148, and three fresh audits of the current `main` (UX/findability, launch readiness, payments/pricing research).

---

## 1. Where the app is today

**Product.** The core is genuinely complete for a v1: log a winery visit or a single wine, scan a label or a tasting card to prefill, flavor tags and ratings, photos, a map of places with wishlist pins, a cellar with drink windows and "Tonight's Pick," and an AI sommelier (Claude Sonnet-class for chat, Haiku for label reads) with per-user rate limits. About 158 PRs merged since June 2026, zero open PRs, six open issues, 23 of 27 QA follow-ups closed.

**Distribution.** Fixed. For two months nothing reached testers past **build 5 on 2026-06-24**, because every EAS production build failed with an Apple 403 — an unsigned Program License Agreement (#148). The agreement was signed 2026-09-03 and **build 11 shipped to TestFlight on 2026-09-07**; repairing it also surfaced a stale distribution certificate, since regenerated and valid to 2027-09-07. Testers on pre-July builds still **crash** on any wine with varietals (the old client calls `.trim()` on what is now an array), so they do need to update — but the build worth telling them about is the *next* one, which has the paywall in it.

**Business plumbing.** Built, not yet live. Account deletion, the privacy policy and terms, the fail-closed rate limiter and the Maps-key move all shipped; the Pro tier landed as #192. What is not live is the *selling*: the Paid Apps Agreement is still missing its bank account, and no build exists that can run `react-native-purchases`. App icons remain Expo placeholders (#163, waiting on final artwork).

**Bottom line.** The engineering is essentially done. The remaining critical path is Apple's — bank account, a build, a sandbox purchase, review.

---

## 2. Path to the App Store

### 2.0 Owner setup — ✅ complete
1. ~~Accept the pending Apple agreement~~ **done 2026-09-03**; ~~confirm the $99/yr membership~~ **checked 2026-09-08, current and in good standing**.
2. ~~Enroll in the **App Store Small Business Program**~~ **done 2026-09-08.** 15% is the rate every net figure in §4 already assumes.
3. ~~Move `AuthKey_9L4MP9Y7C6.p8` out of `~/Downloads`~~ **done 2026-09-07.**
4. ~~Re-run the production build~~ **done 2026-09-07** — it shipped as build 11, not 8, after the distribution certificate had to be regenerated.

The owner items that remain moved to [`owner-checklist.md`](owner-checklist.md). Only one is on the critical path: the **bank account** on the Paid Apps Agreement.

### 2.1 Must fix before submission (engineering, ~1 week)
| # | Item | Why | Where |
|---|---|---|---|
| 1 | **In-app account deletion** | Guideline 5.1.1(v); guaranteed rejection | `app/profile/account-settings.js:139` is a stub. Needs `rpc('delete_user_data')` + a service-role edge function to delete the `auth.users` row, then sign out |
| 2 | **Privacy policy + Terms of Use, hosted and linked in-app** | Required in ASC metadata, in Settings, and on any paywall; must disclose photos, location, and that chat content goes to Anthropic | New `app/profile/legal` links; host at your domain (repurpose the failing Vercel deploy as `corkandnote.com`) |
| 3 | **Real app icon, adaptive icon, splash** | `adaptive-icon.png` and `splash-icon.png` are byte-identical Expo placeholders; metadata rejection | `assets/images/`, source `cork_and_note_logo.png` |
| 4 | **Apply the three `20260705*` migrations to prod** | Flavor-note RLS fix, owner-scoped photo buckets, `delete_user_data` | `supabase db push` |
| 5 | **Restrict/rotate the Google Maps key** | Live secret in git history | Restrict to Maps SDK for Android + package + SHA-1; move to `app.config.js` + EAS env |
| 6 | ~~**Set an Anthropic spend cap + alert**~~ **✅ done 2026-09-08 — $100/month, alert at $50.** The fail-open limiter was closed in #165. §4.3 works out what $100 buys and when it has to move | Anthropic console |
| 7 | ~~**Age rating: "Frequent alcohol references" → 18+**~~ **✅ done 2026-09-08.** The optional first-run "I'm 21+" acknowledgement was not built and is not required | ASC questionnaire |
| 8 | **Remove dead social links** | Reviewers tap them; 404s read as broken | `app/profile/feedback.js:435-449` |
| 9 | **Verify a production build on the current EAS image (Xcode 26)** | Apple has required iOS 26 SDK builds since 2026-04-28. Expo SDK 53 is three versions behind; upgrade to SDK 54+ if the build fails | `eas.json` `image: latest`; `npx expo install --fix` after upgrade |
| 10 | **Subscription compliance** — no longer conditional: **v1 ships with the paywall** (decided 2026-09-08) | Guideline 3.1.2: price, period, auto-renew text, Restore Purchases, terms + privacy links. Built in #192 as a native screen rather than a dashboard template (§4.5). What is left is *proving* it — a sandbox purchase and the review screenshots, both behind the next build | `app/paywall.js` |

### 2.2 App Store Connect metadata to prepare
- **Name:** "Cork & Note: Wine Tasting Journal" (30 chars max for name; subtitle 30 chars: "Log tastings & winery visits").
- **Category:** Food & Drink (secondary: Lifestyle).
- **Keywords (100 chars):** wine,tasting,journal,winery,cellar,notes,sommelier,vineyard,scan,label,vivino,tasting room.
- **Screenshots:** 6.9" iPhone set required (6.5" optional). Five screens: Home, Log a tasting, Winery page with visits, Map, Sommelier. Caption each with the job it does.
- **App Privacy labels:** ✅ **submitted 2026-09-08** — Contact info (email), Photos, User content (notes, chat), Precise location, Identifiers (RevenueCat app user id). All "linked to you," none "used to track." Usage Data was answered *not collected*; **that answer must change if PostHog is ever added** (§4.5.6).
- **Review notes:** a demo account with seeded visits, and a sentence explaining the sommelier sends text/photos to Anthropic's API. Since v1 ships with the paywall, also say how the reviewer reaches it and note that Restore Purchases is on the same screen.
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

**Recommendation, now shipped:** Apple IAP through **RevenueCat** (`react-native-purchases` + `react-native-purchases-ui`), free under $2,500/month tracked revenue, then 1%. Stripe can come later for a web checkout, honored in-app under 3.1.3(b). The **15% Small Business rate is confirmed** — enrolled 2026-09-08 — so $9.99 nets **$8.49** and $59.99/yr nets **$50.99** (about $4.25/mo). Every net figure below uses those numbers, not the 30% ones.

### 4.2 Tiers: one paid tier at launch

**Owner revision, 2026-09-11:** winery discovery is free: map pins, Nearby, Find, Home's Near You, winery pages, directory websites where available, and directions. Google enrichment remains Pro-only and server-gated. This supersedes older discovery-as-Pro copy; prices, scan/chat allowances, cellar limit, and export access are unchanged. Sommelier photo questions and web search already exist for Pro. See [the September 11 product follow-up](pro-product-direction-2026-09-11.md) for proposed additions and the future optional winery-insights policy.
Two paid tiers before you have any conversion data is premature. Launch with Free + Pro and add a higher tier only if usage shows a heavy-AI segment.

**Revised 2026-09-09** after the owner reopened monetization: free scans went from 3/month to **3 lifetime**, free chat became **text-only**, and Pro's "unlimited" gained explicit fair-use caps. Weekly pass and a third tier were considered and deferred (see the decision log below the table).

| | **Free** | **Pro** |
|---|---|---|
| Manual logging: visits, tastings, ratings, flavor notes, photos | Unlimited | Unlimited |
| Map, places, wishlist | Unlimited | Unlimited |
| Cellar | Up to 25 bottles | Unlimited + insights, drink windows, Tonight's Pick |
| Label scan / tasting-card scan | **3 lifetime** (to try; was 3/month until 2026-09-09) | Unlimited (fair use: 30/day) |
| AI sommelier chat | 5 messages per month, **text-only** — photos in chat would be a free scan by the back door | Unlimited (fair use: 50/day and 1,000/month), photos allowed |
| Sommelier can search the web for a specific wine | — | **Yes** (added 2026-09-09; max 2 searches per message) |
| Guided tools: choose from a wine list, taste report, plan a wine day | Sample only, with an upgrade button | **Yes** (added 2026-09-11; fair use: 15 list scans, 15 picks, 5 reports, 10 day plans per day) |
| US wine regions (AVA boundaries) on the map | Toggle visible, opens the paywall | **Yes** (added 2026-09-11; all 280 AVAs from TTB's own boundary service, in-app data) |
| Export (CSV of tastings) | — | Yes |
| Price | $0 | **$9.99/mo · $59.99/yr** — decided 2026-09-03, reconfirmed 2026-09-09; no lifetime SKU at launch. The free trial is on the annual product only (**3 days**, shortened from 7 on 2026-09-09 and updated in App Store Connect the same day); monthly has none. Both live in App Store Connect since 2026-09-08, priced in all 175 territories. Trial exposure is bounded either way: the fair-use caps apply during the trial, and Apple grants one intro offer per Apple ID per subscription group, ever |

**2026-09-09 decision log** (owner reopened monetization before the build-out; all enforced server-side in `_shared/entitlements.ts`):
- **Free scans: 3 lifetime, not 3/month.** The reason to gate scans is conversion, not cost (a Haiku scan is ~⅓¢): three-ever lets a new user feel the magic once, then the wall holds. This is Sommo's model (5 lifetime).
- **Free chat: text-only.** The sommelier accepts photos, so a free user could attach a label and ask "what's this?" — a scan on the *more expensive* model. Server refuses with the paywall 402; the camera button in chat opens the paywall for free users.
- **Pro fair-use caps: 50 chat/day + 1,000 chat/month, 30 scans/day, 20 Tonight's Picks/day.** The old 150/day global cap allowed ~$54/month of Sonnet against $8.49 net. These are abuse guards, not experienced limits — no human journaling wine hits them — so the marketing word stays "unlimited" with a fair-use line in the Terms (already there, deliberately without numbers).
  - **Tonight's Pick's cap was missing until 2026-09-10** and is worth recording, because the failure was silent. `tonights_pick` became a metered task in #213 on the same day #199 was rewriting the cap tables; the task landed in `FREE_TIER_LIMITS` but in neither `FAIR_USE_DAILY_CAPS` nor `FREE_METER_WINDOWS`. A missing cap **fails open** — `counts.day >= undefined` is `false` — so for about a day the only thing bounding Tonight's Pick in production was the 15-per-5-minute burst cap, roughly 4,300 calls/day of Sonnet-with-the-whole-cellar. Nothing caught it because `deno check` (which had been reporting it as a type error all along) was not in CI. Fixed by capping it at 20/day, typing both tables `Record<MeteredTask, …>` so a new task cannot compile until it is capped, adding the tables to CI via a `deno check` job, and adding tests that fail on the old code.
- **Weekly "tasting trip" pass: deferred, not rejected.** RevenueCat can add a `pro_weekly` SKU post-launch without an app release. Note: with the trial shortened to 3 days (2026-09-09) it covers a long weekend rather than a full trip week, which *strengthens* the weekly-pass case — revisit as soon as RevenueCat shows a burst-usage-then-churn cohort.
- **Third tier (Pro+ with winery discovery via Google Places): deferred.** Two paid tiers with zero conversion data means guessing twice, and Places API costs (~$32/1k Nearby Search calls) need a higher price to carry them. It is the natural anchor for a ~$14.99–19.99/mo tier *after* data shows a trip-planning segment — and a future upgrade story for existing Pros.
- **Web search: Pro-only (added 2026-09-09).** The sommelier previously answered from model memory alone, which is fine for "what is Cabernet Franc like" and quietly unreliable for "how is the 2021 Octagon drinking" — exactly the questions a Virginia-launch user asks about 4,000-case producers, and exactly where a confident wrong answer costs trust. Anthropic's server-side `web_search` tool closes that with no second vendor and no scraping: Claude decides per message whether to search, and cited pages come back with the answer so the app can show sources. Pro-only does double duty — it bounds the spend to people paying us, and "the sommelier can look the wine up" is a stronger reason to subscribe than a bigger message count. Capped at **2 searches per message** (`WEB_SEARCH_MAX_USES`), which is the per-message cost ceiling. Scans never search: they run on Haiku, which does not support the tool version at all, and the answer is already in the photo.
- **Chat stays on Sonnet.** Haiku would cut chat cost ~8× but the sommelier is the flagship the $9.99 positioning leans on, and chat is already only ~4% of net revenue per modeled user. Downgrading the product to save a cent a message optimizes the wrong side.

Standing reasoning:
- **Never gate the journal itself.** Logging is the habit loop and the data that makes the sommelier personal. Every rating benchmark says gating the core kills retention before conversion.
- **Gate the things that cost you money or feel magical:** scans and AI. Metered free use (3 lifetime scans, 5 messages/month) lets people feel it, then locks. Sommo, the closest AI-native competitor, ships 5 lifetime scans + a 3-day trial at $4.99/mo. Those two numbers are also the app's only defence against the Anthropic bill — §4.3 works out exactly how much of the $100 cap they consume.
- **Cellar cap** mirrors CellarTracker's bottle-tiered model and catches the collector segment without touching casual tasters.
- **Price (decided: $9.99/mo · $59.99/yr):** consumer wine apps cluster at $5–6/mo (Vivino $4.99, Delectable $5.99); AI/collector tools at $10–15 (Wine-Searcher $10.99, InVintory $14.95). $9.99 places Cork & Note with the AI/collector tools, so the paywall must lead with the sommelier and unlimited scans, not with "more journaling." Annual at $59.99 (six months' price) is the plan to push, since annual subscribers retain 44% at 12 months versus 17.5% for monthly. If trial-to-paid comes in under ~25%, run a RevenueCat price experiment at $7.99 before touching features.
- **No lifetime SKU at launch** (decided). Revisit after 90 days of data; about 40% of lifestyle apps blend one in later.
- **v1 ships with the paywall** (decided 2026-09-08), rather than launching free and adding it later. That is the right call for a tiny audience — a free-first launch trains your first hundred users to expect unlimited AI and then takes it away — but it moves three things onto the critical path that a free-first launch could have deferred: the **bank account**, a **sandbox purchase**, and the **paywall review screenshots**. It also means the server-side metering deploys *with* the launch build, not before it (§4.5.4).

### 4.3 Will the AI cost eat the margin? No — and the $100 cap says where the edge is.

Modeled at 30 chats/month (2k context in, 400 out) plus 20 label scans (1,000px photo ≈ 1,300 image tokens):

| Model | Cost / paying user / month | Share of $8.49 net |
|---|---|---|
| Claude Haiku 4.5 (scans today) | ~$0.18 | 2% |
| Claude Sonnet-class (chat today) | ~$0.36 | 4% |
| A 10× power user on Sonnet | ~$3.60 | 42% |

Both cheap wins have shipped (#187): photos are **downscaled to ~1,000px** on the long edge before upload, and the **system prompt is cached** (cuts cached input cost ~90%). The numbers above already assume them.

**What the $100/month cap buys** (set 2026-09-08, alert at $50). Unit costs fall out of the table: **~$0.009 a scan** (Haiku) and **~$0.012 a sommelier message** (Sonnet). So:

| | Per user / month | $100 covers |
|---|---|---|
| Free user who spends the whole meter — 5 messages/month (the 3 scans are lifetime, so ~3¢ once, ever) | **~$0.06/mo** | **~1,600 free users** |
| Free user who never touches AI | $0 | unbounded |
| Pro user at the modeled 30 chats + 20 scans | **~$0.54** | **~185 Pro users** |

Read those as the two ends of one budget, not two budgets. The realistic launch blend — a few thousand installs, a minority of them ever opening the sommelier, ~2% paying — sits comfortably inside $100. **The meters are what make that true.** Without the 3-scan/5-message cap, a single curious free user can spend a Pro user's entire monthly allowance in an afternoon, and free users are unbounded in number.

**What web search adds (2026-09-09).** A search bills **1¢ flat** ($10/1,000) plus the retrieved text as ordinary input tokens, so a *searched* Pro message costs **~3–4¢ against ~1.2¢ unsearched**. The saving grace is that the model only searches when the question needs it — "what pairs with duck?" never triggers one — so at a realistic 10–20% of messages this adds about **$0.30–0.60 per Pro user per month**, a rounding error against $8.49 net. The number that matters is the ceiling: a user who ground the full 1,000-message monthly cap with two searches on every message would cost **~$35–45/month** (versus ~$13 before search). That is bounded and known rather than open-ended, and `chat_usage.web_searches` now records the billed search count on every call, so a per-day search cap can be argued from evidence instead of nerves. Not built pre-launch on purpose — the existing 50/day and 1,000/month caps already bound it.

**One more input-side cost (2026-09-09):** the sommelier's system prompt now carries the user's cellar (capped at 40 lots) and the wineries they have visited, which adds roughly 0.5¢ to an *uncached* call. Prompt caching absorbs it across the turns of a conversation, and it is what lets the main chat answer "what should I open tonight?" at all.

**Where $100 stops being right.** At the §4.4 growth case — 10,000 downloads, 200–300 payers — Pro usage alone is ~$110–160/month before a single free user is counted. **The cap must move before the app gets there**, and the trigger is knowable in advance: raise it when the Anthropic spend crosses ~$50 in a month (which is what the alert is for) or when paying subscribers pass ~100, whichever comes first.

**⚠️ The cap is a fuse, and a fuse that blows takes the paid feature with it.** When Anthropic stops serving, the sommelier and label scanning fail for *everyone* — including subscribers who paid $9.99 for exactly those two things. That is a refund and a one-star review, not a saved $20. So: treat the $50 alert as an action item rather than an FYI, and raise the cap as soon as there is subscription revenue to raise it against. $100 is correct for a launch with no paying users; it is not correct a month after the paywall starts converting.

### 4.4 Honest revenue math
RevenueCat's 2026 median for freemium is **2.1%** of downloads paying by day 35 (hard paywalls ~10.7%, but those kill a journal app's retention).

| Lifetime downloads | Payers at 2–3% | Monthly revenue (mixed monthly/annual, net) |
|---|---|---|
| 1,000 | 20–30 | ~$120–250 |
| 10,000 | 200–300 | ~$1,200–2,500 |
| 50,000 | 1,000–1,500 | ~$6,000–12,000 |

Fixed costs: Apple $99/yr, Supabase Pro ~$25/mo (still to be turned on — the free tier auto-pauses the backend), Anthropic **capped at $100/mo** and realistically $20–40 at launch scale, RevenueCat $0 until $2.5k MTR, domain ~$15/yr. Note the interaction with §4.3: the 10,000-download row in this table is *already* past what a $100 Anthropic cap can serve. The first goal is not profit; it is **retention data and 100 real users** to learn what people pay for. The B2B winery line (sponsored placements, visit analytics) from the June doc is the eventual larger business, but it needs consumer scale first.

### 4.5 Implementation plan for Pro (about 4–5 days)
1. ~~**Products in App Store Connect**~~ **✅ done 2026-09-08.** `pro_monthly` ($9.99/month, no trial) and `pro_annual` ($59.99/year, 3-day free trial — created as 7-day, switched to 3 days via the ASC API on 2026-09-09) in the group "Cork & Note Pro", priced and available in all 175 territories. Two stray non-consumable IAPs left over from an earlier experiment were deleted at the same time, so the review submission has no unfinished products in it.
2. ~~**RevenueCat**~~ **✅ done 2026-09-08.** Project `proj3888109e`, App Store app `appa26facd9fb`, entitlement `pro`, offering `default`, both products attached. The App Store Connect **In-App Purchase key is generated and verified**: sandbox receipt validation authenticates, and the production check returns **401, which is expected** — Apple only serves production receipts for a released app. Do not regenerate the key on the strength of that 401; re-check it after the first release. What is still missing is the webhook (URL + shared secret) and the EAS variable, both in [`owner-checklist.md`](owner-checklist.md) §C.
3. ~~**Client**~~ **✅ done.** `usePro()` exposes `isPro`, `remaining(task)`, `gate(task)` and `presentPaywall()`. The user is identified to RevenueCat by Supabase user id and logged out on sign-out, without which the next account on a device inherits the previous one's Pro.
4. ~~**Server truth**~~ **✅ built; the chat half is deliberately not deployed yet.** `revenuecat-webhook` → `public.entitlements`, and the chat function decides Pro from that table and meters free users on `chat_usage.task` (scans over a lifetime window, chat per calendar month, per the 2026-09-09 revision; Pro gets per-task fair-use caps). It refuses a spent meter with 402, which is what the app opens the paywall on. Deploying the metering before a build exists that can sell a subscription would wall testers with no way past, so it ships with that build. The gate logic itself is already proven by `__tests__/ai-gates.test.js`, which walks multi-day usage sequences (a free user burning the lifetime scans across months, a Pro user grinding 50 chats/day into the 1,000/month ceiling, the photo-in-chat refusal) through the exact function production runs. **At deploy time, verify the wiring live** with a throwaway confirmed user (the pattern that verified #161): 4th scan → 402, photo in chat → 402, 6th chat message → 402, then `delete-account` to clean up. **Add one web-search check to that same pass** (2026-09-09): ask a Pro/trial user about a specific small-producer wine and confirm the reply comes back with a `sources` array, then ask a free user the same question and confirm it does not. This is the one part of the search work that unit tests cannot prove — `web_search_20260209` is exercised against the real API for the first time at deploy, and a wrong tool-version string fails as a 400 on every Pro chat. The Anthropic key lives only as a Supabase secret, so there is no way to run this check before the function is deployed.
5. ~~**Gates in the app**~~ **✅ done.** Scans, sommelier send (both surfaces), cellar add past 25, and CSV export — which had to be built, since it did not exist.

Two decisions taken while building that differ from the plan above:

- **The paywall is a screen in the app, not a dashboard-designed Paywalls v2 template.** Guideline 3.1.2 requires specific text and two working legal links, and leaving those to remote configuration means a rejection is one dashboard edit away. `lib/purchases.js` still exposes `presentHostedPaywall()`, so moving to Paywalls v2 for copy and price tests is a small change when there is data worth testing.
- **Bottle pairing and AI drink windows spend the sommelier meter** rather than being Pro-only or free. (Tonight's Pick was moved off it and made Pro-only in #213 — its own task, free limit 0, capped at 20/day.) They are Claude calls on the same path, so anything else either hands free users an unmetered Sonnet budget or walls a feature the tier table never said was paid. Worth revisiting once §4.6 usage data exists.
6. **Analytics:** RevenueCat charts cover revenue; add a lightweight event layer (PostHog free tier or Supabase table) for activation = first tasting logged, D1/D7/D30 return, paywall view → purchase.

---

## 5. Getting users — Virginia

The June strategy doc covers channels in depth; this is the concrete first-90-days version. **The launch region is Virginia** (decided 2026-09-08). The operational detail — AVA targeting, the winery shortlist, the card copy, the outreach email and the in-person script — is in **[`virginia-launch.md`](virginia-launch.md)**. This section is the strategy and the sequence.

**Positioning in one line:** *The wine journal for people who visit wineries. Log the tasting room, remember every wine, and ask a sommelier who knows what you actually liked.* Do not fight Vivino on "scan a label to see a score."

### 5.1 Why Virginia is the right launch region

- **You can drive to it, repeatedly.** Loudoun County is about **1h 20m from Baltimore** and 25 miles from DC. Placing cards is not a one-off delivery — it is a relationship that needs revisiting, restocking and filming, and the region you will actually go back to beats the region that looks best on paper.
- **It is dense enough to cluster.** Roughly 300 wineries statewide, and **51 in Loudoun County alone**. Four to six tasting rooms in one day, on foot-level effort, with no overnight.
- **Real, sourced tourist volume.** **2.64 million wine-related tourists and $246.7M of wine tourism revenue in 2019** (Virginia Wine Board economic impact study, published 2022). Average spend per wine trip **$717**; **61%+ of winery visitors are 25–54**, which is squarely the app's demographic.
- **The wineries themselves say they have the problem you solve.** In the 2024 GO Virginia Region 9 survey of the Charlottesville/Piedmont counties, **75% named tasting-room visitor traffic as a concern** and **43% named marketing**, with **72% of all sales going through the tasting room**. That is the opening line of every outreach conversation, and it is theirs, not ours.
- **Prestige exists here too.** The Monticello AVA was *Wine Enthusiast*'s **2023 Wine Region of the Year** — the only North American nominee. It is a two-hour drive and the best possible backdrop for founder content.

**Sequence, not a blanket.** Loudoun first (day trip, densest), Monticello second (overnight, prestige), then the **Virginia Peninsula AVA** — which has only **six wineries in total**, so it can be covered completely in a day. "Cork & Note is in every winery in the Virginia Peninsula AVA" is a true sentence worth owning.

### 5.2 Before submission (parallel with §2)

- ~~Landing site at your domain~~ — **live** at <https://cork-and-note.vercel.app> (#177), with privacy, terms and support. The domain is branding, not a blocker.
- Ask every current TestFlight tester to be ready to leave an App Store review on launch day. Ten reviews in week one matters more than any ad.
- ~~Pick one wine region you can drive to~~ — **Virginia.**
- **Decide the card attribution scheme before printing anything.** See §5.3 — this is the one item with a hard deadline, because it cannot be added to a card already on a bar.

### 5.3 Launch month

- **Tasting-room QR cards** — the channel no incumbent can copy, reaching people at the exact moment they have just tasted five wines and will not remember which was which. Copy, physical spec and the winery shortlist are in [`virginia-launch.md`](virginia-launch.md) §3–4. **Target for month one: five wineries with cards on the bar and a scan number you trust** — not forty placements you cannot measure.
- **⚠️ There is no attribution today.** No install referrer, no campaign parameter, no per-winery code. If cards go out and installs rise, nothing in the product can say which winery did it. A **per-winery short link** on the card is the cheapest fix, needs no app change, and is the only option that cannot be retrofitted onto a printed card. **This wants deciding before the first print run** — engineering lane, tracked in [`virginia-launch.md`](virginia-launch.md) §5.
- **Founder content:** short vertical videos of you logging at a tasting room, 2–3 per week, TikTok + Instagram Reels. Personality over polish. Every card trip is also a filming trip.
- **ASO:** the name/subtitle/keywords in §2.2; iterate monthly.
- **Local communities:** Virginia wine Facebook groups, r/wine, local clubs. Value first, 90/10 rule.
- **Apple Search Ads:** $10–20/day on "wine journal", "wine tasting notes", "winery app" once the paywall is live and you can see cost per trial.
- **October is Virginia Wine Month**, the state marketing office's flagship promotion. It is the obvious moment to launch into — but it is roughly three weeks from this decision, which is too tight for a print run plus winery sign-ups. **Pilot this October with hand-delivered cards; aim the real push at October 2027.**

**⚠️ One competitive note before approaching the state marketing office.** The Virginia Wine Board's FY2024–25 annual report says VirginiaWine.org has added **"new features like tracking winery visits."** Not the same product, but close enough that the state office is a *partner or a competitor, not a neutral channel*. Decide which before pitching. The Virginia Wineries Association, which has a formal affiliate tier for non-winery businesses, is the cleaner front door.

### 5.4 What Virginia exposes in the product

Choosing Virginia does not create new engineering work, but it does put weight on two known gaps. Both are documented in [`region-model.md`](../research/region-model.md) §11 and **neither is a launch blocker**.

- **The app has no winery data, in Virginia or anywhere.** Wineries are private per user with no shared directory and no place search, so a guest who scans a card in a tasting room types the winery's name in and drops a pin by hand. There is a historical irony worth knowing: a shared **~306-row Virginia winery catalog existed until 2026-06-19** and was deliberately deleted when the product went general-purpose. The import file is still in `data/`, imported by nothing, carrying no AVA data and one winery geocoded into Austria. Re-introducing a catalog means revisiting the per-user RLS model — a product decision, not a data import, and not one to take for launch.
- **Region autocomplete has no reference data**, so the first bottle from any region has nothing to suggest. Virginia makes this slightly more visible than most regions would, because its labels print the state on blends and the AVA on estate wines from the same producer — so `Virginia` and `Monticello` end up as two unrelated entries for one place. The cheap fix, if it ever matters, is seeding the autocomplete with Virginia's AVA names only; that is region-model §11.3 option 1 and it needs no schema change.

**What to measure weekly:** downloads, activation (logged a first tasting within 24h), D7 retention, paywall views, trial starts, paid conversions, Anthropic spend, and — once §5.3's attribution exists — scans per card per week. If activation is under ~40%, the onboarding (Layer C) is the problem, not marketing.

---

## 6. Sequenced roadmap

| Week | Work | Outcome |
|---|---|---|
| ~~**0 (you)**~~ | ~~Apple agreements, membership, Small Business Program, rebuild~~ | ✅ **done.** Build 11 on TestFlight |
| ~~**1**~~ | ~~§2.1 must-fixes 1–8; SDK check; migrations; legal pages~~ | ✅ **done**, and the legal pages now carry the owner's real answers |
| ~~**2**~~ | ~~UX Layer A + C, rating reorder, filters, serif guard~~ | ✅ **done** (#170, #189) |
| ~~**3**~~ | ~~Pro tier per §4.5; paywall~~ | ✅ **built** (#192). Journal tab (Layer B) still waits on the A/B decision |
| **Now** | **Bank account** (owner) · RevenueCat webhook + EAS key (owner, ~5 min) · **new EAS build** · sandbox purchase · paywall review screenshots · owner's legal read-through · listing upload | A submittable build that can actually sell a subscription |
| **Next** | Submit; deploy the chat metering with the launch build; QR cards printed; Virginia outreach started (§5) | In review |
| **After** | Launch; watch activation and D7; raise the Anthropic cap once revenue exists (§4.3); first RevenueCat price test; winery partnerships | Iterate on real data |

Android can wait: it doubles QA and store work, and every tester today is on iOS. Ship it once iOS retention looks healthy.

---

## 7. Decisions needed from you

1. **Journal tab (Layer B) or Profile-nesting only (Layer A)?** Recommendation: B. It demotes Cellar from the bar. *Owner asked for mockups of both before deciding (see `docs/design/mockups/`).*
2. ~~**Pricing**~~ — **Decided:** $9.99/mo · $59.99/yr, no lifetime SKU at launch.
3. ~~**Free meters**~~ — **Decided, revised 2026-09-09:** 3 **lifetime** scans + 5 AI messages per month (**text-only**), 25-bottle cellar cap, logging unlimited; Pro fair-use caps 50 chat/day, 1,000 chat/month, 30 scans/day, 20 Tonight's Picks/day. Weekly pass and a third tier considered and deferred — see the §4.2 decision log.
4. ~~**Launch region**~~ — **Decided 2026-09-08: Virginia.** Drivable from Maryland and dense enough to place cards in clusters. Go-to-market, AVA targeting, the winery shortlist, the QR card copy and the outreach email are in §5 and [`virginia-launch.md`](virginia-launch.md). Note the wrinkle in §5.4: the app carried a shared Virginia winery catalog until June 2026 and deliberately deleted it, so a Virginia launch gets no data help from that history.
5. **Domain:** do you own corkandnote.com or similar? Repurpose the Vercel deploy for the landing + legal pages, or delete it?
6. ~~**Apple account**~~ — **DONE 2026-09-03:** agreement signed.
7. ~~**Entity and money**~~ — **Decided 2026-09-08: no LLC.** Nicholas Horton operates personally, and the governing law is **Maryland**, where he lives. Both are now in `lib/legalContent.js`, which the in-app screens and the hosted `/privacy` and `/terms` are both generated from, so they cannot drift. The W-9 matches. If an LLC ever happens, the entity name has to change in that module and in App Store Connect together.
8. ~~**AI budget**~~ — **Decided 2026-09-08: $100/month, alert at $50.** §4.3 works out what that covers (~1,150 free users on full meters, or ~185 Pro users) and, more importantly, when it has to be raised: at ~$50 spent in a month or ~100 subscribers, whichever comes first. A blown cap kills the sommelier for paying subscribers too.
9. ~~**Android**~~ — **Decided:** iOS only for v1.
10. ~~**Launch scope**~~ — **Decided 2026-09-08: v1 ships with the paywall**, not free-first. See §4.2 for what that moves onto the critical path.

**Only #1 (navigation) and #5 (domain) are still open, and neither blocks submission** — #1 blocks the Journal tab, #5 is branding. One decision that is not on this list has also surfaced: the **region-model sign-off** in [`region-model.md`](../research/region-model.md) §10, which a Virginia launch makes slightly more pointed (§5.4).
