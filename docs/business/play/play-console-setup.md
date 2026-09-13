# Google Play Console: current setup and remaining checks

Updated September 13, 2026. This replaces the obsolete September 10 instructions. Use the [launch checklist](../launch-readiness-2026-09-13.md) for the complete cross-platform release gates.

## Already saved and verified

- Package: `com.nicholashorton.corkandnote`; app title: **Cork & Note**.
- Internal track: **1.0.0 (6)**, release status `completed`. No closed-test or production release exists in the inspected tracks.
- Short/full descriptions and support contacts match [current store copy](../store-listing-2026-09-13.json).
- Icon: [512 px PNG](icon-512.png); feature graphic: [1024 × 500 PNG](feature-graphic-1024x500.png).
- Four actual Android screenshots are uploaded in order and match the SHA-256 hashes in [the screenshot manifest](screenshots-2026-09-13/manifest.json). Source images and the editable studio project are in that folder. Do not substitute the iPhone set.
- Android billing is wired. Monthly and annual base plans are active at US $9.99/month and $59.99/year. Annual `free-trial-3d` is active for eligible new subscribers. These settings still require real license-tester purchase and restore acceptance.
- The version 6 AAB targets API 36, contains Billing Library 8.3.0, passes the 16 KB ELF check for all 32 inspected 64-bit libraries, and omits microphone and broad media-read permissions.

## Verify in Play Console before review

1. **Account and payment readiness:** resolve Dashboard actions, identity verification, merchant/payment activation and intended countries. Existing subscriptions do not establish all account requirements.
2. **App access:** provide the existing reviewer account credentials from the private credential store, and verify the instructions reach all Pro features. Do not paste passwords into repository documents.
3. **App content:** review every current questionnaire. The app contains alcohol references, targets adults, has no advertising SDK, and offers digital purchases. Do not reuse the old “digital purchases: No” answer.
4. **Privacy and deletion:** verify `https://cork-and-note.vercel.app/privacy` and `https://cork-and-note.vercel.app/delete-account`; confirm the support mailbox `cork_and_note@yahoo.com` is monitored.
5. **Data safety:** reconcile the actual app and processor behavior with the current form. Review account names/email/user IDs, optional photos, journal and chat content, foreground location, RevenueCat purchase history and identifiers, and provider diagnostics/retention. AI processing includes **Gemini and Anthropic**. RevenueCat applies on Android as well as iOS. Decide service-provider exemptions from the actual terms and data flows; this document does not certify blanket “Shared: No” answers. In-app account deletion passed a live data/storage cleanup test, but provider retention must also be considered.
6. **Maps signing:** confirm the Android Maps key permits the Google Play **app-signing** certificate fingerprint, then test the Play-installed build. A locally signed APK showing maps does not prove this setting.

## Candidate acceptance and testing access

Install version 6 through the internal track with a configured tester account. Test login, photos/system picker, scans and AI consent, dense winery maps/regions/recenter, cellar and journal edits, purchases/restore and account deletion. Record the actual device, OS and build. See the main checklist for outstanding physical-device and failure-state checks.

The API did not establish tester counts or production-access approval. Check the Console's requirements for this account. Where the new-personal-account requirement applies, at least 12 testers must remain opted in continuously for 14 days before applying for production access. Internal testing does not satisfy that requirement. [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

After the candidate and declarations are ready, create/promote a closed-test release, configure the authorized tester list and collect feedback. Do not count the testing period before testers have actually joined. No tester invitations or closed-test rollout were sent during this preparation session.

## Production handoff

Confirm production access, resolve review actions, finish release acceptance and promote the tested candidate. Keep website availability and store links aligned with the actual public release. Public release has not been performed.
