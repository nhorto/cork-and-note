# Cork & Note early-tester program

Prepared September 14, 2026. Nick approved 30 days of complimentary Pro for accepted testers, with no automatic charge afterward. Target 15–20 Android participants, with iPhone testing continuing independently. The initial recruitment copy focuses on US adults 21+; this is our cohort choice, not a Google requirement.

## What we are offering

An invitation to help improve an unreleased wine journal, plus 30 days of complimentary Pro from activation. No purchase, card or public review is required. The gift expires to Free; existing journal data stays available. It does not cancel a pre-existing store subscription. Fair-use limits and the project's real AI/API costs still apply.

Use RevenueCat's promotional `pro` entitlement for everyday testers. Keep purchase/restore/expiry tests on separate dedicated accounts: test subscriptions renew much faster than real subscriptions and are inconvenient for a two-week usability test. Our webhook stores one Pro row per user; overlapping promotional and store events need reconciliation, so do not add a gift to an account already running billing tests. Do not promise permanent free access or an automatic annual trial after beta participation.

## Recruitment and joining

1. Publish the prepared `/beta` page and verify its email draft on a phone. It uses the existing support mailbox, with an explicit send step; it is not a hosted signup database. No request is received until the person sends the email. Confirm the mailbox is monitored before advertising.
2. Use the draft in [recruitment copy](../marketing/early-tester-copy-2026-09-14.md). Start with owned channels and relevant communities where invitations are allowed. Paid ads require a chosen budget and audience; none have been placed. Market early access, not a public launch.
3. Keep a private roster using `early-tester-roster-template.csv` outside git. Record contact email, phone platform/model, Google Account used for Play, app account UUID after registration, invitation/opt-in/install dates, Pro activation/expiry and feedback follow-up. Collect no passwords or payment details. The Android Google Account can use a non-Gmail email address.
4. In Play Console, confirm the account's production-access gate. Configure the **closed** test with the approved build and countries, the tester email list, and feedback email `cork_and_note@yahoo.com`. Finish required app-content/reviewer fields and release review. A current internal tester must opt out of internal testing before joining the closed test; confirm they are actually on the closed track.
5. Send the actual closed-test opt-in link to eligible participants after availability. They must accept with the allowed Google Account and install from Google Play. Being on our email list or internal track does not start their closed-test clock. Do not fabricate a public or opt-in URL.
6. Aim for 15–20 to allow dropouts, and verify at least 12 continuously opted in for 14 days before applying for production access. Have people use the app on several days and give feedback; an idle install is poor testing evidence. There is no Google rule requiring a tasting every day. Plan tasks that require no alcohol purchase or consumption.
7. For iPhone volunteers, use an external TestFlight group and a build cleared for external testing. Nick's own TestFlight access does not prove external readiness. External beta review is separate from the public App Store release.

A signup is not an opt-in. For a fixed cohort of 12, the earliest possible eligibility is 14 days after the last of those 12 joins, if all remain opted in. If someone leaves, recalculate with qualifying participants. Confirm the Console dashboard before applying; 14 elapsed days does not automatically approve production access. New app updates can be tested during the closed test.

## Activating complimentary Pro

1. Wait until the accepted tester has installed, registered and signed in. Confirm their app identity against their invitation; use the Supabase UUID that the app passes to RevenueCat, never an email address or an anonymous device ID as a guessed substitute.
2. In RevenueCat, open that Customer profile. Check for an existing paid/test subscription or grant. If one exists, resolve it separately instead of layering a new gift on top. A gift does not stop existing subscription charges.
3. Grant entitlement `pro` with a custom expiry exactly 30 days after activation. The supported API equivalent is `POST /v1/subscribers/{app_user_id}/entitlements/pro/promotional` with `end_time_ms`. Use a server-side secret only; never put it in the app/site.
4. Confirm RevenueCat's production `NON_RENEWING_PURCHASE`, store `PROMOTIONAL`, reaches our webhook. Verify `public.entitlements` has the right UUID, `is_pro = true`, and matching `expires_at`. Reopen the app and verify both the Pro state and a server-backed Pro tool. If a webhook is missing, investigate delivery rather than treating the badge as proof.
5. Record the dates privately and send the activation template. Do not run a store checkout to activate this gift. RevenueCat grants do not charge, auto-convert or cancel existing subscriptions.
6. At expiry, the backend checks `expires_at` even if the expiry webhook is delayed. Confirm the app also returns to Free. Do a disposable-account live grant/expiry check before the first cohort; the added automated test proves handler-to-gate behavior, not delivery from the live RevenueCat service.

No tester grants have been issued by this preparation. We do not yet have a participant roster. Complimentary access does not substitute for testing actual store purchases, or for Google's engagement requirement.

## Billing checks without accidental payment

**Nick / iPhone:** monthly TestFlight success was reported September 14. Annual, restore, expiry and server correlation remain open. Open Cork & Note through TestFlight and verify its build. Apple says purchases in TestFlight beta apps are free and do not carry over as paid App Store purchases. Annual testing is also sandbox. Because monthly has already been used in the subscription group, annual trial eligibility may differ; use a clean Sandbox Apple Account/history for the first-time trial scenario. A plan switch is not the same test as a new eligible annual subscriber.

**Android billing accounts:** add the exact purchasing Google Account under Play Console's license-testing settings **as well as** giving it access to the test track. Install using that account. Before completing a purchase, verify the test-purchase notice and select **Test card, always approves**. If a real card or no test notice appears, stop and fix the account configuration. Merely being an internal/closed tester can incur real charges. Do not enable real-payment-method testing in Play Billing Lab. Start with a dedicated non-promotional account so purchase, cancel, restore and expiry are observable.

For both platforms, record build/device, plan, eligibility, cancellation, success, restore and expiry. Correlate RevenueCat events to the correct Supabase user and a Pro-only server call. No paid production purchase is needed to enroll testers. A later production purchase is a separate, explicitly authorized real charge.

## Feedback and two-week rhythm

The existing app route is **Profile → Feedback**: ideas/rating go to `feedback`, bugs to `bug_reports`, contact messages to `contact_messages`. These database writes do not send email notifications. Monitor these tables in Supabase daily, along with `ai_response_reports`, and the support inbox. Use a private issue tracker/roster; public GitHub issues must omit user emails, account UUIDs, journal content and receipts.

- **Day 0:** verify joining/install/account/Pro; ask whether onboarding was clear.
- **Days 1–3:** log or edit one known wine, select a photo, close/reopen the app. Ask what was confusing.
- **Days 4–7:** cellar add/open, winery map/search, a scan or sommelier tool. Check one weak-network or denied-permission path. Ask what broke or took too many taps.
- **Days 8–14:** repeat useful tasks naturally and try a corrected build. Ask: “What was most useful? What frustrated you? Would you keep using it, and why?”
- **After 14 days:** verify opt-in eligibility, summarize actual feedback/fixes for Google, continue testing as needed, and apply for access. Do not treat the calendar as a release guarantee.

In-app bug reports currently contain version but not native build number; request build/device in the report text. For screenshots, use support email or native TestFlight feedback. Google closed testers can also submit private Play feedback; it does not affect public ratings. No new forum, Discord or social account is necessary for this cohort.

Owner handles participant communication and account declarations. Engineering can triage reports, reproduce/fix bugs, maintain builds, verify entitlements and prepare store submissions. No invitations, reminder emails, ads, store release or final declarations were sent/submitted during this work.

## Remaining launch gates

Recruiting solves the supply of testers. It does not resolve Android map memory/recenter issue #265, real-device acceptance, annual/restore/expiry testing, financial activation, content declarations or review. Continue iPhone readiness independently. Keep the invitation page available before a public store link exists; switch download CTAs only after the relevant store release is live.

## Official references (checked September 14, 2026)

- [Google closed-test production-access requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google track setup, opt-in and private feedback](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
- [Google license testers and purchase charges](https://developer.android.com/google/play/billing/test)
- [Apple TestFlight tester guidance and free beta purchases](https://testflight.apple.com/)
- [Apple accelerated subscription testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)
- [Apple external TestFlight invitations and review](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [RevenueCat complimentary entitlements](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-history/active-entitlements)
- [RevenueCat grant endpoint and exact expiry](https://www.revenuecat.com/docs/api-v1/entitlements)
