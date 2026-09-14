# Cork & Note device acceptance

Use **iOS 1.0.0 (27)** from TestFlight and **Android 1.0.0 (7)** installed through Google Play internal testing. Run each row on both platforms. A locally signed Android APK cannot establish Play signing or real store billing behavior.

**Owner update, September 14:** Nick reports a successful monthly purchase in the TestFlight app. Annual has not been tested. Installed build, device/OS, cancellation path and RevenueCat/backend correlation were not provided; this is useful partial evidence, not completion of the full purchase row.

Record device model, OS, build, install source, date and tester initials. Mark PASS / FAIL / NOT RUN, with a short reproduction and screenshot for failures. Never include passwords, recovery URLs, access tokens or full purchase receipts in shared evidence.

| Journey | Expected result | iPhone | Android |
|---|---|---|---|
| Fresh signup/login | Age gate and registration complete; sign out/in preserves account data. | NOT RUN | NOT RUN |
| Reset with app closed | Request a fresh reset; inspect inbox/spam; tap the newest email with app fully closed. Correct account reaches password entry. New password signs in; old password fails. | NOT RUN | NOT RUN |
| Reset with app open | Request a separate fresh link. App routes correctly while running. Reusing the consumed link shows an expired/invalid state and a way to request another. | NOT RUN | NOT RUN |
| Journal and cellar | Add a test tasting/photo; edit, relaunch and search. Add/open a cellar bottle; counts and journal entry agree. | NOT RUN | NOT RUN |
| Home and badges | Existing data loads; empty states are sensible; badge detail opens; failures offer retry without inventing zero counts. | NOT RUN | NOT RUN |
| Camera and library | Deny permission, recover, then capture/select a photo. Android uses the system picker without broad media access. | NOT RUN | NOT RUN |
| AI consent and scans | Decline sharing, then opt in explicitly. Label/menu/list scan and Sommelier work; revoke consent and verify it is respected. | NOT RUN | NOT RUN |
| Dense map | Cold-open map; search Napa; pan/zoom for at least five minutes; expand clusters, toggle wine regions and recenter repeatedly. Tiles/pins render, controls respond, no crash/ANR. | NOT RUN | NOT RUN |
| Offline and recovery | Disconnect during a read/request, then reconnect. Saved data stays intact; error and retry controls work. | NOT RUN | NOT RUN |
| Platform layout | Keyboard, small screen and dark mode remain usable; Android Back dismisses screens/keyboard correctly. | NOT RUN | NOT RUN |
| Monthly purchase | Store shows correct price/period. Cancel purchase once without granting Pro; complete an authorized sandbox/test purchase and verify server-backed Pro access. | PARTIAL: owner reports monthly success; build and backend checks pending | NOT RUN |
| Annual and trial | Correct annual price and eligible trial; returning/ineligible account is not promised an unavailable trial. | NOT RUN | NOT RUN |
| Restore and account switching | Restore after reinstall; switch app/store accounts and verify entitlements belong to the correct account. | NOT RUN | NOT RUN |
| Expiry/refund | Using the store's test controls, expire/refund a test subscription; verify the backend removes Pro and enforces Free limits. | NOT RUN | NOT RUN |
| Delete disposable account | Delete only a dedicated test account; authentication and its data disappear. Never use the shared reviewer account for this row. | NOT RUN | NOT RUN |

Use authorized store test accounts for purchases. Engineering should correlate purchase/restore/expiry results with RevenueCat events and the production Supabase entitlement; a successful payment screen alone is insufficient.

Existing evidence: real reset mail was delivered to Gmail and its actual link passed recovery/password/reuse checks with fixture cleanup. Android 7 passed installation, cold start, age gate and invalid-link smoke on an emulator. These checks do not replace the physical-device rows above.

After acceptance, use the [launch checklist](launch-readiness-2026-09-13.md) for store declarations, Android closed testing and review submission. Keep Apple release manual for launch coordination.
