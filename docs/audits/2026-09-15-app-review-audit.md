# App Store pre-submission audit, September 15, 2026

Scope: Cork & Note 1.0, iOS build 27 (commit `c9d3e78`), audited against the current App Store Review Guidelines before the first App Review submission. Code was read directly; where the September docs disagreed with the code, the code was taken as truth. Live App Store Connect state was checked through the API the same day.

## Fixed the same day (no new build needed)

| Item | Guideline | What was wrong | What was done |
|---|---|---|---|
| App category | submission requirement | Primary and secondary category were unset. | Set Food & Drink (primary) and Lifestyle (secondary) via API. |
| App price | submission requirement | No price schedule existed, so the app had no tier. | Free, base territory USA. |
| Availability | submission requirement | No availability record existed. | All 175 territories, available in new territories. Reversible from the API or the console. |
| Content rights | submission requirement | Declaration unset. | Set to "uses third-party content" (winery directory data, Google Places details), for which rights are held. |
| Reviewer purchase test | 2.1 | The only demo account is Pro, so the paywall's buy button is disabled for the reviewer. | Created a second, Free account (`review.free@corkandnote.com`, password in the private secret store) and listed both in the App Review notes with the steps to reach the paywall. |
| Review notes accuracy | 2.1 / 5.1.2 | Notes said scan photos go to Anthropic; scans use Google Gemini. No mention of the 21+ gate. | Notes rewritten: both providers named, consent flow described, age gate step included, AI reporting mentioned. |

## Verified compliant in the live record

- Description contains the auto-renew paragraph, "Terms of Use" and "Privacy Policy" links, no em dashes, no Android or Google Play mention (3.1.2, 2.3.10).
- Subscriptions: two products READY_TO_SUBMIT with processed review screenshots; group localization present.
- Paywall shows plan name, period, StoreKit price, trial only when eligible, auto-renew text, Restore Purchases, Terms, Privacy and Support links (3.1.2). Nothing in the free journal is paywalled (3.1.1).
- No social login, so Sign in with Apple is not required (4.8). Account deletion in-app and on the website (5.1.1(v)). Age gate blocks first launch; the server prompt floor forbids encouraging heavy drinking (1.4.3). No background modes, no microphone string, encryption exemption declared.
- Standard Apple EULA (no custom EULA uploaded), so the custom-license requirements do not apply.

## Fixed in code (ships in build 28 if it is cut before submission)

| Item | Guideline | Change |
|---|---|---|
| Generic "Always" location strings | 5.1.1 | `expo-location` plugin now sets only the when-in-use string and deletes the two "Always" keys the plugin adds by default. |
| AI output could only be reported from chat | 1.2 | New `components/AiNotice.js` (disclaimer plus Report) under Tonight's Pick, bottle pairings, the taste report, wine-list picks and wine-day notes. |
| Em dashes in the legal text | owner style rule | Removed from the privacy policy, terms and file comments. Site and in-app screens render the same module. |

Ship build 27 as-is if speed matters more; none of the three is a documented rejection reason. Build 28 removes the two most likely reviewer questions.

## Still owed before pressing Submit

1. **App Privacy label** (owner, App Store Connect UI, about five minutes): add **Contact Info: Name** (collected at registration) and **Purchases: Purchase History** (RevenueCat), both linked to identity, purposes App Functionality and Analytics. The API cannot edit this section.
2. **Annual plan sandbox purchase and one Restore** on a physical iPhone (owner).
3. **Do not publish an EAS Update to the production channel while a build is in review.** `lib/updates.js` reloads on launch and foreground, so an update would silently replace the reviewer's bundle.
4. Optional: recapture the Home and chat screenshots; the uploaded set predates the badge and sommelier-entry changes. Not a rejection risk.

## Deliberately left alone

- The marketing site mentions Android and Google Play. Guideline 2.3.10 applies to metadata fields, and the site is also the Android recruiting page. Leave it.
- Consent for AI sharing is device-local; a reinstall re-asks. Acceptable for v1.
- Overture Maps attribution for the winery directory is not shown in-app; add to the About screen after launch.
