# Vision model reassessment: labels, tasting cards, and restaurant wine lists

Follow-up: [actual photo benchmark and revised recommendations](vision-benchmark-pilot-2026-09-11.md) are now available. The research-only status and shortlist below describe the earlier assessment.

Research date: September 11, 2026. Recommendation only; no application behavior changed and no paid model evaluation performed. This supersedes the model-selection advice in the June wine-label-scanning research. The user's reported failed photo was not available for inspection, so the causes below are hypotheses supported by code inspection, not a diagnosis of that individual scan.

My first choice to evaluate is **Gemini 3.8 Flash**, followed by **GPT-5.4 mini** as a cost-conscious alternative and **Claude Sonnet 5** as the simplest provider-preserving option. Selection should depend on accurate extraction of real wine photos, measured cost, and latency.

**What the repo does today**

| Flow | Model | Image handling | Output ceiling |
| --- | --- | --- | --- |
| Bottle label | Haiku 4.5 | Default 1,000px longest edge | 1,024 tokens |
| Winery tasting card | Haiku 4.5 through `label_scan` | Default 1,000px longest edge | 1,024 tokens |
| Restaurant wine-list extraction | Haiku 4.5 | Up to three photos, each capped at 1,568px | 4,096 tokens |
| Wine-list recommendations | Sonnet 4.6 | Uses extracted entries and taste context | 1,536 tokens |
| Ordinary sommelier photo chat | Sonnet 4.6 | Default 1,000px longest edge | 1,024, or 2,048 with search enabled |

Evidence: [model routing and output budgets](../../supabase/functions/chat/index.ts), [image preprocessing](../../lib/ai.js), [tasting-card capture](../../components/TastingMenuScanner.js), [card task selection and prompts](../../lib/cellarScan.js), [restaurant scan](../../lib/wineList.js), and [search eligibility](../../supabase/functions/_shared/entitlements.ts).

The tasting-card implementation has two additional constraints worth correcting alongside model selection: small print loses detail at 1,000px, and six fields per wine can exhaust a 1,024-token response. The card parser accepts up to 24 wines, but that does not increase the generation budget. A stronger model cannot recover pixels removed before upload, and truncated JSON can fail even when the image was read correctly.

The extraction prompts also allow inferred grapes while instructing the model not to guess. Separate literal transcription from optional wine knowledge so inferred information is not presented as printed evidence. Enforced JSON schemas improve output shape, but cannot guarantee that a vintage or producer was read correctly.

**Candidates and prices**

USD, standard synchronous API rates, per million tokens. Excludes caching, batch discounts, tools, regional premiums, and taxes. The example column is a normalized workload: **2,000 total billable input tokens, including images, plus 1,000 total billable output tokens per request**. It compares rates; it does not predict the token count of the same photo on different providers. Reasoning tokens, where billed as output, must fit into that assumption or be added.

| Model | Input / 1M | Output / 1M | 1,000 normalized requests | Assessment |
| --- | ---: | ---: | ---: | --- |
| Haiku 4.5, baseline | $1.00 | $5.00 | $7.00 | Retain as an evaluation control |
| Gemini 3.8 Flash | $0.75 | $3.75 | $5.25 | Leading quality/cost candidate at current rates |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | $3.10 | Budget challenger for simpler scans |
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 | $2.00 | Older economical comparison point |
| GPT-5.6 Luna | $0.20 | $1.20 | $1.60 | Low-price challenger; comparable visual score not found |
| GPT-5.4 mini | $0.75 | $4.50 | $6.00 | Attractive OpenAI alternative with published visual evidence |
| GPT-5.6 Terra | $2.00 | $12.00 | $16.00 | Stronger visual benchmark evidence, higher cost |
| Claude Sonnet 5 | $2.00 | $10.00 | $14.00 | Simplest provider-preserving candidate |

Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

Gemini 3.8 Flash's introductory rates end December 31, 2026. Scheduled January rates are $1.50 input / $7.50 output, making the normalized example **$10.50 per 1,000 requests**. Sonnet 5's $2/$10 rate is now standard; the previously planned September increase was canceled. Both details are documented on the providers' pricing pages above.

An additional specialized option is **Mistral OCR 4.1**: $4 per 1,000 pages for OCR, or $5 per 1,000 annotated pages. It supplies text with layout and confidence information. It is worth evaluating if card layout remains the dominant problem; raw OCR still needs mapping into our wine schema. Its annotated option offers structured extraction. [Model and pricing](https://docs.mistral.ai/models/ocr-4-1).

**What the benchmarks establish**

CharXiv Reasoning measures interpretation of scientific charts: useful evidence for combining text and spatial layout, but not a wine-card OCR accuracy test. Higher is better. These are provider-published results, not an independent evaluation we ran. Rows from different releases are labeled rather than treated as a perfectly controlled league table.

| Model | CharXiv, no tools | Publication cohort |
| --- | ---: | --- |
| Gemini 3.8 Flash | 86.2% | Google, September 2026 |
| GPT-5.6 Terra | 85.9% | Google, September 2026 |
| Claude Sonnet 5 | 70.1% | Google, September 2026 |
| GPT-5.4 mini | 80.3% | Google, July 2026 |
| Gemini 3.5 Flash-Lite | 74.5% | Google, July 2026 |
| Gemini 3.1 Flash-Lite | 73.2% | Google, July 2026 |
| Haiku 4.5 | 61.7% | Google, July 2026 |
| GPT-5.6 Luna | Not found | No comparable figure verified |

Sources: [September model card](https://deepmind.google/models/model-cards/gemini-3-8-flash/) and [July model card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/). Google's [July methodology](https://deepmind.com/models/evals-methodology/gemini-3-5-flash-lite) uses high thinking for Flash-Lite and maximum/best available reasoning for competitors, with CharXiv measured internally. The [September methodology](https://deepmind.com/models/evals-methodology/gemini-3-8-flash) also mixes internal evaluations and provider-reported results. Do not assume these scores at a low-reasoning production setting.

For a document-oriented comparison, Google's September table reports **GDP.PDF all-pass rates** of 35% for Gemini 3.8 Flash, 29% for Terra, and 28% for Sonnet 5. These are demanding document-comprehension tasks, not percentages of words read correctly. The 0.3-point CharXiv difference between Flash and Terra does not establish a meaningful accuracy advantage without variance estimates.

For OCR-specific context, Mistral reports **85.20 on OlmOCRBench** and **93.07 on OmniDocBench** for **OCR 4.0**. These are different metrics and must not be compared numerically with CharXiv or attributed to OCR 4.1. Mistral flags reference, formatting, and reading-order artifacts in those evaluations. [OCR 4.0 evaluation](https://mistral.ai/news/ocr-4/).

No source reviewed establishes a wine-label, tasting-card, or restaurant-menu accuracy rate for these exact candidates. User corrections and hallucinated vintages matter more here than a general intelligence ranking.

**How photo cost changes the comparison**

Image tokens are provider-specific. For example, Google documents approximately 1,120 image tokens at high resolution and 2,240 at ultra-high for Gemini 3. [Media resolution](https://ai.google.dev/gemini-api/docs/media-resolution).

As a concrete illustration, one ultra-high Gemini image, 500 prompt tokens, and 1,000 billed output tokens costs approximately **$0.005805 on Gemini 3.8 Flash**, or **$5.81 per 1,000 requests** at current rates. Add reasoning beyond that output allowance, extra images, and retries. This is an assumed workload, not a measured app bill.

OpenAI documents model-specific patch/tile accounting; current GPT-5.4 mini and GPT-5.6 models support higher-detail image input. The earlier repo estimate for GPT-4o-mini should not be reused: that model's image-token accounting differs substantially from its cheap-looking text rates. [Official vision accounting](https://developers.openai.com/api/docs/guides/images-vision).

Measure cost per successful, acceptably correct scan, including retries. For a two-model route, expected cost is initial-call cost plus retry fraction times fallback cost. A cheaper call is not cheaper overall when users must repeatedly retake photos.

**Three recommendations**

1. **Gemini 3.8 Flash — first choice to evaluate as the default.** It has persuasive visual/document evidence at a practical price. Start with dense cards and restaurant lists, using a resolution setting that preserves fine print. Evaluate both current and scheduled January economics. Integration needs a Google provider adapter, server-held key, response/usage normalization, and updated provider disclosure. The model is listed as stable in the [Gemini catalog](https://ai.google.dev/gemini-api/docs/models).
2. **GPT-5.4 mini — economical OpenAI alternative.** Its visual results justify testing it despite newer OpenAI models existing. It supports image input and structured outputs at rates below Haiku's. Test high/original detail and an explicit reasoning setting. Terra is a useful quality comparator if mini still misses dense text, but its higher price needs a demonstrated improvement on our photos. [OpenAI mini capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
3. **Claude Sonnet 5 — shortest integration path.** It preserves the current Anthropic transport and is worth testing as an immediate quality-oriented replacement. Its practical advantage is implementation effort; the evidence reviewed does not make it the vision leader. Confirm the new model's request parameters and output behavior rather than assuming a literal string change is sufficient. [Anthropic model IDs and capabilities](https://platform.claude.com/docs/en/models/overview).

Gemini 3.5 Flash-Lite and Luna remain budget challengers, not assumed replacements. Given the reported failures, establish an acceptable quality baseline before optimizing for the lowest token price.

**Evaluation and implementation proposal**

Use about 100 consented, manually transcribed photos, emphasizing tasting cards: 50 cards, 25 labels, and 25 restaurant-list images. Include glare, small print, columns, slanted shots, decorative fonts, handwriting, non-English names, and partially unreadable images. Include the reported failure once available. Split development examples from a held-out set; do not tune on the final test set.

Run two comparisons: identical current preprocessing to isolate model changes, then each shortlisted model with a tuned image path to compare deployable systems. Keep output schemas and extraction rules equivalent; record model versions, image dimensions, detail/thinking settings, billed tokens, latency, and retry counts. Give multi-wine extraction enough output space and explicitly record truncation.

Score wine-row precision/recall, exact producer/name/vintage accuracy, association of the correct price and vintage with each row, invented fields, valid JSON, whole-card correctness, and user correction effort. Measure median/p95 latency and actual cost per successful scan. Score recommendations separately: a tasteful explanation cannot repair a wine that was misread upstream.

After choosing a model, give tasting cards their own task/budget, preserve full readable detail or use overlapping crops, and require source-grounded fields with nulls for unreadable text. Crop from the original image, not an already reduced copy. If a fallback is used, trigger it on missing rows, inconsistent fields, unreadable regions, or validation failures, and evaluate those triggers; a model's self-reported confidence alone is insufficient.

The restaurant workflow already separates extraction from recommendations. Keep that boundary and supply validated entries to the taste-based recommendation step. Ordinary chat photos are a separate Sonnet route and should be assessed explicitly if the desired change covers every image feature.

Before a provider change, update [AI-sharing disclosure](../../lib/aiConsent.js), which currently names only Anthropic, and review the associated consent behavior. This is a concrete integration requirement, not a blocker to this research. No user photos were sent to additional providers during this assessment.
