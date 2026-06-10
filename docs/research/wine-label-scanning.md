# Wine Label Scanning — How It Works, How the Industry Does It, and Our Options

**Repo:** `nhorto/cork-and-note` · **Epic:** #6 (Wine Cellar) · **Issue:** #59 (label-scan-to-add) · **Companion to:** [`docs/research/wine-cellar-ux.md`](./wine-cellar-ux.md) (§2.1 "adding a bottle")
**Status:** Research + recommendation. No production code changed by this document. A working v1 exists on branch `feat/cellar-label-scan` (PR #77), held pending this research.
**Date:** 2026-06-10
**Target user:** the wine **enthusiast** — owns *dozens* of bottles, wants to add them fast.
**The goal we are designing for:** a **fast Add-form prefill** the user confirms/corrects — *not* authoritative identification or data enrichment.

---

## 0. Why this document exists

We built a label-scan feature (PR #77) that "just worked," and the owner — rightly — paused to ask:

> "Can you explain how the label scan actually works? I thought we'd need to do research first to make sure we can get a database that lets us do this, and to see how other apps and products do it."

That instinct is correct: the **dominant industry approach is database-driven**, and it's worth understanding *why* our implementation needed no database, what we trade away by skipping one, and what the cost-tiered options (free and modest-paid) actually are. This document answers all three, then gives a recommendation for our stated goal (fast prefill).

**Bottom line up front:**

1. **The incumbents (Vivino, Delectable, InVintory) match the label *image* against a giant proprietary, crowd-built database of known labels.** Their accuracy comes from **database scale + crowd contributions + human moderation** — a multi-year data moat, not a clever algorithm. We are not going to build or license that, and we don't need to for "fast prefill."
2. **What we built is the emerging *indie* pattern: read the label with vision AI (OCR + reasoning) and infer the fields.** No database. It works on any label zero-day, is cheap, and reuses infrastructure we already have. It is weaker on ornate/cursive/curved/low-light labels and can occasionally guess wrong — which is exactly why our flow makes every field a **confirm/correct** prefill, never a silent save.
3. **The one thing worth changing before we ship:** we're calling **Claude Sonnet**, which is ~25× more expensive than it needs to be for "read a label, fill six fields." Switch the scan to a cheaper model (Haiku, GPT-4o-mini, or Gemini Flash). Our pinned model string is also now deprecated and should move regardless.

---

## 1. What we built, and how it actually works

The current v1 (PR #77, files `lib/cellarScan.js`, `lib/ai.js`, `components/LabelScanner.js`, `app/cellar/add.js`) does this:

1. **Capture.** The user snaps or picks a photo of the front label with `expo-image-picker` (the same camera the sommelier already uses — no new native dependency).
2. **Encode.** The app base64-encodes the image **on-device** (`aiService.photoToBase64`).
3. **Send.** It posts the image to our existing `chat` Supabase Edge Function, which forwards it to **Anthropic Claude (Sonnet, multimodal)** as an image block — the Edge Function already supported images for the sommelier's photo chat.
4. **Read + infer.** A system prompt instructs Claude to *read the printed text* and return JSON with `wine_name / producer / vintage / wine_type / varietal / region`, using `null` for anything not legibly on the label ("don't guess"). Claude does OCR plus light reasoning (e.g. a *Sancerre* label implies Sauvignon Blanc).
5. **Parse + sanitize.** We extract the JSON defensively (`parseLabelScan`), then `normalizeFields` whitelists the six fields, clamps vintage to a real 4-digit year, and maps `wine_type` to our known set. The label image and the model's text are treated as **untrusted, read-only data** — no instruction in them is ever executed.
6. **Prefill + confirm.** The parsed values prefill the Add form via the existing remount path. The user reviews and **tap-corrects** any miss before saving. We never dump scanned values into a blank form or save them silently.

**The key fact:** there is *no wine database* in this pipeline. We are not matching the photo against a catalog of known wines. We use a general-purpose vision model to **read** the label. That is a deliberate architecture, and it is *different* from how the market leaders work.

---

## 2. How the industry actually does it

There are three families. Our v1 is in the third.

| Family | Who uses it | Mechanism | Where accuracy comes from |
|---|---|---|---|
| **A. Label image-match ("fingerprint") against a proprietary DB** | **Vivino, Delectable, InVintory**, TinEye WineEngine, API4AI | The photo is reduced to a visual fingerprint (typography, crest, color, artwork, layout) and matched against fingerprints of *known label images*. Returns the canonical wine entity (+ ratings, price, vintage). | **DB scale + crowd contributions + human moderation.** |
| **B. Barcode / UPC scan → product lookup** | CellarTracker, Wine-Searcher (QR), many cellar apps | Scan the back-label barcode, look up the UPC/EAN in a product DB. | The UPC database — which for wine is **poor**. |
| **C. OCR / LLM "read & infer"** | Newer indies (Wine Scanner AI, Vinet, "Expo sommelier" builds) — **and our v1** | On-device OCR or a vision LLM reads the label text and infers structured fields. | The **model**, not a database. |

### 2.1 Family A is the incumbent winner — and it's a moat, not an algorithm

- **Vivino** uses PTC/Qualcomm **Vuforia Cloud Recognition** for single-bottle label matching (a separate ABBYY OCR pipeline handles *restaurant wine lists*). Its vendor case study claims ~**97.5% auto-recognition** with the remainder hand-matched by a data team — *treat that figure as marketing.* Scale figures drift by year (≈8M wines in 2016 → "16–17M wines / 2.7B label scans" in recent press).
- **Delectable** published a 2015 paper describing an explicit **machine-recognition + human-in-the-loop** hybrid: hard photos (lighting, angle, near-identical same-producer labels) are routed to humans.
- **InVintory** matches **label text against its own 2M+ bottle DB** and *deliberately rejects barcodes* ("only ~50% of wines have a UPC").

**Why image-match is accurate:** it matches the *whole label as a visual object*, so it disambiguates wines whose text is nearly identical (same producer/cuvée, different vintage) and survives ornate/foil/curved/low-light labels where OCR fails. But its accuracy **scales with the database, not the model** — a photo only resolves if a matching reference image already exists. The moat requires (1) millions of reference images kept current as new vintages ship every year, (2) a crowd supplying photos of unrecognized bottles, and (3) moderation/human-in-the-loop to keep the crowd data clean. **This is a multi-year data-and-community investment, not something we can or should build for a cellar feature.**

### 2.2 Family B (barcode) is common but weak for wine — *do not make it primary*

Both CellarTracker and InVintory independently report that **~50% of wines have no UPC at all**, the same wine maps to many barcodes, and the same barcode is reused across different wines. Critically, **the vintage is never encoded in a UPC** — the single most important field for a cellar. A barcode is a fine *fast-path when present*, never the primary recognizer.

### 2.3 Family C (OCR/LLM read) is the pragmatic indie escape hatch — *this is us*

Reading the label with a vision model needs **no proprietary DB**, works on any wine the model can reason about, and is cheap to ship. The trade-offs are real and we should be honest about them:

- Depends on **legible text** — fails on ornate/foreign/foil/low-light labels exactly where image-match shines. (A VLM benchmark scored ~31% on purely *decorative* fonts; most real labels are mostly printed, so this is a tail risk, not the common case.)
- The model can **hallucinate** a vintage or producer — mitigated by our "use null, don't guess" prompt + validation, and by the user's confirm/correct step.
- **No canonical entity, ratings, price, or verified appellation** unless we separately query a data source.
- Accuracy comes from the model, so it **can't be improved by our own users' data** the way a fingerprint DB can.

For "fast prefill the user confirms," these trade-offs are acceptable — and avoided entirely by the human-in-the-loop being *the user themselves*.

---

## 3. Our options (cost-tiered: free and modest-paid)

The owner asked specifically for **free** options and **modest-paid** options. Two separate decisions: (a) the **recognition tech** that turns a photo into fields, and (b) an optional **data source** to verify/enrich the result. The goal is prefill, so (b) is optional/future.

### 3.1 Recognition tech — turn a photo into fields

Cost is per **1,000 scans**. Image≈1,000–1,600 vision tokens + ~300 output; math in the source notes.

| Option | How it works | Wine-label accuracy | Cost / 1,000 | Offline? | Expo effort |
|---|---|---|---|---|---|
| **On-device OCR** (Apple Vision / Google ML Kit, via Infinite Red `react-native-mlkit`) | Free OCR returns text lines; *you* map lines → fields | Good on printed text; weak on cursive/foil/curved. OCR-only | **$0** | ✅ yes | Dev build required (not Expo Go); config plugin |
| **Tesseract** (`tesseract.js`) | Classic OCR in JS | Weakest; poor on stylized fonts; slow | **$0** | ✅ | Awkward in RN — **skip** |
| **Cloud OCR** (Google Cloud Vision / Azure Read / AWS Textract) | Server OCR API | Strong printed-text; still needs a parse step | **~$1.50** (1k free/mo) | ❌ | Easy — plain HTTPS from the Edge Function |
| **Claude Sonnet vision — *current*** | Image → Edge Function → Claude → JSON in one shot | Best-in-class read + structures fields directly | **~$7–11** (≈$9) | ❌ | **Already wired** |
| **Claude Haiku 4.5 vision** | Same flow, cheaper model | Slightly below Sonnet; very capable | **~$3–4** | ❌ | **One-line model swap** |
| **GPT-4o-mini vision** | Same flow, OpenAI | Good read + reliable JSON (`response_format`) | **~$0.38** | ❌ | New provider key + call |
| **Gemini 2.5 Flash vision** | Same flow, Google | Strong read; native JSON-schema; has a free tier | **~$1.05** (free tier) | ❌ | New provider key + call |
| **Hybrid: on-device OCR → cheap LLM parse** | Free OCR on device, send only the *text* to a cheap LLM to structure | OCR ceiling caps it; cheapest paid path; better privacy (image never leaves phone) | **~$0.23** (or $0 regex) | OCR ✅ | Dev build for OCR + a text-only LLM call |

**Reading of the table for our goal:**
- **Best free:** on-device **ML Kit / Apple Vision OCR** + a small field-mapper. Truly $0, offline, private — but OCR-only (you map text→fields yourself) and it needs a **dev build** (no Expo Go). Pair with our confirm/correct UX to absorb its weaker reads.
- **Best modest-paid:** **GPT-4o-mini** (~$0.38/1k, ~25× cheaper than our current Sonnet path) or, to stay on Anthropic with a one-line change, **Claude Haiku 4.5** (~$3/1k). **Gemini 2.5 Flash** (~$1/1k + free tier, first-class JSON schema) is a close third. All keep the single-call "image → fields" UX with **no native module**.
- **Our current Sonnet path works but is overkill** at ~$9/1k for a task that doesn't need Sonnet-grade reasoning. Also: our pinned `claude-sonnet-4-20250514` is now **deprecated** — migrate regardless.

### 3.2 Optional data sources — verify/enrich (future, not required for prefill)

If we ever want to move from "read the label" toward "*verify* it's really this wine" or pull in ratings/price/drink-window, these are the realistic sources. The owner's stated goal is prefill, so these are **parked**, but recorded for completeness and the modest-paid tier.

| Source | Returns | Access | Pricing | Indie-usable? |
|---|---|---|---|---|
| **grapeminds Wine API** | Wines/producers/regions/grapes/pairings/drink windows; fuzzy search; a label-photo endpoint | Freemium, self-serve key | 14-day trial; paid tiers not public; **photo endpoint is Enterprise-only** | ✅ Best self-serve fit for *text* verify |
| **Open Food Facts** | Barcode → product name/brand, sometimes ABV | **Open / free** (ODbL) | Free | ✅ but **thin wine coverage, no vintage** — best-effort only |
| **UPCitemdb / Go-UPC** | UPC → title/brand | Freemium | 100 req/day free | ✅ as a barcode fallback; weak wine semantics |
| **Global Wine DB (`db.wine`)** | Producer-controlled vintage records | API **waitlisted** | Winery tiers ~$19–33/mo; dev API gated | ⚠️ Apply; coverage is opt-in/sparse |
| **Wine-Searcher API** | Critic score, producer, region, ABV, **market price** across merchants | **B2B / trade-gated** | ~**$250/mo** (500 calls/day) and up | ⚠️ Gold standard for *price*, but pricey + caching/redisplay restrictions — only if pricing becomes a core feature |
| **API4AI Wine Recognition** | Image → matched label name/type/vintage + confidence | Self-serve cloud | Free demo; usage-based | ✅ Cheapest turnkey *image-match-as-a-service* if we ever want Family-A behavior without a DB |
| **TinEye WineEngine** | Image → match against **your own** label corpus | Hosted | from ~$200/mo | ❌ You must supply + maintain the images — not a shortcut |
| **Vivino** | (everything) | **No public/partner API** — scrapers only | — | ❌ Don't build on it (TOS/GDPR) |

**Barcode verdict:** not worth it as a primary path for wine (no vintage, ~50% have no UPC). A **free barcode fast-path** (`expo-camera` built-in scanner → Open Food Facts → UPCitemdb fallback) is a cheap optional shortcut for the minority of bottles that resolve — never for vintage. Low priority.

---

## 4. Recommendation

Given the goal (**fast prefill the user confirms**) and budget (**free + modest-paid**):

1. **Keep the OCR/LLM "read & infer" architecture.** It is the correct indie choice for prefill. Building or licensing a Family-A fingerprint database is out of scope, and authoritative matching is explicitly *not* the goal. The confirm/correct UX is what makes "read & infer" safe — keep it.
2. **Switch the scan off Claude Sonnet to a cheaper model.** In rough order of effort/return:
   - **Cheapest one-line win:** point the scan at **Claude Haiku 4.5** (~3× cheaper, stays in our Anthropic billing + existing Edge Function). ⚠️ The `chat` Edge Function is **shared with the sommelier** — branch on a request flag (e.g. `task: 'label_scan'`) so we change the model for *scanning only*, not the whole sommelier.
   - **Biggest cost win:** add a **GPT-4o-mini** (~$0.38/1k) or **Gemini 2.5 Flash** path — ~25× cheaper, with first-class structured-JSON output.
   - **Cheapest + most private at scale:** the **on-device OCR → cheap-LLM-parse hybrid** (~$0.23/1k, image never leaves the phone) — but it needs a dev build, so defer unless cost/privacy becomes pressing.
3. **Migrate off the deprecated `claude-sonnet-4-20250514` string** regardless of the above.
4. **Harden the read** with a strict-JSON / schema-enforced output mode on whichever model we pick (GPT-4o-mini `response_format`, Gemini `responseSchema`, or a tightened Claude prompt) — reduces parse failures.
5. **Park enrichment/verification** (grapeminds, Wine-Searcher, image-match APIs) as a *future* "authoritative match" track, to revisit only if the owner later wants real ratings/price/verified appellation. Filed as an open question (§6), not built now.
6. **Optional, low-priority:** a free barcode fast-path for the bottles that happen to resolve.

This keeps v1 essentially as designed, removes the only real wart (cost/model), and avoids a database we don't need.

---

## 5. What this means for PR #77 / issue #59

The v1 on `feat/cellar-label-scan` is **architecturally sound for the stated goal**. The defensive parsing, prompt-injection stance, whitelist normalization, and confirm/correct UX are all right and should stay. The research surfaces **one change worth making before merge** and a couple of optional follow-ups:

- **Before merge (recommended):** route the scan to a cheaper model (Haiku via a `task` flag on the Edge Function, or a GPT-4o-mini/Gemini path) and stop pinning the deprecated Sonnet string. This is a small change to `supabase/functions/chat/index.ts` + `lib/cellarScan.js`.
- **Optional follow-ups (new issues):** (a) strict-schema output mode; (b) free barcode fast-path; (c) a future "authoritative match + enrich" spike if we ever want ratings/price.
- **No database, no migration, no new native dependency, no dev-build rebuild** is required for the recommended path — the same as v1 today.

If the owner is happy to ship v1 as-is and optimize the model in a fast-follow, #77 can merge unchanged; otherwise we make the model change first, then merge.

---

## 6. Open questions / future work

- **Do we ever want authoritative identification + enrichment** (real ratings, market price, verified appellation, a canonical wine ID to link tasting notes to)? If yes, that's a Family-A/data-source track: grapeminds or `db.wine` for data, API4AI for turnkey image-match, Wine-Searcher (~$250/mo) for price. Not now.
- **Could our *own* cellar data seed a lightweight match later?** As users add confirmed bottles, we accumulate (label photo → confirmed fields) pairs — a tiny, private seed of the Family-A idea. Worth keeping in mind, not building.
- **Privacy:** every cloud/LLM option uploads the image. The on-device-OCR hybrid uploads only extracted *text* (or nothing). If image privacy ever matters, that's the lever.

---

## 7. Sources

**How the industry does it**
- Vivino / Vuforia case study: https://www.ptc.com/en/case-studies/vivino
- Vivino OCR (ABBYY, wine lists): https://diginomica.com/uncorking-wine-information-with-ocr-technology-at-vivino · https://www.abbyy.com/company/news/abbyys-ocr-helps-power-vivino-the-worlds-most-popular-wine-app/
- Jancis Robinson, best label-scanning apps: https://www.jancisrobinson.com/articles/best-wine-labelscanning-apps
- Delectable SPIE paper (Wang et al., 2015): https://www.spiedigitallibrary.org/conference-proceedings-of-spie/9408/94080K/Instant-wine-recognition-on-mobile-devices--Delectable-the-social/10.1117/12.2085569.short
- Wine-label recognition comparison (Vivino/TinEye/API4AI/Delectable): https://api4.ai/blog/wine-label-recognition-comparing-vivino-tineye-api4ai-and-delectable
- CellarTracker UPC/EAN coverage: https://support.cellartracker.com/article/10-about-upc-and-ean-barcodes
- InVintory UPC unreliability / label scan: https://help.invintory.com/en/articles/10910582-can-i-scan-upc-barcodes · https://help.invintory.com/en/articles/14301437-how-to-add-wines-by-scanning-a-label
- OCR+LLM indie approaches: https://ai.google.dev/competition/projects/winescannerai-remember-the-right-wine · https://vinetwine.ca/en-ca/en-ca/ai-powered-wine-label-recognition-on-ios-in-march-2025 · https://expo.dev/blog/camera-powered-sommelier-with-expo

**Recognition tech & cost**
- Claude API pricing + vision token formula: https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/build-with-claude/vision
- OpenAI pricing (GPT-4o-mini): https://openai.com/api/pricing/ · image token math: https://www.oranlooney.com/post/gpt-cnn/
- Gemini pricing (2.5 Flash + free tier): https://ai.google.dev/gemini-api/docs/pricing
- Google Cloud Vision pricing: https://cloud.google.com/vision/pricing · AWS Textract: https://aws.amazon.com/textract/pricing/ · Azure AI Vision: https://azure.microsoft.com/en-us/pricing/details/computer-vision/
- On-device OCR for Expo/RN (Infinite Red ML Kit): https://docs.infinite.red/react-native-mlkit/ · https://github.com/infinitered/react-native-mlkit · https://www.npmjs.com/package/@react-native-ml-kit/text-recognition
- VisionCamera community OCR plugins / Expo Go limitation: https://react-native-vision-camera.com/docs/guides/frame-processor-plugins-community · https://github.com/mrousavy/react-native-vision-camera/issues/2670
- Decorative-font VLM weakness: https://arxiv.org/html/2503.23768v3 · curved-label OCR difficulty: https://towardsdatascience.com/how-to-read-a-label-on-a-wine-bottle-using-computer-vision-part-1-25447f97a761/

**Data sources & barcode**
- Wine-Searcher API: https://www.wine-searcher.com/trade/api · https://www.wine-searcher.com/trade/ws-api
- Global Wine Database / db.wine: https://www.db.wine/ · https://www.enolytics.com/enolytics101/2018/7/19/accurate-data-controlled-by-producers-a-case-study-of-the-global-wine-database
- grapeminds Wine API: https://grapeminds.eu/developers · https://github.com/grapeminds/api-examples
- TinEye WineEngine: https://services.tineye.com/WineEngine · API4AI Wine Recognition: https://api4.ai/apis/wine-rec · Zyla: https://zylalabs.com/api-marketplace/machine+learning/wine+label+recognition+api/825
- Barcode/UPC: https://world.openfoodfacts.org/data · https://devs.upcitemdb.com/ · https://go-upc.com/plans/api
- Vivino (no API — scrapers only): https://github.com/aptash/vivino-api
- Expo barcode scanning: https://docs.expo.dev/versions/latest/sdk/camera/ · https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md

**Confidence caveats:** Vivino's 97.5% figure is vendor marketing. Incumbent "no public API" is inferred from absence of developer docs. Cloud/LLM pricing drifts — verify before committing (esp. Azure S1, AWS Textract's 3-month-only free tier, Gemini free-tier training-use terms). Wine-Searcher and grapeminds block automated fetches, so their exact tiers/caching terms must be confirmed with the vendor before integrating.
