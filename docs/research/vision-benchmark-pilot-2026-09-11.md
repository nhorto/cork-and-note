# Wine vision benchmark: measured pilot

September 11, 2026. **Use Gemini 3.8 Flash as the leading replacement candidate for wine-card extraction.** Gemini 3.5 Flash-Lite is the budget option; GPT-5.6 Luna is the OpenAI alternative. These recommendations supersede the earlier research-only shortlist after testing actual photos. No production model or application behavior has been changed.

I ran **170 paid API calls across nine models**, using the eight supplied photos (52 wine entries), repeated resolution comparisons for five finalists, and two public PDF menu pages (34 entries). All 170 calls returned completed, schema-valid JSON. Estimated total cost from returned usage was **$0.7517**. JSON validity did not guarantee accurate content.

**Results on your photos**

The first pass gives every model the same eight photos at a 1,568px longest edge. “Field recall” is the proportion of labeled visible fields extracted correctly, not the percentage of perfect scans. Exact-card scoring additionally rejects missing/extra wines and invented values in fields labeled absent. Prices below are measured token usage multiplied by published rates, extrapolated to 1,000 scans of this mix; they exclude downstream taste recommendations, retries, and infrastructure.

| Model | Field recall | Entire cards correct | Missing / extra wines | Invented absent fields | Cost / 1,000 scans | Median latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini 3.8 Flash | **99.6%** | **7/8** | 0 / 0 | 0 | **$3.29** | 2.8s |
| Gemini 3.5 Flash-Lite | 97.9% | 4/8 | 0 / 0 | 3 | $1.65 | 2.1s |
| GPT-5.6 Luna | 97.9% | 4/8 | 0 / 0 | 0 | $1.37 | 6.5s |
| Gemini 3.1 Flash-Lite | 96.2% | 3/8 | 0 / 0 | 6 | $1.34 | 3.2s |
| GPT-5.6 Terra | 94.4% | 4/8 | 1 / 1 | 0 | $12.80 | 8.7s |
| Claude Sonnet 5 | 94.0% | 3/8 | 0 / 0 | 0 | $12.43 | 5.0s |
| Gemini 3.5 Flash | 94.0% | 3/8 | 0 / 0 | 1 | $7.51 | 2.9s |
| GPT-5.4 mini | 89.7% | 2/8 | 0 / 0 | 10 | $4.77 | 4.6s |
| Claude Haiku 4.5 | **62.8%** | **1/8** | **6 / 23** | **7** | **$5.01** | 10.1s |

On this workload, Gemini 3.8 cost approximately 34% less than Haiku and gave much better extraction. At 10,000 similar scans, the first-pass estimates are $32.90 for Gemini 3.8, $16.50 for Flash-Lite, $13.70 for Luna, and $50.10 for Haiku. Higher token prices did not buy better results here; this comparison does not establish that Haiku should be removed from unrelated text tasks.

The failure examples matter more than a generic visual benchmark. Haiku added wines that were not on the sideways Cooper's Hawk card, invented vintages on the Italian menu, and confused items on the food/beer menu with wines. Some other models' errors were narrower: misread prices, sale-price selection, omitted shared winery names, or misplaced/overly conservative grape fields. Gemini 3.8's first-pass error was a small wine-name spelling difference, “Sull” versus “Suil.” Review the local per-field differences before treating every strict mismatch as an equally serious reading failure.

**Repeatability and image size**

Each row below uses the same eight phone photos. The two 1,568px columns are separate calls; the 1,000px column comes from the repeat experiment. These are repeated measurements of eight images, not 24 independent test images.

| Model | First 1,568px field recall | Second 1,568px field recall | 1,000px field recall | Exact cards across both 1,568px passes |
| --- | ---: | ---: | ---: | ---: |
| Gemini 3.8 Flash | 99.6% | 99.6% | 97.4% | 13/16 |
| Gemini 3.5 Flash-Lite | 97.9% | 99.6% | 94.4% | 9/16 |
| Gemini 3.1 Flash-Lite | 96.2% | 94.4% | 95.7% | 6/16 |
| GPT-5.6 Luna | 97.9% | 95.7% | 82.9% | 8/16 |
| Claude Haiku 4.5 | 62.8% | 65.8% | 56.0% | 2/16 |

Gemini 3.8 stayed strongest on whole-card correctness. Flash-Lite's second pass tied its visible-field recall but still inserted values in three absent fields. Luna missed eight wine rows at 1,000px; its low cost does not justify discarding readable detail before upload. Not every model improved on every repeat, so resolution is a tested starting point, not a universal monotonic guarantee.

Automatic input caching reduced Luna's second 1,568px pass to $0.80 per 1,000 calls; its uncached estimate was $1.30. The main comparison uses the equal first pass, where observed and uncached estimates match. Do not assume repeat-test cache savings for unrelated customer photos.

**Public menu controls**

Two clean pages from [Big Door Vineyards' menu page](https://bigdoorvineyards.com/menu) were downloaded, hash-checked, rendered to images, and sent without embedded PDF text. These are correlated controls from one winery, not extra phone-photo evidence. Provenance and expected fields are in [public-cases.json](../../benchmarks/vision/public-cases.json).

| Model | Field recall | Exact pages | Cost / 1,000 pages |
| --- | ---: | ---: | ---: |
| GPT-5.6 Luna | 100.0% | 2/2 | $1.74 |
| GPT-5.6 Terra | 100.0% | 2/2 | $18.65 |
| Gemini 3.1 Flash-Lite | 98.1% | 1/2 | $2.43 |
| GPT-5.4 mini | 94.2% | 0/2 | $6.70 |
| Gemini 3.8 Flash | 93.3% | 0/2 | $5.91 |
| Gemini 3.5 Flash-Lite | 89.4% | 1/2 | $3.56 |
| Gemini 3.5 Flash | 84.6% | 0/2 | $18.00 |
| Claude Sonnet 5 | 82.7% | 1/2 | $18.76 |
| Claude Haiku 4.5 | 63.5% | 0/2 | $6.69 |

All models found every wine row on these clean pages. Differences largely concerned grape and shared-producer fields, rather than recognizing the wine names. Gemini 3.8 omitted six grape fields on the flight page; another strict mismatch was “white muscadine” versus the gold label “Muscadine.” That wording penalty illustrates the limits of exact normalized scoring. Luna's clean-document result is encouraging but does not erase its smaller-photo failures. The pilot does not establish a universal vision winner.

**Three recommendations**

1. **Gemini 3.8 Flash: preferred default for tasting cards and wine lists.** Best results on the supplied phone photos across both passes, no missed or extra wine rows, and low latency. Start at 1,568px with high media resolution and adequate output space. Its current introductory token rates end December 31, 2026; at the scheduled doubled rates, the same first-pass workload would cost about $6.58 per 1,000 scans. It remains the quality-first choice here, but revisit economics before January.
2. **Gemini 3.5 Flash-Lite: budget alternative.** Roughly half Gemini 3.8's first-pass cost and quick responses, with somewhat less reliable complete-card extraction. Prefer it only if a larger test confirms the remaining price/name/grape errors are acceptable. Do not assume a cheap-first fallback saves money until the error-detection trigger and retry rate are measured; a valid JSON response did not detect any of this pilot's extraction errors.
3. **GPT-5.6 Luna: low-cost OpenAI alternative.** Strong phone-photo field recall at 1,568px and both public pages completely correct. Slower than the Google finalists and substantially weaker at 1,000px. Keep it in a larger comparison, especially for a second provider; GPT-5.4 mini and Terra did not justify their higher costs on these photos.

These measured recommendations replace GPT-5.4 mini and Sonnet 5 from the initial research shortlist. Sonnet 5 would preserve the existing provider, but the pilot gives no accuracy/cost reason to choose it over these three.

**Prices and experiment settings**

Standard USD per million tokens, input/output: Gemini 3.8 Flash $0.75/$3.75; Gemini 3.5 Flash $1.50/$9; Gemini 3.5 Flash-Lite $0.30/$2.50; Gemini 3.1 Flash-Lite $0.25/$1.50; Luna $0.20/$1.20; GPT-5.4 mini $0.75/$4.50; Terra $2/$12; Haiku $1/$5; Sonnet 5 $2/$10. Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing). Exact model IDs, cache rates, and expiry checks are in [models.json](../../benchmarks/vision/models.json). See the [earlier research](vision-model-reassessment-2026-09-11.md) for published visual benchmark scores; the wine-photo results above are our own measurements.

All candidates received the same extraction-only prompt and native strict JSON schema, with seven fields per wine. Images were EXIF-oriented and converted to JPEG at quality 80, using identical bytes per resolution. Google high media resolution and OpenAI high image detail were used, with low thinking/reasoning; Claude thinking was disabled. The output ceiling was 8,192 tokens. Billed reasoning is included in cost. These settings compare usable extraction systems, not equal internal compute or each model's best possible tuned configuration.

The trial consisted of 72 equal first-pass calls, 80 finalist resolution/repeat calls, and 18 public-control calls. The five repeat candidates were selected after the first pass. The extraction prompt was not tuned between candidates. Temperature was left at provider defaults; a job-order seed does not make model output deterministic. Provider shards ran concurrently, while requests within each shard were sequential. Latencies include network, provider load, and possible schema compilation; they are descriptive small-sample measurements.

**Answer-key audit and limits**

I visually transcribed the original photos before inference; a person has not independently verified the labels. After inspecting enlarged originals while reviewing discrepancies, I corrected two mistakes in my own answer key: Naked Mountain Cabernet Franc's bottle price from 46 to 40, and Cooper's Hawk Lux Chardonnay from 36.99 to 29.99. Gold revision 1 and original run snapshots remain preserved. Every phone-photo result above was rescored against revision 2; raw predictions were not changed. The revision log contains the affected case, field, old/new value, and evidence.

The scoring accepts predefined alternatives, ignores superficial punctuation/case/price formatting, and leaves ambiguous fields unscored. Null means the information was absent; omitted gold keys are unscored. Some schema judgments remain debatable, including treating the Cooper's Hawk prices as bottle prices and requiring grape names where printed wine names identify grapes. Strict name/field placement can penalize text that a user could interpret. Gold revisions after seeing errors create a possible bias; preserve the audit and freeze independently reviewed labels for the next evaluation.

Eight selected phone photos cannot establish production accuracy, broad multilingual coverage, or reliability on unreadable images. The current set also lacks a dedicated bottle-label evaluation, no-wine negative controls, a held-out test set, and a measured retry/fallback strategy. This is sufficient to reject Haiku as the preferred candidate for these hard cards and select the next model to validate, not to promise 99.6% accuracy on future customer scans.

**Repository deliverables and next implementation step**

The [benchmark README](../../benchmarks/vision/README.md) explains setup, importing photos, labeling, public controls, paid runs, offline rescoring, and comparison reports. The harness preserves source hashes, model settings, prompt/schema, returned usage, predictions, and sent images in the gitignored `.vision-bench` directory. Private photos, credentials, and raw results are not committed. The local `.vision-bench/comparison/index.html` dashboard filters all 170 calls and exposes per-field differences; `.vision-bench/comparison/comparison.json` and per-run manifests provide the audit data. These local artifacts will not accompany a fresh checkout.

Fourteen offline tests passed, covering scoring, duplicate/missing rows, hallucinations, usage billing, incomplete output, key handling, and answer-key revisions. All nine provider configurations were exercised successfully with actual images. Application tests were not run because application code was not changed.

For implementation, give tasting-card extraction a dedicated output budget instead of sharing the current 1,024-token label limit; preserve at least the tested 1,568px image detail; add the selected provider adapter and normalized usage accounting; and update the Anthropic-only AI-sharing disclosure. Keep extraction separate from taste recommendations. Validate this configuration on a larger, independently labeled held-out photo set before rollout. See the [current routing](../../supabase/functions/chat/index.ts), [tasting-card scanner](../../components/TastingMenuScanner.js), and [provider disclosure](../../lib/aiConsent.js).
