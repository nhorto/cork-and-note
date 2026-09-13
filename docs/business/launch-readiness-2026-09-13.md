# Cork & Note: what remains before launch

**Updated September 13, 2026, after fresh candidates and password-recovery verification.** Current mobile release code is merged main **`c9d3e78`**, integrating all seven PRs through [#303](https://github.com/nhorto/cork-and-note/pull/303). [#304](https://github.com/nhorto/cork-and-note/pull/304) adds email preparation and a live website reset page; it does not change mobile app source.

**Assessment:** **iOS 27** is valid in TestFlight and selected in the manual-release draft; **Android 7** is committed to internal testing. They replace the earlier 25/6 candidates and include the merged redesign/badge/failure-state fixes. Password-recovery protocol tests pass, but actual email delivery remains blocked on an approved sending domain/provider. Physical-device/purchase acceptance, store account/declaration checks and Android production access remain. No App Review submission or public release has been made.

## PR integration and current candidates

[Integration PR #303](https://github.com/nhorto/cork-and-note/pull/303) brings together all seven previously open PRs with their original commits and stack ancestry preserved: **#298 → #291 → #289 → #290 → #292 → #299 → #300**. Child PR bases are explicitly retargeted to main for integration; no original branch is force-pushed or squashed. The already integrated cellar/marker fixes are preserved, and the map conflict resolution retains Android StableMarker snapshots while using the new fan-out coordinates.

- Badge review fixes reject failed journal/cellar reads, exclude gifted/sold/spoiled/sample events from opened-bottle awards, and keep optional badge work from delaying Home.
- Taste data failures now show retry controls and preserve saved reports without false zero counts or missing-evidence claims. Settings names Google Gemini for scans and Anthropic for chat.
- All **40 migrations** are applied to **`ixecayqpogkiawempzgc`**. The three new migrations add message sources, the badge ledger and its deletion step. All five functions were deployed from the integration source. Backend parity passes, including new schema probes and full merge-history inspection.
- Live ordinary chat and the backend streaming endpoint return HTTP 200; streaming produced incremental deltas and a terminal completion. **The client still uses non-streaming chat**, as the reviewed PR intends.
- The live security/deletion probe includes achievements: no cross-account reads/updates/deletes or self-granted Pro; both disposable accounts and all their rows/storage were removed.
- Combined local validation: **1,168 Jest tests / 85 suites**, **84 Deno tests**, lint **0 errors / 44 warnings**. Focused map validation also covers Android cluster expansion into separate coordinates and bounded redraw pulses. Final GitHub checks are attached to PR #303.

**Required next step:** perform acceptance on **iOS 27 / Android 7**, including the redesigned Home/Sommelier, badges and follow-up fixes. Recheck marketing screenshots against the updated UI. The earlier 25/6 archives remain historical only. [Integration evidence](../audits/2026-09-13-pr-integration.json); [current candidate/auth evidence](../audits/2026-09-13-candidates-and-auth.json).

## Store screenshots and candidates: verified current state

| Item | Current state | Remaining action |
|---|---|---|
| Apple marketing images | Six processed images exactly match the final iPhone mockups, in order. Already uploaded; no duplicate upload needed. | Final visual acceptance with the candidate. |
| Android marketing images | Four new 1080 × 1920 RGB images captured from Android, composed in the studio, uploaded and read back with exact ordered SHA-256 matches. | Review against the redesigned candidate UI. |
| Apple candidate | **1.0.0 build 27**, uploaded to TestFlight and processed **VALID**. Selected for the version 1.0 draft, still `PREPARE_FOR_SUBMISSION` with **MANUAL** release. | Test on iPhone and complete purchase/restore acceptance before review. |
| Google candidate | **1.0.0 versionCode 7**, signed AAB uploaded and committed to **internal** testing; readback shows release `completed`. | Test the Play-installed candidate, including Maps signing and billing. |
| Store descriptions | Apple description and Google short/full descriptions saved and verified. Google support contacts, icon and feature graphic are saved. | Finish Console policy/account forms. |
| Website | Cross-platform availability, billing and fair-use corrections deployed; homepage and terms verified live at `https://cork-and-note.vercel.app`. | Add working public store links as each release becomes available. |

Google `alpha`, `beta` and `production` tracks contain no releases. Internal testing is not a public launch or proof of closed-test eligibility. Apple draft selection is not App Review approval.

Artwork and editable project: [Android screenshot folder](play/screenshots-2026-09-13/README.md), [checksum manifest](play/screenshots-2026-09-13/manifest.json). Download copies: `~/Downloads/Cork-and-Note-Google-Play-Final-Slides/` and its ZIP. The iPhone set remains in `~/Downloads/Cork-and-Note-AppStore-Final-Slides/`.

Candidate archives are preserved in `~/Downloads/Cork-and-Note-Launch-Candidates/`. [Android EAS build](https://expo.dev/accounts/nick5757/projects/cork-and-note/builds/4990e78f-9935-4ad4-8686-dc9065727624); [successful iOS TestFlight submission](https://expo.dev/accounts/nick5757/projects/cork-and-note/submissions/a4078587-d456-41c6-bbef-f2ad028e9716).

## Engineering and backend work completed

- [x] Integrated the cellar-origin correction; applied migration/backfill (zero existing rows required changes). Existing journal entries remain intact.
- [x] Integrated Android marker rendering improvements, preserving current labels, directory previews and closed badges. This is not yet proof that the dense-map ANR/OOM issue is resolved.
- [x] Fixed incorrect winery enrichment with strict name, valid-coordinate and distance guards. Uncertain or neighboring matches are omitted; regression coverage passes.
- [x] Configured the existing Gemini credential and verified generation. Deployed `chat`, `places`, `routes` and `revenuecat-webhook` to the correct production project.
- [x] Verified all **40 migrations** and live backend parity. Live chat, guarded Places lookup, Gemini tasting-menu and wine-list scans succeed.
- [x] Verified reviewer login and server-side Pro. Live security/deletion checks found no cross-account reads or self-granted Pro; both disposable accounts and their rows/storage were removed.
- [x] Removed unused camera/image/media-library native packages, applied Expo 53 compatible patch updates and moved Android photo selection to the system picker without broad media permission. Removed microphone permission; preserved actual camera use through ImagePicker.
- [x] Verified the actual Android 7 AAB: bundletool validation passes, **32/32 64-bit native libraries pass 16 KB ELF alignment checks**, target API **36**, Billing Library **8.3.0**, and no microphone or broad `READ_MEDIA_*` permissions. Added a repeatable artifact checker at `scripts/verify-android-native.py`.
- [x] Built the signed iOS 27 archive locally after cloud quota was exhausted: **Xcode 26.6 / iOS SDK 26.5**, iPhone-only, minimum iOS 15.1, **15 privacy manifests**, no microphone usage declaration. Apple processed the upload successfully.
- [x] Earlier PR #301 verification: **1,026 Jest tests across 74 suites**, **82 Deno tests**, lint zero errors/44 existing warnings, Expo dependency check, website build and whitespace checks pass. [PR #301 CI passed](https://github.com/nhorto/cork-and-note/actions/runs/34765569712).

**Candidate exclusions:** Android 5 failed native checks; canceled iOS 24 and quota-blocked iOS 26 are not candidates. Builds 25/6 are superseded by 27/7. The new binaries include the full PR integration.

**Backend compatibility:** deployed scans require AI sharing consent version 2. Older installed builds may require an update/re-consent. Test current 27/7 candidates against the current backend.

## Acceptance evidence and unresolved engineering checks

**Android 7 smoke:** the exact AAB was converted to a universal APK and signed with a temporary local test key. Version 7 installs and cold-starts on the dedicated emulator, displays the age gate, and routes an invalid recovery deep link to “Link expired”; no crash-buffer entry was observed. This does not establish Google Play app-signing Maps access, real purchases, or physical-device stability.

Earlier candidate emulator checks include journal/cellar/sommelier navigation, seeded reviewer Pro access, AI-consent decline and subsequent opt-in, and a successful refreshed taste report. The Android release-derived APK cold-starts, correctly blocks the underage path and renders the map. Its “Choose from library” action opens Android’s system photo picker with the explicit “only have access to the photos you select” message, without a broad-library permission prompt. These are bounded checks, not full acceptance.

The emulator APK was derived from the exact version 6 AAB but locally signed for installation. It does **not** establish Google Play app-signing Maps access or real store purchases. Screenshots came from the development client at the same release-code baseline; they are marketing assets, not proof of release-binary QA. No physical iPhone or Android acceptance was completed in this session.

- [ ] **Engineering/testers: close Android map stability [#265](https://github.com/nhorto/cork-and-note/issues/265).** Run cold map open, sustained dense Napa pan/zoom and clustering, AVA toggle and recenter on the release candidate, both emulator and physical device. Record crashes/ANRs/memory and responsiveness. Marker improvements are integrated; the original stability report remains open until acceptance passes.
- [x] **Engineering: fix failure-state observations in source.** Taste reads now show retryable failures and preserve saved reports; settings provider copy matches Gemini scans and Anthropic chat. Regression tests pass. These fixes still require refreshed store candidates and device acceptance.
- [ ] **Engineering/testers: complete the same journey on both store-installed candidates.** Fresh signup/login/reset; age gate; log/edit tasting and photo; relaunch; label/card/list scans; cellar add/open; journal search; winery discovery/directions; AI consent decline/revoke; Free limits and Pro tools; AI reporting; deletion. Exercise denied permissions, offline/recovery, Android back/keyboard, small screens and dark mode. Record device, OS, build and result.
- [ ] **Engineering + store testers: verify real subscription behavior.** Monthly, annual, eligible trial and returning-customer pricing; purchase cancellation; restore after reinstall; account switching; expiry/refund and loss of Pro. Confirm each RevenueCat event updates the correct Supabase entitlement and permits a real server-backed Pro request. Configured products and webhook TEST pings are insufficient.

## Authentication email: the shared operational blocker

- [x] **Recovery protocol verified live with a disposable account.** Correct mobile redirect/session, replacement password accepted, old password rejected, consumed link refused, untrusted redirect rejected, and account/profile cleanup verified. This sends no email and does not certify OS link dispatch.
- [x] **Reset website fallback and templates prepared.** `https://cork-and-note.vercel.app/reset-password` is live with an explicit app handoff and expired-link guidance; the Android/iPhone recovery template is ready. 1,175 tests / 86 suites and main CI pass. [Setup and remaining sender steps](auth-email-setup.md).
- [ ] **Publish templates after SMTP is ready.** Supabase rejected the attempted template update with HTTP 400 because the project uses the default sender. No template change was applied. Previews are in `~/Downloads/Cork-and-Note-Auth-Emails/`.

- [ ] **Owner + engineering: configure a verified Cork & Note transactional sender.** Live SMTP host is unset, email hook disabled, default email limit 2/hour and signup auto-confirmation enabled. Auto-confirmation does not solve password recovery. The accessible email-provider account only has an unrelated staging domain; it was not repurposed. The owner confirmed no domain is owned yet and prefers Cloudflare. Its available session lacks Registrar access; the automated dashboard requires a security check. A verified sender/domain and provider configuration are still required; no domain has been purchased.
- [ ] Install the branded templates, set an appropriate sending limit and deliberately choose whether signup requires email verification. Prove reset delivery to an authorized non-team test mailbox and complete the reset deep link on both candidates. The default Supabase sender is unsuitable for production. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)

## Store account, policy and review handoff

- [ ] **Owner: confirm financial activation.** Apple Paid Apps Agreement, tax and banking Active; Google merchant/payment readiness. APIs used here did not establish these dashboard states.
- [ ] **Owner + engineering: review actual privacy/content declarations.** Include RevenueCat purchase history/identifiers, photos, journal/chat context, Gemini and Anthropic processing, location and relevant Google services. Verify Apple App Privacy and current age questionnaire, Google Data safety, adult audience, IARC **digital purchases**, ads, app access and deletion URL. Do not copy the obsolete “Android billing unavailable / purchase history No” answers; the [Play guide](play/play-console-setup.md) now replaces those instructions.
- [ ] **Owner: confirm territories, price, subscription availability, age suitability and applicable trader/identity declarations.** A Virginia marketing focus does not establish storefront territory choices.
- [ ] **Owner: verify the support mailbox and response process.** Support/deletion-request handling and a routine for AI reports need an accountable operator. Reviewer login/Pro are verified; Google Console app-access instructions still need confirmation.
- [ ] **Apple operator: complete candidate acceptance, attach first subscriptions/group as required and submit for App Review.** Both subscription products were `READY_TO_SUBMIT` with processed review images; they are not approved yet. Build 27 is selected in the draft. Preserve manual release for launch coordination.

## Android's testing calendar

- [ ] **Owner: check this account's production-access requirements and recruit authorized closed testers.** No closed-test release or tester-count evidence was found. Where the new personal-account requirement applies, at least **12 testers must remain opted in continuously for 14 days**, followed by a production-access application. Internal testing does not satisfy this requirement. [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [ ] **Engineering + owner: start the approved closed-test release after candidate/content readiness**, collect feedback and retain fixes/test evidence. No tester invitations or closed-test rollout were sent during this preparation.
- [ ] **Owner: apply for production access when eligible**, then submit the production release. Access approval and release approval are separate gates.

There is no verified Android launch date until account requirements and actual tester opt-in dates are known. iPhone can proceed independently if simultaneous release is not required.

## Before public announcement

- [ ] Confirm backend plan/backups, auth/purchase/function-error monitoring and budgets/alerts for Gemini, Anthropic and Google APIs. There is no dedicated crash-reporting SDK in the repository; establish a practical store crash/ANR and server-error monitoring routine.
- [ ] Add public store links and verify fresh public installs after approval/release: signup, Maps, scans and an authorized purchase/restore with production server-side Pro.
- [ ] Prepare support coverage, working QR/download destinations and first-week monitoring of activation, purchase failures, AI spend and support requests. Optional badges, partnerships and broad advertising can follow launch.

## Next actions in order

1. Obtain a verified transactional sender and confirm store financial/account actions; organize Android closed testers.
2. Review screenshots against the new UI and finish physical-device, failure-state, badge, dense-map and real billing acceptance on iOS 27 / Android 7. Rebuild only if further mobile code changes are required.
3. Complete both stores' declarations/reviewer access and submit iPhone when its gates pass; finish Android testing/access independently.
4. Release, verify public installs and turn on working website/download links.

**Evidence and limits:** initial store observations are preserved in `docs/audits/2026-09-13-store-evidence.json`; final sanitized candidate/store evidence is in `docs/audits/2026-09-13-launch-implementation.json`. Inspection edits were deleted; committed Google listing changes follow Google's normal review flow. No public app release, real purchase, fresh email delivery, physical-device certification, financial-account sign-off or final policy declaration was performed. Credentials and demo sessions remain outside committed documents.
