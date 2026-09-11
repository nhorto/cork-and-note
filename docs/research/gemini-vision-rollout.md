# Gemini wine-scan rollout

This change routes bottle labels, tasting cards, and restaurant wine-list extraction to **Gemini 3.8 Flash**. Sommelier conversations (including chat attachments), wine-list recommendations, taste reports, and trip planning continue using the existing Anthropic route. The [pilot findings](vision-benchmark-pilot-2026-09-11.md) explain the selection and its limits; the benchmark's seven-field schema differs from the production forms, so its 99.6% result is not a measured accuracy claim for this adapter.

## Configuration and release

1. Configure `GEMINI_API_KEY` as a **server-side Supabase Edge Function secret** for the intended Google project before deploying `chat`. Keep `ANTHROPIC_API_KEY` for chat and recommendations. Never place either credential in Expo/public configuration. Confirm the intended project's billing and data-processing configuration; the benchmark's local credential is not installed into production by this PR.
2. Deploy the updated `chat` function and release the matching app update together. No database migration or new entitlement bucket is required. `tasting_menu_scan` normalizes to `label_scan` for lifetime, daily, and burst accounting, while receiving its own extraction schema and output budget.
3. Publish the updated privacy page with the normal site build/deployment. `lib/legalContent.js` supplies both hosted and in-app policy text. The client shows the revised Google/Anthropic disclosure on its next AI request. Previous opt-outs stay declined; previous Anthropic-only opt-ins require a new decision.
4. Older clients without `ai_sharing_version: 2` receive HTTP 428 with an update/consent message for scan tasks before any Google request. This deliberately requires an app update for scans; old versions can still use their existing Anthropic chat route. The client marker prevents accidental provider migration by legacy clients; it is not a cryptographic or server-persisted consent record. Authentication, entitlements, and rate limits remain server-enforced.
5. Smoke-test label prefill, a dense tasting card, and a multi-page restaurant list on a device. Verify prior opt-in/opt-out behavior, Account withdrawal, scan meters, editable extracted rows, prices/servings, and unchanged text recommendations. Preserve a human review step; syntactically valid data can still be misread.

This PR opens a reviewable implementation; it does not deploy functions, change production secrets, or publish an app update.

## Behavior and failure handling

* Cards upload a JPEG with longest edge 1,568px, matching the tested list setting. Smaller HEIC inputs are also re-encoded instead of being mislabeled JPEG. Bottle labels/chat retain the existing 1,000px default.
* Google receives inline images, high media resolution, low thinking, and native JSON schemas. Label output is capped at 2,048 tokens; tasting cards and restaurant lists at 8,192. The production limits remain 24 card wines and 40 list entries (each glass/bottle serving is a separate entry).
* Local validation enforces required fields, types, enums, and row caps. Large array `maxItems` constraints caused Google's list schema to be rejected during live testing, so caps stay in prompt instructions and local validation rather than the provider schema.
* Valid JSON is adapted to the existing `cellar_label`, `tasting_menu`, and `wine_list` response blocks. The app's field normalization and edit/review flows remain in place. Grapes must be printed; appellation-based inference is removed from scan prompts.
* Gemini responses with `MAX_TOKENS`, safety blocks, invalid JSON, or invalid shapes return a clear failure, never partial rows. Requests have a 60-second timeout and no automatic retry/provider fallback. Provider response bodies and credentials are not logged.
* Input usage includes image tokens; output usage includes candidate plus thinking tokens. A dispatched failed scan is recorded as an attempt (known usage retained), so repeated failures cannot bypass limits. Missing-key and preflight failures are not metered. Unknown token usage is not evidence of a free provider call. No provider/model columns were added to the existing usage table.

## Validation

Validated locally: 664 Jest tests across 45 suites, all Edge Function typechecks, lint (zero errors; existing warnings), 14 benchmark scorer tests, and the generated privacy page. Live checks returned four card wines and ten restaurant-list entries through the production adapter.

The app/Edge test suite exercises the actual handler with mocked auth/database/provider I/O: provider selection, missing Anthropic key for Google scans, legacy-consent rejection, free/daily scan caps, failed entitlement reads, truncated paid attempts, and unchanged Anthropic recommendations. Adapter tests cover multimodal mapping, structured output, usage, schema rejection, and sanitized failures. Client tests cover renewed consent, retained opt-outs, image conversion, and production parser compatibility.

Live calls with supplied photos verified the production card and restaurant-list schemas after removing the incompatible provider-side array constraint. These are integration smoke checks, not a rerun of the full model benchmark. Photos and responses stay in gitignored `.vision-bench` files.

The next quality gate is a larger independently labeled, held-out photo set. Check Gemini 3.8's scheduled January 2027 pricing before that date; the benchmark catalog rejects its expired introductory rate.

API references: [Google structured output](https://ai.google.dev/gemini-api/docs/structured-output), [image input](https://ai.google.dev/gemini-api/docs/image-understanding), and [thinking settings](https://ai.google.dev/gemini-api/docs/thinking).
