# Cork & Note — early access and launch game plan

Updated September 14, 2026. This is the current campaign direction. It supersedes the earlier blanket 30-day Pro gift and the earlier proposal to spend $240 immediately on a public iPhone launch campaign.

## Offer and sequence

The journal stays free; Pro is optional. Android closed-test users may buy Pro once actual billing is verified. iPhone TestFlight purchases are free test transactions and generate no revenue. A small separately selected feature-testing cohort can receive complimentary Pro later; no general gift is promised.

1. Make the website signup work and verify storage. The current production destination is `https://cork-and-note-sigma.vercel.app/beta`. It accepts Android testing, iPhone TestFlight requests, or launch notifications. It does not automatically enroll anyone in a store test.
2. Prepare the Google Play closed test with the release candidate, applicable account declarations, tester access and an actual opt-in link. Recruit 15–20 Android participants. Where the account's requirement applies, at least 12 must remain opted in continuously for 14 days before applying for production access; collect real usage and feedback.
3. Run the $75 Android early-access signup pilot while Android acceptance and Google review proceed separately. The ad and signup form explicitly explain that installation instructions will come later when access is ready. A working signup and private roster are required; the closed-test join link is required before installation invitations, not before collecting requests. Review saved requests, actual opt-ins, installs and participation. Pause recruitment when the cohort is sufficient.
4. Continue external TestFlight readiness and public iPhone release work independently. The Android testing calendar does not hold up iPhone submission.
5. Use the remaining campaign concepts for a separate iPhone/TestFlight, launch-notification or public-install campaign once its destination is selected and verified. Keep each offer explicit; TestFlight, a waitlist and a public store are different destinations.

## Budget

- $300 maximum planned monthly media allocation.
- $75 total for the initial Android recruitment pilot; proposed five-day run, averaging $15/day. Use a lifetime budget, not an indefinitely recurring $15 daily budget. The initial signup pilot is scheduled September 14–19, 2026, 5 p.m. EDT, subject to Meta review.
- $225 reserved within the same month for further recruitment that proves useful or the next iPhone/public-launch round. It is not an additional monthly allowance or authority to run every concept simultaneously.
- The two-ad signup pilot is published and enabled, with Meta currently showing Processing. Installation invitations still require a working closed-test enrollment path. Keep the $75 lifetime budget and $225 reserve separate.

## Creative and destination

The September 13 **Expanded Campaign** is the latest broad collection and the approved visual starting point. **Revised Ads** is an earlier round. Preserve both; use the new **Early Access Campaign** folder for this Android adaptation.

Current shortlist:

| Ad | Hook | Destination |
| --- | --- | --- |
| 01 / Journal | Loved the wine. Keep the name. | `/beta?platform=Android` plus campaign labels |
| 02 / Sommelier | A sommelier that grows with you. | `/beta?platform=Android` plus distinct creative labels |

CTA: Get early access. Support: Android early access · Free journal · Optional Pro. Use actual Android screenshots with their natural proportions, straight and uncropped, without an invented or tilted phone frame. The photographs carry forward from the Expanded Campaign. Android journal and sommelier captures come from `docs/business/play/screenshots-2026-09-13/cork-note-android-project.json`; these are documented demo captures, not customer testimonials.

Editable gallery, four placement PNGs, exact copy/links, and Facebook Page artwork are in `~/Downloads/Cork-and-Note-Early-Access-Campaign/`. First review the feed pair; the Story versions remain available for placement previews. Confirm actual Meta cropping before launch.

The other eight concepts remain available. Prioritize one additional message at a time after learning from the first pair. iPhone ads must use iPhone captures and their actual TestFlight, signup or public-store destination.

## Signup operations

Requests are private in Supabase project `ixecayqpogkiawempzgc`, table `early_access_requests`. Only the server can insert/read them; app users and anonymous clients cannot access the roster. The website saves email, platform, testing versus launch preference, consent, Android commitment, and allowlisted campaign labels. It does not create app accounts, make purchases, grant Pro, or send invitations.

Use Supabase Table Editor or `node scripts/export-early-access.mjs` to review requests. Keep exported contact files outside git. Send the correct installation instructions only after access is available, track actual opt-ins privately, and collect feedback. Signup confirmation on the website means saved, not that an email has already been sent. Automatic notification emails and ongoing unattended monitoring are not configured.

Support remains `cork_and_note@yahoo.com`. The owner can change to a branded address later. Existing Cloudflare/Resend password-reset sender configuration does not establish a monitored human inbox.

## Account work

- Meta account observed: `33903429639272752`, Nicholas Horton. Cork & Note Page is visible to the account. Initial account overview had no active campaigns and $0 spent in the last seven days.
- The owner completed card verification. The existing verified Facebook profile phone number was then added to the ad account, satisfying Meta’s separate phone requirement. Campaign, ad set and both ads are now published; both ads are ON and show Processing. The campaign is prepared through a dedicated signed-in Chrome session; no Facebook password or login code is stored in the project.
- Google Play: Android 7 is on internal testing and the Alpha release preview has now been confirmed. Console showed zero blocking release-validation errors and one warning about a missing deobfuscation file. All ten app-content declarations are actioned; Food & Drink category and correct live privacy/contact URLs are saved. Publishing overview contains **14 changes ready for review**, including the Alpha release, US availability, the owner's tester email list and feedback inbox. Review has not been submitted; managed publishing is off, so approval would automatically roll out the closed release. Physical Play-installed device and billing acceptance remain. The Dashboard explicitly requires **12 testers for 14 continuous days**, with **0 opted in**. See [the declaration record](../business/play/app-content-declarations-2026-09-14.md). No invitations have been sent.
- Verify external TestFlight availability before offering immediate iPhone installation. TestFlight sandbox purchases do not carry over to paid App Store subscriptions.

## Measurement

Website campaign labels identify saved signups by creative and feed/story variant. They do not prove a store install. The Meta Traffic draft currently uses the account's available **Maximize number of landing page views** goal. Report Meta's delivery metrics separately from saved requests, actual Play opt-ins, installs and engaged testers. No Meta Pixel or conversion API event has been installed by this work.

## Saved Meta draft

- Account: `33903429639272752`; Facebook identity Cork & Note, Instagram identity uses the Facebook Page.
- Campaign: `120254021223890120`, `CN | Android early access | US 21+ | $75 pilot`.
- Ad set: `120254021223910120`, `US 21+ | Android testers | Website`.
- Journal ad: `120254021223900120`; sommelier ad: `120254021557820120`.
- Budget: $75 lifetime at campaign level, shared by the two ads.
- Published schedule: September 14, 2026, 6:41 p.m. EDT through September 19, 2026, 7 p.m. EDT. End time was adjusted after verification; both dates were checked in Review. Actual delivery depends on Meta processing and approval.
- Audience controls: United States, minimum age 21, Android mobile devices only. Facebook Feed, Instagram feed, Facebook Stories and Instagram Stories. Excluded-placement spending is disabled.
- Each ad uses a 1080 × 1350 feed image and a separate 1080 × 1920 story image with an actual app screenshot. Each variant links to the working Android signup page with its own campaign label. CTA is **Learn more**, an available option in this account.
- Automatic image generation, creative enhancements, text improvements, flex media and essential enhancements are disabled. Multi-advertiser ads and website highlights are off.
- Campaign, ad set and both ads are published. Both ads are ON and show Processing. Today’s reporting showed $0 spent and no impressions at the check. See `docs/audits/2026-09-14-meta-pilot-published.json` for current state; the earlier draft and blocked-submission audits are historical. Both revised ads were checked in four-placement previews.

## Remaining owner/device work

The signed-in Safari session can be operated through accessibility; changing its JavaScript automation setting is no longer needed for this setup. App-content forms and reviewer credentials have been handled.

1. Install Android 7 from the existing internal test using the intended Google Play account. Check sign-in, map/recenter, photo selection and the free journal. For purchase/restore testing, use an account configured as a license tester and confirm Google's test-payment notice before checkout.
2. Review the prepared Alpha release and declarations in Publishing overview. The next submission includes 14 saved changes and will make the closed test available after approval because managed publishing is off. Public production access remains separate.
3. After Google approval, verify the actual closed-test join link with an allowed account before sending installation invitations. Paid signup recruitment can proceed in parallel. Internal testers must leave the internal track before joining the closed test.
4. Monitor the Yahoo inbox and private signup/feedback roster. The [invitation and follow-up drafts](android-tester-invitation-templates-2026-09-14.md) are ready; no automatic emails or ongoing monitoring are configured.
5. Meta payment and phone verification are complete, and the two ads are published. Check processing/review and actual delivery next; no new owner verification step is currently shown. The $75 lifetime pilot collects early-access requests; it does not promise immediate enrollment or installs. The other campaign concepts and $225 reserve remain available for the next round.

## Official references

- [Google closed-test requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google test-track and billing-test distinction](https://developer.android.com/google/play/billing/test)
- [Apple TestFlight purchases and invitations](https://testflight.apple.com/)

## September 14 signup-pilot decision

The owner asked to move Meta advertising forward after adding payment. Payment is now visible in Meta. Android physical-device acceptance remains a Google release check, not a blocker for an accurately described early-access signup campaign. Both ad texts and the live form explain that installation instructions arrive when access is ready. The pilot remains $75 lifetime, US 21+, Android only; the $225 reserve is unchanged. Current publication status is recorded in the Meta audit/handoff after submission.

Publication result: the earlier payment and phone blocks are resolved. Both ads were published successfully and show Processing. The existing verified profile number satisfied the phone requirement; no new code was needed.

## Pilot scorecard

Run `node scripts/report-ad-pilot.mjs` to refresh the aggregate report in the Downloads campaign folder as `PILOT-SCORECARD.md`. Add `--spend 25.00` only with actual cumulative spend for this pilot from Meta. The report separates creative labels, eligible Android testing requests, requests awaiting invitation and withdrawals. It does not retrieve contact details or infer installations. The live baseline is zero pilot-tagged requests. Meta delivery data and Google opt-in/participation must be checked separately; the report does not run automatically.

## Confidence audit and correction

Both ads showed Active before this audit, with $0 reported spend and zero pilot signup requests. The audit found that the minimum Android version was still 1.0. Release build 7 requires Android 7.0 (minSdkVersion 24), so the targeting minimum was changed to **7.0 Nougat** and published. Meta confirmed one ad set updated; the updated ad set showed Processing. Budget, end time, country, age and creatives were unchanged.

The pilot still optimizes landing page views, not completed tester requests. Requests are measurable in the private database but no completed-signup event is sent to Meta. The setup has no demonstrated acquisition cost or tester quality yet. Prioritize signup-event tracking and evaluate a Leads-objective configuration before allocating the $225 reserve. This audit does not claim the current campaign is the best-performing configuration.
