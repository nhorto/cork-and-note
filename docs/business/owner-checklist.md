# Owner checklist — things only Nick can do

**Updated:** 2026-09-08 · Companion to [`launch-plan-2026-09.md`](launch-plan-2026-09.md)

Everything here needs your identity, your accounts, or your money. Items are in the order they unblock work. "Hand back" says what I need from you afterwards so engineering can continue.

> **2026-09-07 — this list got much shorter.** The earlier assumption that anything touching Apple/Expo/Supabase needed your hands was wrong: the EAS CLI is logged in and the Supabase CLI works with the token in `~/.zshrc`, so builds, submissions, migrations and function deploys now run from a Claude session. What genuinely remains is browser-only work (App Store Connect business forms, Anthropic and Google Cloud consoles), buying the domain, and the product decisions in §E.

## A. Unblock builds — ✅ DONE 2026-09-07

- [x] **Sign the Apple Program License Agreement** — done 2026-09-03.
- [x] **Move the App Store Connect API key out of Downloads** — done 2026-09-07. (macOS blocks *every* terminal process from reading `~/Downloads`, which is why this one genuinely needed you.)
- [x] **Production build + TestFlight submit** — done 2026-09-07 by Claude. It shipped as **build 11**, not 8: the signature alone wasn't enough, because the stored distribution certificate pointed at an Apple-side cert that no longer existed, and `--non-interactive` refuses to replace one. Regenerating it through `eas credentials:configure-build` produced a **new certificate and profile, both valid to 2027-09-07**, after which the standard recipe ran clean. Also confirms SDK 53 builds fine on the Xcode 26 image.
- [ ] **Tell your testers to update** — the one part still yours. Their pre-July builds crash on any wine with varietals.
- [ ] **Confirm the Apple Developer membership expiry** at developer.apple.com/account → Membership. Not urgent now that a build has gone through, but if it lapses every build and the store listing go dark.

## B. Apple money and metadata (this week)

- [ ] **Paid Apps Agreement + banking + tax**: App Store Connect → Business → Agreements. Accept the Paid Apps agreement, add a bank account, complete the W-9. **No subscription can be sold until this is green**, and Apple takes days to approve it, so start now.
- [ ] **Enroll in the App Store Small Business Program** (developer.apple.com/app-store/small-business-program). 15% instead of 30%. Must be enrolled before the first paid transaction.
- [x] **Create the subscription products** — ✅ done 2026-09-08. Group *Cork & Note Pro*; `pro_monthly` $9.99/month; `pro_annual` $59.99/year with a 7-day free trial; both priced and available in all 175 territories.
- [ ] **Create a Sandbox tester** (Users and Access → Sandbox) so purchases can be tested on TestFlight builds.
- [ ] **Age rating questionnaire**: answer "Frequent/Intense" for alcohol references → 18+. (I'll tell you the exact answers when we fill in the listing.)
- [ ] **App Privacy questionnaire** in ASC: I'll give you the exact selections; only you can submit them.
- [ ] **Upload screenshots and listing copy**: I'll produce the screenshot set and the description/keywords; you upload and submit.
- [x] **Privacy Policy URL and Support URL** (both are required ASC fields) — ✅ ready 2026-09-07, no domain needed:
  - Privacy policy: <https://cork-and-note.vercel.app/privacy>
  - Support: <https://cork-and-note.vercel.app/support>
  - Marketing: <https://cork-and-note.vercel.app>

## C. Third-party accounts (this week)

- [x] **RevenueCat** — ✅ done 2026-09-08. Project `proj3888109e`, App Store app `appa26facd9fb`, entitlement `pro`, offering `default` with `$rc_monthly` / `$rc_annual`. The public `appl_` SDK key is in `~/.secrets/ops.env`.
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
- [ ] **Anthropic console**: set a monthly spend limit and an email alert. Suggested $100 limit, alert at $50, unless you want a different number.
  *Hand back:* the number you set, so the free-tier meters match it.
- [ ] **Google Cloud console**: restrict the Maps key currently committed in `app.json` (Android apps only, package `com.nicholashorton.corkandnote` + your release SHA-1), or delete it and create a new restricted one.
  *Hand back:* the new key, which I'll move into EAS environment variables instead of the repo.
- [x] **Supabase** — ✅ done 2026-09-07 by Claude, once you refreshed the access token. Migration history repaired and `db push` applied; `handle_new_user` read straight out of the live DB and committed as a migration (#176); both edge functions (`chat`, `delete-account`) deployed; account deletion verified end-to-end against production. Two things surfaced while doing it: the project had **auto-paused** on the free tier (so the backend was down — unpaused via the API), and it will keep auto-pausing. **Supabase Pro (~$25/mo) stops that, and needs your billing details** — worth doing before real users arrive.
- [ ] **Domain**: buy `corkandnote.com` (or the closest available) and tell me which registrar. **No longer blocking submission** — the landing page, privacy policy, terms and support pages are already live at <https://cork-and-note.vercel.app> (#177), which satisfies the two URLs App Store Connect requires. Buying the domain is now a branding step: point it at the same Vercel project and nothing in the code changes.
- [ ] **Support mailbox**: create `support@` on that domain (or a dedicated Gmail) and tell me the address; it goes in the app, the privacy policy and App Store Connect.
- [x] **Social handles** — resolved 2026-09-07: the dead links were removed from the app (#166). Register the handles whenever you want them back and I'll re-add them.

## D. Legal and business (before the paywall goes live)

- [ ] **Privacy policy and terms**: both are **drafted, in the app, and publicly hosted** (<https://cork-and-note.vercel.app/privacy> and `/terms`). What's left is your read-through: confirm the governing-law state, your legal name or entity, and the support address once it exists. Worth a lawyer's glance. They already disclose that chat text and photos go to Anthropic.
- [ ] **Business entity**: an LLC is not required to launch, but Apple pays whoever owns the developer account, and the tax and banking forms in B are easier to change now than after revenue starts. Your call; tell me either way so the legal pages match.
- [ ] **Deploy the metering half of the chat function — but not before the paywall build is live.** The Pro tier's server-side meters (3 scans and 5 sommelier messages a month) are written and tested but deliberately NOT deployed: turning them on now would wall testers on build 11, which has no paywall to buy your way past. Ship it with the first build that has one:
  ```
  supabase functions deploy chat --project-ref ixecayqpogkiawempzgc
  ```
- [ ] **Confirm the app icon**: `assets/images/cork_and_note_logo.png` is the only real logo in the repo. If that is final, I'll generate the icon, adaptive icon and splash from it. If not, send the final artwork.

## E. Decisions still open

- [ ] **Navigation: Option A or Option B** (mockups: https://claude.ai/code/artifact/f5282092-c780-4f98-88de-e961584a85af). Everything else in the UX pass can start without this.
- [ ] **Launch wine region** for QR cards and content.
- [ ] **AI spend cap** (see C).
- [ ] **Domain name** (see C).

## F. Marketing tasks that need you personally (launch month)

- [ ] Ask every TestFlight tester to leave an App Store review on launch day.
- [ ] Pick 5–10 wineries in the launch region and ask about placing QR cards in the tasting room.
- [ ] Record short vertical videos of you logging at a tasting room, two or three per week.

---

**Decided so far:** Pro at $9.99/mo and $59.99/yr with a 7-day trial, no lifetime unlock · Free tier: unlimited logging, 3 scans + 5 sommelier messages a month, 25-bottle cellar cap · iOS only for v1 · Apple agreement signed.

**Shipped 2026-09-08:** the Pro tier — RevenueCat purchases, a guideline-3.1.2 paywall, Restore Purchases, and the four free-tier gates, with the entitlement decided server-side. **It needs a fresh EAS build to be testable at all** (`react-native-purchases` is native code, so no existing TestFlight build can run it).

**Shipped 2026-09-07:** build 11 on TestFlight (signing repaired, valid to 2027) · account deletion live and verified against production · privacy/terms in-app and hosted · UX findability pass (Layers A + most of C) · landing site replacing the 2-month-broken Vercel build · Jest suite + CI · Supabase migration drift resolved and the auto-paused project brought back up.
