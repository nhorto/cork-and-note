# Google Play declarations — September 14, 2026

Saved for Cork & Note, `com.nicholashorton.corkandnote`, using the owner's signed-in Safari session through macOS accessibility. Safari's JavaScript-from-Apple-Events setting remains off. The App content page shows **10 actioned declarations**. This records saved Console settings, not Google approval or a published release.

## Saved answers

| Declaration | Answer / evidence |
| --- | --- |
| Privacy policy | `https://cork-and-note-sigma.vercel.app/privacy`; replaced the older Vercel project URL. Live page includes Maps, Routes, Expo and signup processing. |
| Sign-in details | Restricted access. Existing `review@corkandnote.com` account supplied privately. Fresh login returned HTTP 200; server entitlement is Pro with no expiration. Instructions cover the age gate, sign-in, optional permissions and AI consent. No purchase, trial or OTP is required. Password is not in this repository. Optional Google/partner-device experience testing was disabled. |
| Ads | No in-app ads. Buying Meta ads to promote the app does not make it an app containing ads. |
| Advertising ID | No. Android 7's final manifest has no `com.google.android.gms.permission.AD_ID`; app source does not enable RevenueCat advertising-identifier collection. |
| Target audience | 18 and over only, with Google's restriction for users determined to be minors enabled. The US advertising cohort remains 21+. |
| Content rating | All Other App Types; frequent alcohol references, online/AI content, alcohol promotion focus and digital purchases. No user-to-user content exchange, location sharing with other users, gambling, random purchases or cash rewards. Generated ratings include ESRB Mature 17+, PEGI 18 and IARC 18+. |
| Government | No. |
| Financial features / Health | Already actioned when inspected; not overwritten. |
| Store category | App → Food & Drink. |

## Data safety

Saved after reviewing app source, native permissions, provider documentation and live provider configuration. Data is encrypted in transit. Account creation uses username/email and password. Account deletion URL: `https://cork-and-note-sigma.vercel.app/delete-account`. The optional separate-data-deletion question was left unanswered. No independent security certification was claimed.

All 13 selected data types are non-ephemeral. Provider retention and persistent account records prevent a blanket ephemeral claim.

| Type | Collection | Shared under Play definition | Collection purpose |
| --- | --- | --- | --- |
| Name | Required | No | Functionality, account management |
| Email address | Required | No | Functionality, security/compliance, account management |
| User IDs | Required | No | Functionality, analytics, security/compliance, account management |
| Purchase history | Required | No | Functionality, analytics |
| Approximate location | Required | Yes | Functionality, analytics, personalization |
| Precise location | Optional | Yes | Functionality, personalization |
| Other in-app messages | Optional | No | Functionality, personalization |
| Photos | Optional | No | Functionality |
| Crash logs | Required | Yes | Analytics |
| Diagnostics | Required | Yes | Analytics |
| App interactions | Required | Yes | Functionality, analytics, security/compliance |
| Other user-generated content | Optional | No | Functionality, personalization |
| Device or other IDs | Required | Yes | Functionality, analytics |

Sharing purposes: location → functionality and analytics; crash logs, diagnostics, app interactions and device IDs → analytics. Precise device location requires permission; general-area information can arise from IP addresses even without that permission. Journal/AI/photo collection is optional because people can choose not to use those features. RevenueCat purchase-history collection is required under its disclosure guidance, even though buying Pro is optional.

“Not shared” uses the processor exception; it does **not** mean data never leaves the device. Supabase hosts account and journal data. Anthropic processes sommelier text/context/photos. Gemini processes scan photos. RevenueCat processes account identifiers and purchase events. The Google Maps Platform disclosure includes collection used to improve Google's own services and is not treated as a blanket processor exception.

### Provider checks

- The deployed `GEMINI_API_KEY` digest matches a key in `gen-lang-client-0908176482`, whose billing is enabled. No key value was printed. Gemini's paid-service rules therefore apply to API requests from that project: submitted prompts/photos and outputs are processed under its processor terms, with limited abuse-prevention retention. See the [sanitized verification](../../audits/2026-09-14-gemini-billing-verification.json).
- RevenueCat project `proj3888109e` (display name `me`) contains Cork & Note's Android and iOS package. Its only active integration is the webhook to `https://ixecayqpogkiawempzgc.supabase.co/functions/v1/revenuecat-webhook`. No third-party advertising/analytics integration was active in the inspected list. No integration settings were changed.
- Maps SDK disclosure covers technical metadata, IP addresses, a pseudonymous Maps ID, crashes and map interactions. Maps Platform terms additionally cover coordinates and retained requests.
- Expo update delivery contributes technical update information. No separate Sentry/advertising SDK is installed in the audited app dependencies.
- These answers describe current functionality. Future winery insight sales, public social features, advertising SDKs or new integrations require a fresh review before deployment.

## Release validation and saved package

Alpha version 7 preview was confirmed and saved. Console showed **zero blocking validation errors** and **one warning**: no deobfuscation file is attached to the bundle. Publishing overview now contains **14 changes not yet submitted for review**, including the release, United States, the owner's tester list and feedback email. Managed publishing is off, so approval after submission would roll out the closed test automatically. Review has not been submitted.

The Maps key embedded in Android 7 matches the inspected Google Cloud key. It is API-restricted to the Maps Android service and has no Android application/certificate restrictions; no key setting was changed. Physical Play-installed Maps testing is still required.

The store contact website was published as `https://cork-and-note-sigma.vercel.app`. This contact-field update does not publish the app. Meta billing was inspected and has **no payment method**. The signup roster has **zero requests**.

## Release limits

The website policy changes are deployed, but no new Android binary or OTA update was created in this session. Android 7 contains the previously built in-app policy. Physical-device Maps, purchase/restore and release acceptance remain separate from these Console declarations. The closed-testing clock has not started: the Dashboard showed **0 opted-in testers**, and this account requires **12 opted-in testers for 14 continuous days**.

## Sources checked September 14

- [Play app-content setup](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [Play Data safety definitions and exemptions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [RevenueCat Android data disclosure](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety)
- [Google Maps SDK disclosure](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure)
- [Maps Platform data-use terms, section 4.4](https://cloud.google.com/maps-platform/terms)
- [Google location information](https://policies.google.com/technologies/location-data)
- [Gemini paid-service terms](https://ai.google.dev/gemini-api/terms)
- [Closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
