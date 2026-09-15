# Google Play Console: current setup and remaining checks

Updated September 14, 2026. Use the [launch checklist](../launch-readiness-2026-09-13.md) for cross-platform release acceptance, and the [saved declaration record](app-content-declarations-2026-09-14.md) for the exact Console answers.

## Saved and verified

- Package `com.nicholashorton.corkandnote`; app title **Cork & Note**.
- Current candidate: **1.0.0 (7)**. Internal release completed; closed Alpha release preview confirmed and saved for review. Version 6 is historical.
- Store descriptions, support email, icon, feature graphic and four actual Android screenshots are saved. Category is **Food & Drink**.
- Privacy: `https://cork-and-note-sigma.vercel.app/privacy`. Account deletion: `https://cork-and-note-sigma.vercel.app/delete-account`. The older non-sigma Vercel host belongs to a different deployment.
- All ten App content declarations are actioned. Reviewer login/Pro, no in-app ads, no advertising ID, adult audience, alcohol rating, government status and Data safety are saved. Financial features and Health were already actioned. Saved declarations still require Google review.
- Reviewer credentials were supplied privately and verified against the live backend. No credentials are in this repository.
- Owner-configured countries and tester selection show as complete on the Dashboard.
- This account's Dashboard explicitly requires **12 closed testers for 14 continuous days**. It showed **0 currently opted in**. Recruit 15–20 to allow for dropouts; website requests and internal testers do not start the clock.
- Android billing is wired; US base plans are $9.99/month and $59.99/year, with an eligible annual three-day trial. Real license-tester purchase/restore acceptance remains.
- Android 7 targets API 36, includes Billing Library 8.3.0, and previously passed the 16 KB native-library alignment check. Its manifest was rechecked for the advertising-ID declaration.

## Remaining release checks

The [owner's Android walkthrough](android-owner-check-2026-09-14.md) provides the internal-test installation and test-payment steps. License-tester selection and the actual internal join link were not verified in the final session; Safari stopped exposing its page controls. Earlier saved Console changes remain recorded below.

1. Verify the Play-installed Android 7 candidate on a physical device: login, photo selection, AI consent/scans, winery map/recenter, journal/cellar and optional Pro purchase/restore. Use the [device worksheet](../device-acceptance-2026-09-13.md). A closed test can collect broader feedback, but simulator success does not establish Play signing or physical-device purchase behavior.
2. The key embedded in Android 7 matches the inspected Maps Platform key. It allows the Maps Android API and currently has no Android application/certificate restriction. A missing Play signing fingerprint therefore is not an active restriction on this key. No key settings were changed; a physical Play-installed Maps test is still needed.
3. Alpha validation has no blocking errors and one missing-deobfuscation-file warning. Publishing overview has 14 changes ready for review, with managed publishing off. Review submission would allow the closed release to roll out automatically after approval; it has not been submitted.
4. After the closed release is available, copy the actual test enrollment link, use an allowed Google Account to opt in and install, then send invitations to people who requested access.
5. Android early-access signup ads can run while Google testing proceeds, provided they explain that installation comes later. The Meta signup pilot is published; both ads currently show Processing. Verify the closed-test enrollment path before sending installation invitations. See the current marketing plan for dates and budget.

No public production release or tester invitations have been made by this setup. The owner remains responsible for monitoring `cork_and_note@yahoo.com`; domain email can be configured later.
