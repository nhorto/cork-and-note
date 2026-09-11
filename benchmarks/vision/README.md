# Wine vision benchmark

Local extraction benchmark for wine cards and restaurant lists across Google, OpenAI, and Anthropic. It does not alter application routing or write to Supabase. See the [measured pilot findings](../../docs/research/vision-benchmark-pilot-2026-09-11.md) and [earlier market research](../../docs/research/vision-model-reassessment-2026-09-11.md).

## Setup and inputs

The pilot used Python 3.14.6. Install isolated dependencies:

```sh
python3 -m venv .vision-bench/venv
.vision-bench/venv/bin/python -m pip install -r scripts/vision-benchmark-requirements.txt
.vision-bench/venv/bin/python scripts/vision_benchmark.py import ~/Downloads/example.HEIC ~/Downloads/example.jpg
```

Import only explicitly selected photos. The importer copies and hashes originals, deduplicates them, and creates `.vision-bench/dataset.json`. That directory is gitignored: private images, labels, predictions, and reports stay local. Avoid moving private artifacts into tracked directories.

Manually transcribe each image into its `gold` array before inference. Every row needs `wine_name`; other supported fields are `producer`, `vintage`, `varietal`, `region`, `price_glass`, `price_bottle`. Values are strings, `null` for visibly absent information, or lists of accepted alternatives. Omit a key to exclude an ambiguous field from scoring. Preserve repeated wines appearing in multiple flights. For example:

```json
{"wine_name":"Reserve Chardonnay","producer":["Example","Example Winery"],"vintage":"2023","varietal":"Chardonnay","price_glass":"12","price_bottle":"35","region":null}
```

Set `gold_reviewed: true` after visual review, and record the reviewer and ambiguities. This flag does not imply independent human review: the initial pilot labels were transcribed by the assistant and await user review. Leave `gold: null` for inference-only samples. Gold remains in local snapshots and is never sent to a model.

To fetch the two public PDF controls, install Poppler (`brew install poppler` on macOS), then run:

```sh
.vision-bench/venv/bin/python scripts/vision_benchmark.py prepare-public
```

[public-cases.json](public-cases.json) records URLs, PDF hashes, page numbers, and factual extraction labels. Changed downloads are rejected pending review. Pages are rendered to JPEG; models receive no embedded PDF text. Both controls come from one winery and must remain separate from phone-photo results.

## Run paid inference

Set `GOOGLE_API_KEY` or `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` in the environment, or pass a local `--env-file`. Only those assignments are read; the file is not executed. Environment values take precedence. Keys are never written into snapshots or reports.

```sh
.vision-bench/venv/bin/python scripts/vision_benchmark.py run \
  --dataset .vision-bench/dataset.json \
  --only gemini-3.8-flash,gemini-3.5-flash-lite,gpt-5.6-luna,claude-haiku-4-5-20251001 \
  --edges 1000 1568 --repeats 2 \
  --max-requests 128 --max-cost 2 \
  --output .vision-bench/runs/evaluation-main
```

With eight images this example plans 128 calls. Omitting `--only` selects all nine configured models. Refresh [models.json](models.json) against official pricing before a new evaluation; expired introductory rates are rejected. Rate units are USD per million tokens. Budget caps apply to each output directory, not globally. Cost stopping uses returned usage and can overshoot by the final call or calls with unknown usage; it is not a provider billing limit. There are no automatic retries.

All models receive the same prompt, strict seven-field JSON schema, and JPEG bytes at each image size. EXIF orientation is applied; resizing uses Lanczos, JPEG quality 80, and drops metadata. Google uses high media resolution, OpenAI high image detail; both use low thinking/reasoning. Claude thinking is disabled. The output limit is 8,192 tokens, including provider-specific reasoning accounting where applicable. This tests extraction systems under these settings, not equal internal compute or an exact replay of the app's smaller response limits.

Jobs are shuffled with a recorded seed. Existing result files, including failures, are skipped on an identical rerun. Configuration, script hash, labels, and source hashes are snapshotted; changes require a new output directory. A missing key creates a skipped record; supply the key and use a fresh directory for that model. Each completed request is saved immediately. A crash between provider completion and local persistence can still require a duplicate paid request.

## Score and review without API calls

```sh
.vision-bench/venv/bin/python scripts/vision_benchmark.py report \
  --output .vision-bench/runs/evaluation-main
.vision-bench/venv/bin/python scripts/vision_benchmark_compare.py \
  .vision-bench/runs/evaluation-main --output .vision-bench/comparison
```

Open `.vision-bench/comparison/index.html` for filters, predictions, field differences, and images. `comparison.json` and `comparison.md` contain machine-readable and tabular results. The comparison script groups runs by their filename prefix before the first hyphen, source type, split, model, and resolution. Use matching prefixes only for provider shards of the same experiment. Per-run reports retain the original configuration and scorer hashes; only combine compatible scoring revisions/settings.

Scoring aligns rows one-to-one by name with a similarity threshold of 0.55; producer, vintage, and grape break ties. Alignment earns no fuzzy accuracy credit. Fields must match accepted labels after case, punctuation, spacing, and price normalization. Accents remain significant; grape percentages and the conjunction “and” are ignored. Wine-name/vintage field placement and grape wording can therefore cause strict errors even when a human could recover the intended value.

* **Field recall:** correct present gold fields / all present gold fields. Missed rows count against it; correctly empty fields do not inflate it.
* **Exact cards:** every labeled field correct, every wine found, no extra wines. Invented values in absent fields fail this measure.
* **Missing/extra rows and invented absent fields:** reported separately so high recall cannot hide fabricated entries. Row alignment should be visually audited for extreme hallucinations.
* **Cost:** returned billable token usage times snapshotted rates, including billed reasoning and cache discounts. Unknown usage is unknown cost. An uncached estimate is also shown. These are estimates, not invoices.
* **Latency:** network plus provider response time. Schema compilation and caching can affect it. Repeats and resized variants are not independent photos.

To correct an answer-key error, preserve the old dataset, record the image/field/old/new/evidence under a new `gold_revision`, and rescore **all** compared runs with the revision:

```sh
.vision-bench/venv/bin/python scripts/vision_benchmark.py report \
  --output .vision-bench/runs/evaluation-main --gold-dataset .vision-bench/dataset.json
```

Case IDs and source hashes must agree. Original run snapshots and raw predictions remain untouched. Regenerate the combined report afterward. Label revisions informed by inspecting model discrepancies must be disclosed; use a new held-out set for final deployment decisions.

## Verification

```sh
.vision-bench/venv/bin/python -m unittest discover -s scripts/tests -p 'test_vision_benchmark.py'
```

Tests cover matching, omissions, hallucinations, aliases, billing, incomplete responses, credential handling, and audited rescoring. They use no paid API calls. The pilot also exercised all nine configured models against real images and native structured outputs.
