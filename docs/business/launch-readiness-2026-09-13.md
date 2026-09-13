# Cork & Note: what remains before launch

**Updated September 13, 2026, after implementation and store verification.** This replaces the old launch HTML and September 10 remaining-work lists. The initial audit baseline was `78d535a`; release code is `60d5a51` (subsequent documentation/assets do not change these binaries). Engineering fixes are merged in [PR #301](https://github.com/nhorto/cork-and-note/pull/301), merge commit `179be90f9d6764d848ccffd19d748a3138604f87`.

**Assessment:** store artwork, current test builds, backend deployment and substantial release fixes are complete. Public launch still needs working authentication email, final-device/purchase acceptance, store account/declaration checks and Android production-access evidence. No public release or App Review submission has been made.

## Store screenshots and candidates: verified current state

| Item | Current state | Remaining action |
|---|---|---|
| Apple marketing images | Six processed images exactly match the final iPhone mockups, in order. Already uploaded; no duplicate upload needed. | Final visual acceptance with the candidate. |
| Android marketing images | Four new 1080 × 1920 RGB images captured from Android, composed in the studio, uploaded and read back with exact ordered SHA-256 matches. | Complete. |
| Apple candidate | **1.0.0 build 25**, uploaded to TestFlight and processed **VALID**. Selected for the version 1.0 draft, still `PREPARE_FOR_SUBMISSION` with **MANUAL** release. | Test on iPhone and complete purchase/restore acceptance before review. |
| Google candidate | **1.0.0 versionCode 6**, signed AAB uploaded and committed to **internal** testing; readback shows release `completed`. | Test the Play-installed candidate, including Maps signing and billing. |
| Store descriptions | Apple description and Google short/full descriptions saved and verified. Google support contacts, icon and feature graphic are saved. | Finish Console policy/account forms. |
| Website | Cross-platform availability, billing and fair-use corrections deployed; homepage and terms verified live at `https://cork-and-note.vercel.app`. | Add working public store links as each release becomes available. |

Google `alpha`, `beta` and `production` tracks contain no releases. Internal testing is not a public launch or proof of closed-test eligibility. Apple draft selection is not App Review approval.

Artwork and editable project: [Android screenshot folder](play/screenshots-2026-09-13/README.md), [checksum manifest](play/screenshots-2026-09-13/manifest.json). Download copies: `~/Downloads/Cork-and-Note-Google-Play-Final-Slides/` and its ZIP. The iPhone set remains in `~/Downloads/Cork-and-Note-AppStore-Final-Slides/`.

Candidate archives are preserved in `~/Downloads/Cork-and-Note-Launch-Candidates/`. [Android EAS build](https://expo.dev/accounts/nick5757/projects/cork-and-note/builds/af19132e-43bf-4104-aaee-5c7a576fc977); [successful iOS TestFlight submission](https://expo.dev/accounts/nick5757/projects/cork-and-note/submissions/e724d56e-f47b-4b67-b757-5531f8d27533).

## Engineering and backend work completed

- [x] Integrated the cellar-origin correction; applied migration/backfill (zero existing rows required changes). Existing journal entries remain intact.
- [x] Integrated Android marker rendering improvements, preserving current labels, directory previews and closed badges. This is not yet proof that the dense-map ANR/OOM issue is resolved.
- [x] Fixed incorrect winery enrichment with strict name, valid-coordinate and distance guards. Uncertain or neighboring matches are omitted; regression coverage passes.
- [x] Configured the existing Gemini credential and verified generation. Deployed `chat`, `places`, `routes` and `revenuecat-webhook` to the correct production project.
- [x] Verified all **37 migrations** and live backend parity. Live chat, guarded Places lookup, Gemini tasting-menu and wine-list scans succeed.
- [x] Verified reviewer login and server-side Pro. Live security/deletion checks found no cross-account reads or self-granted Pro; both disposable accounts and their rows/storage were removed.
- [x] Removed unused camera/image/media-library native packages, applied Expo 53 compatible patch updates and moved Android photo selection to the system picker without broad media permission. Removed microphone permission; preserved actual camera use through ImagePicker.
- [x] Verified the actual Android 6 AAB: bundletool validation passes, **32/32 64-bit native libraries pass 16 KB ELF alignment checks**, target API **36**, Billing Library **8.3.0**, and no microphone or broad `READ_MEDIA_*` permissions. Added a repeatable artifact checker at `scripts/verify-android-native.py`.
- [x] Built the signed iOS 25 archive locally after cloud quota was exhausted: **Xcode 26.6 / iOS SDK 26.5**, iPhone-only, minimum iOS 15.1, **15 privacy manifests**, no microphone usage declaration. Apple processed the upload successfully.
- [x] Verification: **1,026 Jest tests across 74 suites**, **82 Deno tests**, lint zero errors/44 existing warnings, Expo dependency check, website build and whitespace checks pass. [PR #301 CI passed](https://github.com/nhorto/cork-and-note/actions/runs/34765569712).

**Candidate exclusions:** Android build 5 failed native compatibility checks and was not uploaded. Canceled local iOS build 24 is not a candidate. Optional map/sommelier redesigns and new badges remain outside this release scope.

**Backend compatibility:** deployed scans require AI sharing consent version 2. Older installed builds may require an update/re-consent. Test current 25/6 candidates against the current backend.

## Acceptance evidence and unresolved engineering checks

Observed emulator checks include journal/cellar/sommelier navigation, seeded reviewer Pro access, AI-consent decline and subsequent opt-in, and a successful refreshed taste report. The Android release-derived APK cold-starts, correctly blocks the underage path and renders the map. Its “Choose from library” action opens Android’s system photo picker with the explicit “only have access to the photos you select” message, without a broad-library permission prompt. These are bounded checks, not full acceptance.

The emulator APK was derived from the exact version 6 AAB but locally signed for installation. It does **not** establish Google Play app-signing Maps access or real store purchases. Screenshots came from the development client at the same release-code baseline; they are marketing assets, not proof of release-binary QA. No physical iPhone or Android acceptance was completed in this session.

- [ ] **Engineering/testers: close Android map stability [#265](https://github.com/nhorto/cork-and-note/issues/265).** Run cold map open, sustained dense Napa pan/zoom and clustering, AVA toggle and recenter on the release candidate, both emulator and physical device. Record crashes/ANRs/memory and responsiveness. Marker improvements are integrated; the original stability report remains open until acceptance passes.
- [ ] **Engineering: resolve/verify failure-state observations.** A transient taste-data request timed out and briefly displayed “0 of 5 rated wines” rather than explaining a load failure; later direct reads and retry succeeded with the existing data intact. Also reconcile the settings AI-provider explanation with the current Gemini scan path (the consent dialog already names both providers). These observations are not claimed fixed in builds 25/6; any code change requires refreshed candidates before public release.
- [ ] **Engineering/testers: complete the same journey on both store-installed candidates.** Fresh signup/login/reset; age gate; log/edit tasting and photo; relaunch; label/card/list scans; cellar add/open; journal search; winery discovery/directions; AI consent decline/revoke; Free limits and Pro tools; AI reporting; deletion. Exercise denied permissions, offline/recovery, Android back/keyboard, small screens and dark mode. Record device, OS, build and result.
- [ ] **Engineering + store testers: verify real subscription behavior.** Monthly, annual, eligible trial and returning-customer pricing; purchase cancellation; restore after reinstall; account switching; expiry/refund and loss of Pro. Confirm each RevenueCat event updates the correct Supabase entitlement and permits a real server-backed Pro request. Configured products and webhook TEST pings are insufficient.

## Authentication email: the shared operational blocker

- [ ] **Owner + engineering: configure a verified Cork & Note transactional sender.** Live SMTP host is unset, email hook disabled, default email limit 2/hour and signup auto-confirmation enabled. Auto-confirmation does not solve password recovery. The accessible email-provider account only has an unrelated staging domain; it was not repurposed. A verified sender/domain and provider configuration are needed before this can be completed safely.
- [ ] Install the branded templates, set an appropriate sending limit and deliberately choose whether signup requires email verification. Prove reset delivery to an authorized non-team test mailbox and complete the reset deep link on both candidates. The default Supabase sender is unsuitable for production. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)

## Store account, policy and review handoff

- [ ] **Owner: confirm financial activation.** Apple Paid Apps Agreement, tax and banking Active; Google merchant/payment readiness. APIs used here did not establish these dashboard states.
- [ ] **Owner + engineering: review actual privacy/content declarations.** Include RevenueCat purchase history/identifiers, photos, journal/chat context, Gemini and Anthropic processing, location and relevant Google services. Verify Apple App Privacy and current age questionnaire, Google Data safety, adult audience, IARC **digital purchases**, ads, app access and deletion URL. Do not copy the obsolete “Android billing unavailable / purchase history No” answers; the [Play guide](play/play-console-setup.md) now replaces those instructions.
- [ ] **Owner: confirm territories, price, subscription availability, age suitability and applicable trader/identity declarations.** A Virginia marketing focus does not establish storefront territory choices.
- [ ] **Owner: verify the support mailbox and response process.** Support/deletion-request handling and a routine for AI reports need an accountable operator. Reviewer login/Pro are verified; Google Console app-access instructions still need confirmation.
- [ ] **Apple operator: complete candidate acceptance, attach first subscriptions/group as required and submit for App Review.** Both subscription products were `READY_TO_SUBMIT` with processed review images; they are not approved yet. Build 25 is selected in the draft. Preserve manual release for launch coordination.

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
2. Finish physical-device, failure-state, dense-map and real billing acceptance on the exact candidates. Rebuild if code changes.
3. Complete both stores' declarations/reviewer access and submit iPhone when its gates pass; finish Android testing/access independently.
4. Release, verify public installs and turn on working website/download links.

**Evidence and limits:** initial store observations are preserved in `docs/audits/2026-09-13-store-evidence.json`; final sanitized candidate/store evidence is in `docs/audits/2026-09-13-launch-implementation.json`. Inspection edits were deleted; committed Google listing changes follow Google's normal review flow. No public app release, real purchase, fresh email delivery, physical-device certification, financial-account sign-off or final policy declaration was performed. Credentials and demo sessions remain outside committed documents.
