# Sommelier chat: which model, at what cost

September 11, 2026. Scope: the free-form sommelier text chat only (task `chat` in `supabase/functions/chat/index.ts`, currently `claude-sonnet-4-6` with no thinking). Label scans, wine-list scans and the guided Pro tools are out of scope; the vision work is in `vision-benchmark-pilot-2026-09-11.md`.

Everything below was produced by code in `scripts/sommelier-eval/` (README there). Nothing was estimated by hand. Total spend for the pass: $51.96 (generation $11.94, judging $39.16, quiz $0.86).

## TL;DR

1. **The current model is the weakest reasonable choice.** Every affordable candidate except Haiku 4.5 beat Sonnet 4.6 in blind pairwise judging, and most cost less per message.
2. **GPT-5.6 Sol at low reasoning effort is the recommendation**: 88% win rate vs current (both judges agree 84% of the time), the fewest substantive faults among non-frontier models, the shortest answers (124 words vs 274), 8.7 s vs 18.9 s latency, and 25% cheaper per message ($0.023 vs $0.031).
3. **GPT-6 Astra is the quality ceiling** (90% win, fewest substantive faults of all) at 1.9x current cost. Even at that price the heaviest observed user-month costs $2.03 against $8.49 net revenue, so it is affordable if the sommelier is the headline feature. Its verdicts come from one judge (Fable), so treat the 90% as directional.
4. **Gemini 3.1 Pro (preview) is the value pick**: 86% win, 100% on the wine-theory quiz, $0.017 per message (0.55x). Downsides: still a preview model, and answers run long (216 words).
5. **Staying on Anthropic means Sonnet 5 low** (74% win, 0.71x cost), not Opus 5 (62%, 1.28x) or Fable (51%, 2.2x). The Claude models lost mostly on length and formatting, which a prompt can fix, but Sonnet 5 also made two producer errors the judges caught (Quilt attributed to Huneeus; a Sinegal/Grassi mix-up) and Opus 5 invented production details for an obscure Cooper's Hawk blend.
6. **Web search, not the model, is the biggest cost line**, and the current setup logs none of it: `chat_usage` stores only `input_tokens`, which excludes the cached prefix that Anthropic's search loop re-reads on every iteration. Real Sonnet 4.6 cost is ~3.1 cents per Pro message, 2.4x what the log suggests.

## How it was measured

- **Cases**: 41 frozen prompts, 30 verbatim from real users in the `messages` table (pairings, "based on my tastes what should I try", a long run of bare Cooper's Hawk wine names, Virginia questions) plus 11 gap-fill cases (cellar drink-window, guardrails, multi-turn follow-ups, a small Virginia producer that needs search). A fixture user modelled on the testers (Northern Virginia visits, Cooper's Hawk, Napa Cab lover, 14-lot cellar) feeds the real `buildSommelierPrompt()` from `lib/sommelierPrompt.js`.
- **Configs**: 11, all Pro (web search on) and at low reasoning effort. The Anthropic request mirrors the edge function byte for byte apart from the model line; OpenAI (Responses API, `web_search`) and Google (`generateContent`, Google Search grounding) are what we would ship if that vendor won.
- **Grading**: each candidate answer vs the frozen Sonnet 4.6 answer, A/B randomised, judged blind by Fable 5.1 and GPT-6 Astra against a rubric (accuracy, uses the user's context, answers the question, chat-sized, app format rules, safety rules). A judge never rates a pair containing its own model. Overall judge agreement 73%.
- **Side metric**: SommBench Wine Theory QA, the 128 English questions (arXiv 2603.12117, CC BY 4.0), no system prompt, no search.
- **Cost**: each call's own `usage` x list prices, including cache reads/writes and per-search fees.

## Results

### Quality vs the current model

Win = 1 when the candidate beat Sonnet 4.6, 0.5 tie, 0 lost; mean over the judges that ruled; 95% CI over 41 cases.

| config | win | CI | Fable | Astra | agree | words |
|---|---|---|---|---|---|---|
| GPT-6 Astra low | 90% | ±9 | 90% | (self) | n/a | 130 |
| GPT-5.6 Sol low | 88% | ±8 | 88% | 86% | 84% | 124 |
| Gemini 3.1 Pro low | 86% | ±10 | 89% | 79% | 85% | 216 |
| GPT-5.6 Luna low | 80% | ±10 | 71% | 90% | 76% | 153 |
| GPT-5.6 Terra low | 80% | ±9 | 88% | 73% | 71% | 158 |
| Sonnet 5 low | 74% | ±10 | 79% | 70% | 68% | 229 |
| Opus 5 low | 62% | ±11 | 80% | 44% | 51% | 272 |
| Gemini 3.8 Flash low | 59% | ±13 | 62% | 54% | 69% | 261 |
| Fable 5.1 low | 51% | ±15 | (self) | 51% | n/a | 308 |
| Sonnet 4.6 (current) | ref | | | | | 274 |
| Haiku 4.5 | 45% | ±13 | 50% | 40% | 68% | 164 |

Astra was harsher on the Claude models than Fable was (Opus 5: 80% vs 44%). Both judges rated the GPT models highly, so the cross-family bias runs mostly one way; discount the Claude numbers a little and the Astra number a little.

### Substance vs style

The judges list faults per answer. Splitting them into prompt-tunable style faults (length, headers, emoji, em dashes, tone) and model-intrinsic substance faults (wrong or invented facts, ignoring the user's context, fabricated "logged it" actions, misused `wine_suggestions` block, poor search judgment), per verdict:

| config | style | substance | of which fabrication |
|---|---|---|---|
| GPT-6 Astra low | 1.27 | 0.44 | 0.05 |
| Gemini 3.1 Pro low | 1.23 | 0.48 | 0.11 |
| GPT-5.6 Sol low | 0.99 | 0.62 | 0.12 |
| GPT-5.6 Terra low | 1.32 | 0.70 | 0.11 |
| GPT-5.6 Luna low | 1.17 | 0.76 | 0.10 |
| Sonnet 5 low | 1.48 | 0.77 | 0.12 |
| Opus 5 low | 1.54 | 0.96 | 0.30 |
| Gemini 3.8 Flash low | 1.43 | 0.97 | 0.30 |
| Haiku 4.5 | 1.34 | 1.06 | 0.13 |
| Fable 5.1 low | 1.44 | 1.10 | 0.27 |
| Sonnet 4.6 (current, same pairs) | | 0.81 to 1.12 | |

Examples of substance faults the judges caught: Sonnet 5 attributed Quilt to the Huneeus family (it is Joe Wagner's Copper Cane label) and stitched a Grassi estate wine into a Sinegal answer; Opus 5 "confidently invents production details (infused for a few days with specific spices) for the wrong wine" on CHMX; Sol invented today's date and filled in `overall_rating` for wines the user never rated; Gemini 3.8 Flash and Haiku most often invented tasting specifics for the house Cooper's Hawk bottlings. Every model passed every guardrail case (underage, medication, heavy drinking, off-topic); the Claude models lost those pairs only on length.

### Wine-theory quiz (SommBench WTQA-en, 128 questions)

Gemini 3.1 Pro 100%, Gemini 3.8 Flash 98.4%, GPT-5.6 Terra 97.7%, Opus 5 96.9%, Sonnet 4.6 93.0%, Fable 5.1 93.0%, GPT-5.6 Luna 92.2%, Sonnet 5 91.4%, Haiku 4.5 85.2%. Sol and Astra not run (OpenAI credits ran out; rerun is $0.30). For scale, the paper's best closed model scored 97% on the same task. Knowledge recall is not what separates these models for our use; context use and restraint are.

### Measured cost per Pro message

From this eval's usage (search on, fresh conversation each case, so cache writes are included):

| config | $/msg | x current | searches/msg | latency |
|---|---|---|---|---|
| GPT-5.6 Luna low | $0.0033 | 0.11x | 0.24 | 5.1 s |
| Haiku 4.5 | $0.0039 | 0.12x | 0.07 | 4.0 s |
| Gemini 3.8 Flash low | $0.0080 | 0.26x | 0.32 | 3.8 s |
| GPT-5.6 Terra low | $0.0142 | 0.46x | 0.37 | 6.6 s |
| Gemini 3.1 Pro low | $0.0170 | 0.55x | 0.15 | 9.8 s |
| Sonnet 5 low | $0.0219 | 0.71x | 0.54 | 12.1 s |
| GPT-5.6 Sol low | $0.0232 | 0.75x | 0.39 | 8.7 s |
| Sonnet 4.6 (current) | $0.0310 | 1.00x | 0.80 | 18.9 s |
| Opus 5 low | $0.0396 | 1.28x | 0.37 | 15.3 s |
| GPT-6 Astra low | $0.0598 | 1.93x | 0.80 | 8.6 s |
| Fable 5.1 low | $0.0694 | 2.23x | 0.27 | 18.5 s |

Per Pro user per month at the heaviest usage seen so far (34 messages): Sol $0.79, Astra $2.03, current $1.06, against $8.49 net on the monthly plan and $4.25 on annual. Break-even on the annual plan after Apple's 15%: Sol 183 messages a month, Astra 71, current 137. `node scripts/sommelier-eval/cost-model.mjs --measured .claude/hillclimb/sommelier-chat` prints the full table.

Two cost facts that hold regardless of model: Gemini 3.8 Flash's price doubles on 2027-01-01 (introductory pricing), and Google grounding is free for the first 5,000 requests a month, which at current volume makes Gemini search effectively free.

## Caveats

- 41 cases and one rep: the CIs are ±8 to ±15 points. Sol, Astra, Gemini 3.1 Pro, Luna and Terra are not separable from each other on win rate; all five are clearly separated from the current model and from Haiku.
- Length is a large part of what the judges rewarded. The current prompt says nothing about length, and the Claude models write 230 to 310 words at low effort. A "keep it to a few short paragraphs" instruction would narrow the gap for every model; it would not fix the substance faults listed above.
- Every model used em dashes because the prompt template itself does (#281). The `no_em_dash` check is therefore uninformative here and was excluded from the win rate.
- The judges are also candidates. Each abstained on its own model, so Astra's row is Fable-judged only and Fable's row is Astra-judged only.
- The fixture user is one persona. A user with an empty cellar and no tastings would exercise the models differently.

## Bugs surfaced (independent of the model choice)

- Raw `<cite index="...">` tags reach the chat bubble on searched replies; `textFromContent` does not strip them (#281).
- The chat prompt contains six em dashes, so no model avoids them (#281; #262 covered the Pro tools only).
- `chat_usage` does not record `cache_read_input_tokens` / `cache_creation_input_tokens`, so the dashboard under-reports Pro chat cost by more than half.
- A plain model-ID swap to any thinking model (Sonnet 5, Opus 5) would truncate answers: thinking tokens count against the edge function's `max_tokens` 1024/2048 and no `thinking` / `effort` config is sent. Haiku 4.5 needs the `web_search_20250305` tool variant.

## What switching would take

Staying on Anthropic (Sonnet 5): model line, `thinking: {type: "adaptive"}` + `output_config.effort`, larger `max_tokens`, a length instruction in the prompt. Half a day.

Moving chat to OpenAI (Sol or Astra): an OpenAI adapter in the edge function (Responses API, `web_search` tool, cached-input accounting), `OPENAI_API_KEY` as a Supabase secret with auto-recharge billing on the OpenAI account (it ran dry during this eval), the AI-sharing disclosure in `lib/aiConsent.js` (names Anthropic only; the Gemini vision branch already renewed consent for Google), `collectSources` for OpenAI citation annotations, and the same length instruction. Two to three days, plus a rerun of this eval on the shipped path before cutover.

## Recommended next steps

1. Nick reads eight pairs blind in `.claude/hillclimb/sommelier-chat/report.html` (transcripts link from each row) to confirm the judges' taste matches his. Suggested: `cellar-steak-tonight`, `id-coopers-chmx`, `try-next-tastings`, `guard-medication` for Sol, Astra, Sonnet 5 and Gemini 3.1 Pro.
2. Add a length instruction to the prompt and rerun the top four plus Sonnet 5 (about $12) so the decision is made on substance, not verbosity.
3. Pick between Sol (recommended) and Astra (ceiling). Then the edge-function work above, the #281 fixes, and cache-token logging in `chat_usage`.
