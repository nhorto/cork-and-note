# Pro product direction — September 11, 2026

**Expanded research and UX proposal:** see the [implementation report](../research/pro-features-ux-and-implementation-2026-09-11.md) and [interactive concept](../design/pro-tools-concept-2026-09-11.html). They develop the three guided tools and the subsequently requested AVA map overlay; those additions remain proposed, not implemented in the app.

## Changes implemented in this checkout

Winery discovery is available to every signed-in account: directory pins, map panning, Nearby filtering, Find search, Home's Near You, and opening winery pages. Location permission remains optional for the map and requested by a tap on Home. Directory websites are free where available; saved pages can recover a website by exact directory name and coordinates. A missing website never triggers a Google fallback for free users.

Google ratings, hours and other Google enrichment remain Pro-only; the existing server entitlement check and rate limits remain in place. The signup comparison, paywall, winery teaser, marketing site and store-listing draft now describe this split. The directory already permits reads by authenticated free accounts; no database migration is needed. “Every account” does not add anonymous browsing or guarantee exhaustive worldwide directory coverage.

Pricing, lifetime scan allowance, monthly chat allowance, cellar cap, and CSV export gate are unchanged. Earlier discussion of changing them was a recommendation, not a decision to implement them.

## Existing Sommelier capabilities verified in source

- Photo attachments are converted to base64 and sent through `aiService.sendMessage`; the server rejects photo chat for free accounts and allows it for active Pro accounts subject to usage caps.
- `webSearchToolsFor` attaches Anthropic's web-search tool to Pro chat, capped at two searches per request. Whether to search is chosen by the model, so not every answer will contain a search.
- Search-enabled responses are parsed for text and source citations. These are existing features, not new roadmap items.

Source inspection and automated tests do not establish the deployed function version or replace a live Pro-account photo/search check.

## Recommended next Pro addition: choose from a wine list

Build an explicit task around existing photo chat: photograph a restaurant or tasting-room list, enter a budget and optionally a dish, and compare three choices with reasons grounded in the user's journal. Show recognized wine names/prices for correction, distinguish glass versus bottle prices, and admit missing vintages or unclear text. Never invent availability, live prices, or a precise match percentage. Let users save a choice and later log whether they enjoyed it.

The initial implementation can reuse image questions, tasting context and structured response parsing. The value is a reliable, guided decision flow, not merely another chat prompt. Evaluate extraction errors and personalized choices before marketing it as a dedicated scanner. This is a proposal, not implemented by the discovery change.

## Additional candidates, in priority order

| Candidate | Paid value | Existing foundation / new work |
|---|---|---|
| Wine-country day planner | Suggest a few stops around time, distance and preferences; save and revise a plan | Directory and Google hours exist; route/time calculation, structured itinerary and persistence are new. Verify hours and distinguish suggestions from bookings. |
| Personal taste report | Explain recurring preferences using examples from the journal, then propose the next styles to try | Sommelier already reads recent tastings. A dependable report needs deliberate history selection, enough evidence, a saved report and a clear empty state. |
| Buy-again shortlist | Turn highly rated tastings into a useful shopping list, with exact vintage and source links | Journal and web search exist; validated offers, availability, price timestamps and partner links are new. Affiliate payouts are not assumed. |

Avoid advertising basic pairing, Tonight's Pick, photo chat, web search, or existing cellar reminders as new features. Audit existing implementations before adding more gates. Keep manual tasting logs unlimited.

Current market references support packaging concrete tasks: [Vivino's guide](https://www.vivino.com/uk/wine-news/the-complete-guide-to-the-vivino-experience) describes its Sommelier and wine-list scanner; [InVintory pricing](https://invintory.com/pricing/) groups paid collection guidance and management features. These references establish competing offerings, not evidence that a particular Cork & Note feature will convert.

## Conversion measurement

Lead with the task at its natural entry point. Show an honest example before purchase, local store pricing, and the relevant free allowance. Resume the task after upgrading. Measure feature-entry-to-upgrade, successful task completion, repeat paid usage, cancellations and refunds, and API cost per subscriber. Compare changes over comparable cohorts; do not claim a conversion lift without data. Product-event instrumentation and these experiments are follow-up work.

## Future winery insights

Both privacy and terms now describe a possible separate opt-in program for paid aggregate winery reports. It is not running, and the text grants no new right to share current journals. Participation must identify data, purposes, recipients, safeguards and withdrawal limits; suppress small groups and exclude identifying details. Ordinary app use or a Pro purchase is not consent.

Before launch, implement and verify consent records, withdrawal controls, exclusion of nonparticipants, minimum cohort rules, retention, and participant-facing notice. Historical journal inclusion needs explicit permission. Check the final program and documents against actual practices before release. The FTC specifically cautions against expanding uses of previously collected data through quiet, retroactive policy changes: [FTC guidance](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/02/ai-other-companies-quietly-changing-your-terms-service-could-be-unfair-or-deceptive).

The app and hosted legal-page build share `lib/legalContent.js`. Local edits and a successful build do not publish notices, deploy the site, or release a new app binary.
