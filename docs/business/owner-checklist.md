# Owner checklist — things only Nick can do

**Updated:** 2026-09-03 · Companion to [`launch-plan-2026-09.md`](launch-plan-2026-09.md)

Everything here needs your identity, your accounts, your money, or a terminal on your Mac with Apple/Expo/Supabase logins. Nothing on this list can be done from a Claude session. Items are in the order they unblock work. "Hand back" says what I need from you afterwards so engineering can continue.

## A. Unblock builds (today)

- [x] **Sign the Apple Program License Agreement** — done 2026-09-03.
- [ ] **Confirm the Apple Developer membership expiry** at developer.apple.com/account → Membership. If it lapses, every build and the store listing go dark.
- [ ] **Move the App Store Connect API key out of Downloads**: `mv ~/Downloads/AuthKey_9L4MP9Y7C6.p8 ~/.private_keys/`. Never commit it.
- [ ] **Run the production build and push it to TestFlight** from your Mac (the command from issue #148, with the `.p8` path updated):
  ```sh
  EXPO_ASC_API_KEY_PATH=~/.private_keys/AuthKey_9L4MP9Y7C6.p8 \
  EXPO_ASC_KEY_ID=9L4MP9Y7C6 \
  EXPO_ASC_ISSUER_ID=42dc8229-7d4a-4e91-a360-246fb63fb049 \
  EXPO_APPLE_TEAM_ID=NR353MBYBA \
  EXPO_APPLE_TEAM_TYPE=INDIVIDUAL \
  npx eas-cli build --platform ios --profile production --non-interactive
  npx eas-cli submit --platform ios --latest --profile production --non-interactive
  ```
  EAS regenerates the expired certificate and profile itself now that the agreement is signed. Expect this to be **build 8**. If it fails on the Xcode 26 image, send me the log and I'll do the Expo SDK upgrade.
  *Hand back:* "build 8 is on TestFlight" or the error text.
- [ ] **Tell your testers to update** to build 8 (their current builds crash on any wine with varietals).

## B. Apple money and metadata (this week)

- [ ] **Paid Apps Agreement + banking + tax**: App Store Connect → Business → Agreements. Accept the Paid Apps agreement, add a bank account, complete the W-9. **No subscription can be sold until this is green**, and Apple takes days to approve it, so start now.
- [ ] **Enroll in the App Store Small Business Program** (developer.apple.com/app-store/small-business-program). 15% instead of 30%. Must be enrolled before the first paid transaction.
- [ ] **Create the subscription products** in App Store Connect → your app → Subscriptions:
  - Group: *Cork & Note Pro*
  - `pro_monthly` — $9.99 / 1 month
  - `pro_annual` — $59.99 / 1 year, with a 7-day free introductory offer
  - Localized display names: "Pro Monthly", "Pro Annual". Review screenshot and description can be placeholders until the paywall exists.
  - Generate an **In-App Purchase key** (Users and Access → Integrations → In-App Purchase) for RevenueCat.
  *Hand back:* the two product IDs as created (in case you change them).
- [ ] **Create a Sandbox tester** (Users and Access → Sandbox) so purchases can be tested on TestFlight builds.
- [ ] **Age rating questionnaire**: answer "Frequent/Intense" for alcohol references → 18+. (I'll tell you the exact answers when we fill in the listing.)
- [ ] **App Privacy questionnaire** in ASC: I'll give you the exact selections; only you can submit them.
- [ ] **Upload screenshots and listing copy**: I'll produce the screenshot set and the description/keywords; you upload and submit.

## C. Third-party accounts (this week)

- [ ] **RevenueCat**: create an account and a project "Cork & Note", add the iOS app with bundle id `com.nicholashorton.corkandnote`, connect it with the In-App Purchase key from B, create entitlement `pro`, offering `default` with the two products.
  *Hand back:* the **public** iOS SDK key (starts with `appl_`). It is safe in the app code. Never send me the secret API key.
- [ ] **Anthropic console**: set a monthly spend limit and an email alert. Suggested $100 limit, alert at $50, unless you want a different number.
  *Hand back:* the number you set, so the free-tier meters match it.
- [ ] **Google Cloud console**: restrict the Maps key currently committed in `app.json` (Android apps only, package `com.nicholashorton.corkandnote` + your release SHA-1), or delete it and create a new restricted one.
  *Hand back:* the new key, which I'll move into EAS environment variables instead of the repo.
- [ ] **Supabase**: from your Mac, run `supabase db push` to apply the three `20260705*` migrations (flavor-note RLS, private photo buckets, `delete_user_data`). Then check Database → Functions that `handle_new_user` exists and paste me its SQL so it can be committed as a migration. When account deletion ships, `supabase functions deploy` and `supabase secrets set` will also need you (or an access token in EAS/GitHub secrets).
- [ ] **Domain**: buy `corkandnote.com` (or the closest available) and tell me which registrar. The landing page, privacy policy, terms and support address all live there.
- [ ] **Support mailbox**: create `support@` on that domain (or a dedicated Gmail) and tell me the address; it goes in the app, the privacy policy and App Store Connect.
- [ ] **Social handles**: the app links to `corkandnote` on Instagram, Facebook and X, and none exist. Either register them or tell me to remove the links.

## D. Legal and business (before the paywall goes live)

- [ ] **Privacy policy and terms**: I will draft both. You must read them, fill in your legal name or entity and the support address, and ideally have a lawyer glance at them. They also disclose that chat text and photos are sent to Anthropic.
- [ ] **Business entity**: an LLC is not required to launch, but Apple pays whoever owns the developer account, and the tax and banking forms in B are easier to change now than after revenue starts. Your call; tell me either way so the legal pages match.
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
