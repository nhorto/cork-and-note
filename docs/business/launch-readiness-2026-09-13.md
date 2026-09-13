# Cork & Note: what remains before launch

**Checked September 13, 2026.** This supersedes the remaining-work lists in the September 10 readiness checklist, the older launch plan, and the Google Play setup guide. Scope: iPhone and Android. Initial audit baseline: `78d535a`. The implementation update below records subsequent work in [PR #301](https://github.com/nhorto/cork-and-note/pull/301); release-code baseline is `60d5a51` (later documentation-only commits do not change the binary). Sanitized store records and screenshot checksums are saved in `docs/audits/2026-09-13-store-evidence.json`.

**Assessment:** substantial engineering and store preparation is now complete. Neither platform is ready for public release: authentication email, exact-binary acceptance/purchases, account/policy checks and Android production access still need evidence.

## Implementation update after the audit

- [x] Integrated the cellar-origin correction and Android marker rendering fix, preserving the newer map labels and directory behavior. Cellar backfill is applied; no existing records required correction. Android ANR/OOM acceptance remains open until native stress testing passes.
- [x] Added strict winery-name and distance guards so nearby or similarly named businesses cannot silently supply another winery's enrichment. Missing coordinates now produce no match. Added regression coverage.
- [x] Configured the existing Gemini credential, verified generation, deployed `chat`, `places`, `routes` and `revenuecat-webhook`, and completed the parity probes. Live backend parity passes across all 37 migrations. Live chat, guarded Places lookup and Gemini tasting-menu/wine-list scans return successful responses.
- [x] Tested reviewer login and server-side Pro entitlement. Ran live row-level security and account deletion checks: no cross-account leaks or self-granted Pro; both disposable accounts and all their rows/storage objects were removed.
- [x] Updated Apple description and verified the saved value; retained the six matching screenshots and manual release. Saved Google's full/short descriptions, support contacts, icon and feature graphic. Real Android phone screenshots remain in progress.
- [x] Prepared cross-platform website billing/availability and fair-use corrections in source. Public deployment verification remains pending.
- [x] Local verification: **1,024 Jest tests**, **82 Deno tests**, lint with zero errors (44 pre-existing warnings), website build and whitespace checks pass. PR #301's CI and Vercel preview pass.
- [x] Inspected Android production **versionCode 5**: [EAS build](https://expo.dev/accounts/nick5757/projects/cork-and-note/builds/724d74f3-9750-4d44-a53d-91553d0eb7a0). This build exposed four incompatible native libraries (eight ABI files) and unnecessary media/microphone permissions; it is **not a release candidate and was not uploaded**. Removed unused native packages, applied Expo 53 patch updates and added `scripts/verify-android-native.py`; a replacement build is next.
- [ ] iOS candidate: cloud quota blocked a hosted build; local build 24 was stopped to incorporate the native dependency corrections. A replacement local production archive will use Xcode 26.6. Do not select an older build as a substitute for testing the current source.

**Compatibility note:** the deployed scan route enforces AI sharing consent version 2. Older testers may receive an update/re-consent requirement; current release candidates contain the matching consent flow. Do not certify old builds against the new scan path.

## Screenshots: the direct answer

| Store | Verified directly today | Next action |
|---|---|---|
| Apple | Six images, all `COMPLETE`, in the en-US iPhone screenshot set. Every source checksum exactly matches the corresponding PNG in `~/Downloads/Cork-and-Note-AppStore-Final-Slides/`, in order 01–06. | The final mockup set **has already been uploaded**. No duplicate upload needed. Review the map and sommelier slides against the final candidate if their open redesigns are included. |
| Google Play | Full/short descriptions, support contacts, icon and feature graphic have now been saved. Phone screenshots are still outstanding. | Capture and upload real Android screens with demo data. The six existing iPhone images are not an Android set. |

Apple uploads are attached to a version still being prepared; they are not evidence of a public storefront launch. Google internal testing likewise is not a public release.

The studio is `mockups/appstore-screenshot-studio.html`; its offline copy is `~/Downloads/Cork-and-Note-App-Store-Studio.html`. The final six-slide export is an **iPhone** set. The Android files inspected in temporary QA folders show personal test data, loading states or older UI; they are not a verified final marketing set. Android screenshot upload remains unfinished, rather than treating those QA captures as approved store artwork.

## Already complete: do not repeat this work

- [x] iPhone-only configuration is in source. Apple has newer valid store builds; selected build is **21**, latest uploaded is **22**, both uploaded September 11.
- [x] Apple version 1.0 is `PREPARE_FOR_SUBMISSION`, with **manual release**, copyright, all reviewer contact fields, demo credentials and notes populated. Reviewer login and server-side Pro entitlement were subsequently tested successfully.
- [x] Both Apple subscriptions are `READY_TO_SUBMIT`, with processed subscription-review screenshots. These are separate from the six marketing images.
- [x] Android production AAB **versionCode 4** is on the **internal** testing track with release status `completed`.
- [x] Google monthly and annual base plans are `ACTIVE`. US prices are **$9.99/month** and **$59.99/year**; annual offer `free-trial-3d` is active with one free `P3D` phase for eligible new subscribers.
- [x] Android RevenueCat configuration, platform-specific billing copy, Android annual-trial display, API 36 configuration, AI permission and in-app AI-response reporting are merged.
- [x] Public homepage, support, privacy, terms and `/delete-account` return HTTP 200. Support and legal pages contain `cork_and_note@yahoo.com`; public privacy now names Google Gemini as well as Anthropic.
- [x] All **37** committed migrations appear in live migration history. Existing schema probes pass, expected bucket visibility matches, and all inspected user tables have row-level security enabled.
- [x] Main's CI passed: [run 34694874881](https://github.com/nhorto/cork-and-note/actions/runs/34694874881). The September 11 campaign added extensive behavioral and backend tests and fixed real defects; its earlier “not yet merged” notes are historical.

## First priority: shared launch blockers

- [ ] **Nick + engineering: configure production authentication email.** Live `smtp_host` is null, the send-email hook is disabled and `rate_limit_email_sent` is 2/hour. Email auto-confirmation is currently **on**, so the old checklist's claim that signup requires confirmation is stale. Auto-confirmation does not solve password recovery. Configure a verified sender/provider, set an appropriate rate limit and install the existing branded templates. Prove reset delivery to a non-team address and complete the reset deep link on both platforms. Decide deliberately whether signup should require email verification. Supabase's default sender restricts recipients to project-team addresses and is unsuitable for production. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)
- [x] **Engineering: reconcile the deployed backend with release source.** Gemini generation and scan smoke checks pass; four changed functions are deployed to the correct project. See implementation update above.
- [x] **Engineering: restore fully passing backend verification.** Added schema/data sentinels for the September 12 changes and cellar backfill. Full live parity passes.
- [ ] **Engineering + Nick: prove purchases on the final store-installed candidates.** Test monthly and annual, eligible annual trial and returning-customer pricing, cancellation of the purchase sheet, restore after reinstall, account switching, expiry/refund and loss of Pro. Verify RevenueCat events reach the matching Supabase entitlement and enable an actual server-backed Pro request. Product configuration and a webhook TEST ping are insufficient evidence. Use Apple sandbox/TestFlight and Google license testers; record results separately for each platform.
- [ ] **Nick: verify financial-account activation.** Confirm Apple's Paid Apps Agreement, tax and banking are Active; confirm Google merchant/payment readiness. Earlier submissions and ready products do not establish these account states. These dashboard checks were not established by today's APIs.

## Second priority: freeze and test the release candidates

| Platform | Current release evidence | Required gate |
|---|---|---|
| iPhone | App Store Connect selects build 21; build 22 is valid but not selected. Both uploads predate the final September 11 fixes. Recent iOS local builds are not represented in the EAS cloud-build list, so their exact source commits were not established. | Record the candidate's source commit and build number, include release fixes, test it, then select that exact build. Do not simply select 22 because it is newest. |
| Android | EAS production build 4 came from `fc03253`, **14 commits behind audited main**. Play internal track points to 4. | Build a current signed AAB and test the Play-installed artifact, including Maps under Google's app-signing certificate. |

- [ ] **Engineering: resolve Android map stability [#265](https://github.com/nhorto/cork-and-note/issues/265).** The recorded ANR/OOM includes dense map data, AVA regions and recentering. [PR #291](https://github.com/nhorto/cork-and-note/pull/291) changes marker rendering but is open and is not proof this stability issue is fixed. Acceptance: cold map open, sustained Napa pan/zoom, clustering, AVA toggle and recenter without freezes or memory exhaustion on a physical Android device and emulator.
- [x] **Engineering: resolve incorrect winery matches [#288](https://github.com/nhorto/cork-and-note/issues/288).** Strict name, valid-coordinate and three-kilometre distance guards are tested and deployed. Uncertain matches are omitted.
- [x] **Engineering: finish cellar-origin data correction [#294](https://github.com/nhorto/cork-and-note/issues/294).** PR #298's fix is integrated in #301; migration/backfill is applied. Existing journal entries remain intact, and the live backfill found zero affected records.
- [x] **Engineering: freeze optional UI scope.** Include the marker stability work; exclude optional map/sommelier redesign and new badge PRs from this candidate. Those features need not delay this release.
- [ ] **Engineering + testers: run the same acceptance journey on both exact release binaries.** Fresh signup/login/reset; age gate; log/edit a tasting and photo; relaunch; label/card/list scans; cellar add/open; journal search; winery discovery/directions; AI consent decline/revoke; Free limits and Pro tools; purchase/restore; AI reporting; delete a disposable account and verify its storage/data removal. Exercise denied permissions, offline/recovery, Android back/keyboard, small screens and dark mode. Record device, OS, build and result.
- [ ] **Engineering: verify native submission requirements on the actual artifacts.** API 36 is configured, but final Android Billing dependency, 16 KB native-library support, permissions and signing must be checked. Apple requires the applicable Xcode/iOS 26+ build tools and privacy manifests. Successful older uploads do not validate a newly changed binary. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/), [Google target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [Billing lifecycle](https://developer.android.com/google/play/billing/deprecation-faq), [16 KB support](https://developer.android.com/guide/practices/page-sizes)

## Third priority: finish the store packages and review

- [ ] **Engineering + Nick: complete Google Play's listing.** Save the short/full descriptions, support details, icon, feature graphic and actual Android marketing images. Minimum phone screenshot count is two; prepare four or more readable portrait images for the marketing set. The old Play guide's “billing is not wired,” “purchase history: No,” and “digital purchases: No” instructions are obsolete. [Google listing assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [ ] **Nick + engineering: reconcile both stores' privacy/content forms with current behavior.** Include RevenueCat purchase history and identifiers, photos, journal/chat context, Gemini scans, Anthropic, location and relevant Google services. Verify Apple App Privacy, current age-rating questionnaire, Google Data safety, adult target audience, IARC digital purchases, ads, app access and deletion URL. Public privacy copy is updated; the stores' submitted declarations were not verified. The Apple API's legacy `SEVENTEEN_PLUS` enum is not proof of the current displayed rating.
- [x] **Engineering: refresh Apple copy against final features.** Saved and read back updated feature, billing and fair-use text, removing the unsupported offline claim. The repository contains the exact store copy in `docs/business/store-listing-2026-09-13.json`.
- [ ] **Nick + engineering: finish reviewer/support operations.** Apple reviewer login and Pro now pass. Google app-access instructions and support/deletion-request handling still require Console/mailbox verification; establish a routine for AI reports. Credentials are kept out of repository documents.
- [ ] **Nick: verify countries, age suitability, app price and applicable trader declarations.** Confirm intended territories on both stores and subscription availability. A Virginia marketing focus is separate from storefront availability. Complete any required agreement or identity actions shown in each Console.
- [ ] **Apple operator: attach the tested build and first subscriptions/group, then submit for review.** Both subscriptions are ready but not yet approved. Version 1.0 remains in preparation. Keep manual release for coordination after approval.

## Android's separate calendar dependency

Live Play tracks show internal build 4 only; `alpha`, `beta` and `production` have no releases. There is no evidence of a running closed-test release. The API did not establish tester counts or this account's production-access approval.

- [ ] **Nick + engineering: check the Console's production-access requirements and start closed testing.** For applicable new personal accounts, at least **12 testers must stay opted in continuously for 14 consecutive days**, followed by an application for production access. Recruit a few extra, collect actual feedback and retain the fixes/test record. Internal testing does not satisfy this requirement. [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [ ] **Nick: apply for production access when eligible**, then submit the production app release. Access approval and release approval are different gates.

If the required 12 testers all join on September 13, the earliest 14-day completion is **September 27**, plus access/release review time. This is conditional scheduling, not a promised launch date. There is no reason to hold an otherwise-ready iPhone release for Android unless a simultaneous release is important to the launch plan.

## Before announcing availability

- [ ] **Nick + engineering: verify operations.** Confirm backend uptime/plan and backups, who checks auth/purchase/function errors, and budget alerts for both Anthropic and Gemini plus Google APIs. The earlier Anthropic-only budget does not cover the new scan provider. The repo has no dedicated crash-reporting SDK; establish a practical device-crash/ANR and server-error monitoring route for launch.
- [ ] **Engineering: update website billing and launch links.** The live site is up, but source still says iPhone coming soon and bills through Apple only. Add the actual store links as each platform goes live, keep platform availability accurate and align fair-use wording.
- [ ] **Nick + engineering: verify fresh public installs after approval/release**, including signup, Maps, scans and an explicitly authorized real purchase/restore. Confirm production server-side Pro before spending on promotion.
- [ ] **Nick: prepare the first support/marketing week.** Working download links, QR destination, Virginia pilot outreach and a daily check of signups, first tastings, purchase failures, AI spend and support. New badges, richer winery content, broad advertising and larger partnerships can follow launch.

## Recommended order and owner handoffs

1. **Now:** configure a verified Cork & Note transactional sender; confirm financial activation; recruit Android closed testers.
2. **Engineering:** finish current release artifacts, Android screenshots and native stability acceptance. Backend deployment and release-source integration are complete.
3. **Together:** execute candidate acceptance and purchase/restore tests; capture Android marketing images and finish the two store packages.
4. **Stores:** submit iPhone when its gates pass; finish Android testing/access and submit Android independently.
5. **Launch:** release, verify public installs, turn on working website/QR links and monitor the first users.

**Audit limits:** live reads covered Apple version/builds/localizations/screenshots/reviewer-field presence/subscription readiness, Google tracks/listing/images/base plans/offers, EAS build history, Supabase auth/secrets/source/parity, public website and GitHub main/CI/issues/PRs. Google bundle enumeration returned HTTP 503; its installed release version is independently identified by tracks and EAS. No purchase, fresh email delivery, physical-device acceptance, agreement dashboard or policy-form sign-off was performed. Subsequent authorized work deployed backend changes, applied the cellar migration and committed store listing updates; Google automatically routes those listing edits through review. No public app release has been made. Inspection-only Google edits are deleted without commit. Only an unrelated staging domain is verified in the accessible email provider; it was not repurposed for Cork & Note.
