# Owner checklist — things only Nick can do

**Updated:** 2026-09-08 · Companion to [`launch-plan-2026-09.md`](launch-plan-2026-09.md)

Everything here needs your identity, your accounts, or your money. Items are in the order they unblock work. "Hand back" says what I need from you afterwards so engineering can continue.

> **2026-09-08 — the browser work is essentially finished.** You cleared App Privacy, age ratings, the Small Business Program, the W-9, the Anthropic cap, the Maps key and the support mailbox in one sitting, and created the subscriptions and the RevenueCat project. **One Apple item is left — the bank account** — and everything else remaining is either a product decision (§E) or a short piece of engineering that now has what it needs.

## Where you actually are

| | |
|---|---|
| **Blocking a paid launch** | The **bank account** on the Paid Apps Agreement. Nothing can be sold until it is green, and Apple takes days. |
| **Blocking a testable build** | A **fresh EAS build** (`react-native-purchases` is native, so no existing TestFlight build can run the paywall) and a **sandbox tester**. |
| **Blocking submission** | Your **read-through of the legal pages**, the **paywall review screenshots**, and the App Store listing upload. |
| **Decisions still yours** | Navigation Option A vs B, and the region-model sign-off (#88). |

## A. Unblock builds — ✅ DONE

- [x] **Sign the Apple Program License Agreement** — done 2026-09-03.
- [x] **Move the App Store Connect API key out of Downloads** — done 2026-09-07. (macOS blocks *every* terminal process from reading `~/Downloads`, which is why this one genuinely needed you.)
- [x] **Production build + TestFlight submit** — done 2026-09-07 by Claude. It shipped as **build 11**, not 8: the signature alone wasn't enough, because the stored distribution certificate pointed at an Apple-side cert that no longer existed, and `--non-interactive` refuses to replace one. Regenerating it through `eas credentials:configure-build` produced a **new certificate and profile, both valid to 2027-09-07**, after which the standard recipe ran clean. Also confirms SDK 53 builds fine on the Xcode 26 image.
- [x] **Apple Developer membership** — ✅ checked 2026-09-08, current and in good standing. No action.
- [ ] **Tell your testers to update** — still yours, but it now waits on the next build rather than build 11: the paywall build is the one they need. Their pre-July builds crash on any wine with varietals.

## B. Apple money and metadata

- [ ] **Bank account on the Paid Apps Agreement** — ⚠️ **the last Apple blocker.** App Store Connect → Business → Agreements. The agreement itself is signed and the **W-9 is done** (both ✅ 2026-09-08); only the banking details remain. **No subscription can be sold until this is green**, and Apple takes days to approve it.
- [x] **App Store Small Business Program** — ✅ enrolled 2026-09-08. Commission is **15%**, so $9.99 nets **$8.49** and $59.99/yr nets **$50.99** (about $4.25/mo). Every net figure in the launch plan already assumes this rate.
- [x] **Create the subscription products** — ✅ done 2026-09-08. Group *Cork & Note Pro*; `pro_monthly` $9.99/month with **no trial**; `pro_annual` $59.99/year with a **7-day free trial**; both priced and available in all **175 territories**.
- [x] **Delete the two stray non-consumable IAPs** — ✅ done 2026-09-08. They were left over from an earlier experiment and would have shown up in the review submission as unfinished products.
- [x] **Age rating questionnaire** — ✅ done 2026-09-08. Frequent/intense alcohol references → 18+.
- [x] **App Privacy questionnaire** — ✅ done 2026-09-08, from the selections in [`app-store-listing.md`](app-store-listing.md) §7. Revisit it only if analytics (PostHog) are added, which would flip Usage Data to "collected".
- [x] **Privacy Policy URL and Support URL** (both are required ASC fields) — ✅ ready 2026-09-07, no domain needed:
  - Privacy policy: <https://cork-and-note.vercel.app/privacy>
  - Support: <https://cork-and-note.vercel.app/support>
  - Marketing: <https://cork-and-note.vercel.app>
- [ ] **Create a Sandbox tester** (Users and Access → Sandbox) so a purchase can actually be run end-to-end on the next TestFlight build. Cheap, and it is the only way to prove the paywall works before review.
- [ ] **Upload screenshots and listing copy**: the 6.9" screenshot set is captured and committed (`docs/marketing/screenshots/`) and the copy is written in [`app-store-listing.md`](app-store-listing.md); you upload and submit.
- [ ] **Paywall screenshots for App Review** — guideline 3.1.2 reviews look at the purchase screen. Needed from the build below: the paywall with both prices and the auto-renew text visible, and Restore Purchases. Can't be captured until the new build exists.

## C. Third-party accounts

- [x] **Anthropic spend cap** — ✅ set 2026-09-08 to **$100/month**. The free-tier meters (3 scans + 5 sommelier messages per month) are sized against that number; see launch plan §4.3.
- [x] **Google Maps key** — ✅ rotated 2026-09-08. The committed key is dead.
  *Hand back:* the new key, so it goes into the EAS `production` and `preview` environments as `GOOGLE_MAPS_API_KEY`. `app.config.js` already reads only that variable, so nothing in git needs to change — but **Android maps stay blank until the new key is in EAS**.
- [x] **Support mailbox** — ✅ created 2026-09-08.
  *Hand back:* **the address itself.** It is not in the repo yet, so nothing references it. Once you send it, it goes in three places: the privacy policy ("Who we are"), the terms ("Your account"), and the App Store Connect support contact. See §D.
- [x] **RevenueCat project** — ✅ done 2026-09-08. Project `proj3888109e`, App Store app `appa26facd9fb`, entitlement `pro`, offering `default`; **both products attached** (`pro_monthly`, `pro_annual`). The public `appl_` SDK key is in `~/.secrets/ops.env`.
- [x] **App Store Connect In-App Purchase key** — ✅ generated 2026-09-08 and **verified** in RevenueCat. Sandbox receipt validation authenticates. The production check returns **401, which is expected and not a fault**: Apple only serves production receipts for an app that has been released. Re-check it after the first release; do not regenerate the key on the strength of that 401.
- [ ] **Point RevenueCat at our webhook** (browser-only, ~3 minutes). Two halves, and the webhook rejects everything until both match:
  1. In RevenueCat → *Projects → Cork & Note → Integrations → Webhooks*, add a webhook with
     **URL:** `https://ixecayqpogkiawempzgc.supabase.co/functions/v1/revenuecat-webhook`
     **Authorization header value:** a long random string you invent (a password manager's generator is ideal).
  2. Give Supabase the same string, from a terminal in the repo:
     ```
     supabase secrets set REVENUECAT_WEBHOOK_SECRET='<the same string>' \
       --project-ref ixecayqpogkiawempzgc
     ```
  Until this is done the endpoint answers `503 Not configured` to everyone, which is deliberate: an unauthenticated webhook could grant anyone Pro. Send RevenueCat's "Send test webhook" afterwards — it should answer `200 {"ok":true,"updated":0}` (a test event names no real user, so there is nothing to write).
- [ ] **Add the RevenueCat key to EAS** so the app can talk to the store. From a terminal in the repo, for both environments:
  ```
  eas env:create --environment production --name REVENUECAT_IOS_API_KEY --value '<REVENUECAT_PUBLIC_KEY_CORKNOTE from ~/.secrets/ops.env>'
  eas env:create --environment preview    --name REVENUECAT_IOS_API_KEY --value '<same value>'
  ```
  It is a publishable key — it is safe inside the app binary — but it lives in EAS rather than git so it can be rotated without a release, exactly like `GOOGLE_MAPS_API_KEY`. Without it the app runs as if the Pro tier did not exist.
- [ ] **New EAS build** once the two lines above are set. This is the gate on everything testable: the paywall, the sandbox purchase, the review screenshots and un-crashing your testers all sit behind it. Claude can run the build; it needs the EAS variables first.
- [x] **Supabase** — ✅ done 2026-09-07 by Claude, once you refreshed the access token. Migration history repaired and `db push` applied; `handle_new_user` read straight out of the live DB and committed as a migration (#176); both edge functions (`chat`, `delete-account`) deployed; account deletion verified end-to-end against production.
- [ ] **Supabase Pro (~$25/mo)** — needs your billing details. The project **auto-paused** on the free tier on 2026-09-07 (the backend was simply down until it was unpaused via the API) and it will keep doing that. A paused backend during launch week is the single most expensive failure available for $25. Do it before the QR cards go out.
- [ ] **Domain**: buy `corkandnote.com` (or the closest available) and tell me which registrar. **Not blocking submission** — the landing page, privacy policy, terms and support pages are live at <https://cork-and-note.vercel.app> (#177), which satisfies the two URLs App Store Connect requires. It is now a branding step: point it at the same Vercel project and nothing in the code changes. It does gate a `support@corkandnote.com`-style address and the `review@corkandnote.com` demo login in [`app-store-listing.md`](app-store-listing.md), which today names a domain you do not own.
- [x] **Social handles** — resolved 2026-09-07: the dead links were removed from the app (#166). Register the handles whenever you want them back and I'll re-add them.

## D. Legal and business

- [x] **Governing law and legal name** — ✅ answered 2026-09-08: **Maryland**, and **Nicholas Horton as an individual**. Both are now in `lib/legalContent.js`, which is the single source of truth — the in-app screens render it and `site/build.mjs` generates the hosted `/privacy` and `/terms` from the same module, so they cannot drift. The hosted pages pick it up on the next Vercel deploy.
- [x] **Business entity** — ✅ decided 2026-09-08: **no LLC**; you operate personally. The legal pages, the W-9 and the Apple payee all now say the same thing. If that ever changes, the entity name has to change in `lib/legalContent.js` and in App Store Connect together.
- [ ] **⚠️ The support address is still a hole in the legal pages.** You have created the mailbox but the address has not reached the repo, so the policy and terms still route people to the in-app feedback form only. That is honest and it is not a rejection risk — but a written contact address is the normal expectation for a privacy policy, and the App Store Connect support contact wants one too. **Send me the address** and it goes in three exact places:
  - `lib/legalContent.js` → `PRIVACY_POLICY` → "Who we are" → the second paragraph, which currently reads *"Questions or requests about your data? Use the contact form in Profile → Feedback."*
  - `lib/legalContent.js` → `TERMS_OF_USE` → "Your account" → the sentence that currently reads *"...let us know (Profile → Feedback) if you believe your account has been compromised."*
  - App Store Connect → App Information → support contact, and `docs/business/app-store-listing.md` §8/§10, which still names `review@corkandnote.com` on a domain you do not own yet.
  Both documents' `updated` dates get bumped in the same change.
- [ ] **Your read-through of the legal pages** — the last legal item, and it blocks submission. Read <https://cork-and-note.vercel.app/privacy> and `/terms` end to end now that the names and the governing law are real. Worth a lawyer's glance. They already disclose that chat text and photos go to Anthropic, that location is foreground-only, and how deletion works.
- [ ] **Deploy the metering half of the chat function — with the paywall build, not before.** The Pro tier's server-side meters (3 scans and 5 sommelier messages a month) are written and tested but deliberately NOT deployed: turning them on now would wall testers on build 11, which has no paywall to buy your way past. Ship it with the first build that has one:
  ```
  supabase functions deploy chat --project-ref ixecayqpogkiawempzgc
  ```
- [ ] **Confirm the app icon**: `assets/images/cork_and_note_logo.png` is the only real logo in the repo, and #190 added logo explorations. If one of those is final, I'll generate the icon, adaptive icon and splash from it. If not, send the final artwork.

## E. Decisions still open

- [ ] **Navigation: Option A or Option B** (mockups: https://claude.ai/code/artifact/f5282092-c780-4f98-88de-e961584a85af). The last thing blocking the rest of the UX pass — the Journal tab (Layer B) cannot start without it.
- [ ] **Region model sign-off (#88)** — the three questions in [`region-model.md`](../research/region-model.md) §10. Short version: Stage 1 (autocomplete over your own past entries) has shipped, and the recommendation is to stop there until it demonstrably still hurts. A Virginia launch makes this slightly more pointed, because "Monticello" and "Virginia" are two correct answers for the same bottle — see the launch plan's §5.4 data note. Not a launch blocker.

**Decided 2026-09-08:**

- [x] **Launch wine region: Virginia.** Drivable from Maryland, and dense enough to place cards in clusters. The go-to-market, the AVA targeting, the winery shortlist, the QR card copy and the outreach email are in launch plan §5 and [`virginia-launch.md`](virginia-launch.md). One thing to know going in: the app has **no Virginia winery data** — a shared Virginia catalog existed until June 2026 and was deliberately deleted when wineries became private per user, so a guest scanning a card in a tasting room types the winery's name in themselves. See [`region-model.md`](../research/region-model.md) §11.
- [x] **Launch scope: v1 ships with the paywall.** Not free-first. That makes the bank account, the sandbox tester and the paywall screenshots submission blockers rather than fast-follows, and it means the chat metering deploys with the launch build.
- [x] **AI spend cap: $100/month** (see §C).

Still undecided and parked: the **domain name** (see §C — it is a branding choice, not a blocker).

## F. Marketing tasks that need you personally (launch month)

- [ ] Ask every TestFlight tester to leave an App Store review on launch day.
- [ ] Approach 5–10 Virginia wineries about placing QR cards in the tasting room. The shortlist, the card copy and the email to send are in [`virginia-launch.md`](virginia-launch.md) — you should not have to write anything from scratch.
- [ ] Record short vertical videos of you logging at a tasting room, two or three per week.

---

**Decided so far:** Pro at $9.99/mo and $59.99/yr with a 7-day trial on annual only, no lifetime unlock · Free tier: unlimited logging, 3 scans + 5 sommelier messages a month, 25-bottle cellar cap · iOS only for v1 · **v1 ships with the paywall** · **launch region Virginia** · **Anthropic capped at $100/mo** · **no LLC, Maryland law**.

**Owner work completed 2026-09-08:** Anthropic cap set · App Privacy questionnaire · age ratings · W-9 · Small Business Program enrolment · Apple membership confirmed · two stray non-consumable IAPs deleted · Google Maps key rotated · support mailbox created · subscriptions created in App Store Connect · RevenueCat project, entitlement, products and offering wired · In-App Purchase key generated and verified · governing law and legal name answered · launch region and launch scope decided.

**Shipped 2026-09-08:** the Pro tier — RevenueCat purchases, a guideline-3.1.2 paywall, Restore Purchases, and the four free-tier gates, with the entitlement decided server-side (#192). **It needs a fresh EAS build to be testable at all** (`react-native-purchases` is native code, so no existing TestFlight build can run it).

**Shipped 2026-09-07:** build 11 on TestFlight (signing repaired, valid to 2027) · account deletion live and verified against production · privacy/terms in-app and hosted · UX findability pass (Layers A + most of C) · landing site replacing the 2-month-broken Vercel build · Jest suite + CI · Supabase migration drift resolved and the auto-paused project brought back up.
