# Sommelier chat model eval

Which model should power the Cork & Note sommelier chat (the `chat` task in
`supabase/functions/chat/index.ts`)? Two questions, two tools:

1. **What does each candidate cost us?** `cost-model.mjs`, no API calls. Prices
   every candidate against the real per-message usage recorded in
   `public.chat_usage` (snapshot in `chat-usage-snapshot.json`), then per Pro
   user per month against net subscription revenue. Its assumptions are printed;
   `--measured <flow dir>` replaces them with usage the eval actually recorded.
2. **Which one answers better?** A blind pairwise eval on 41 frozen prompts
   (30 verbatim from the app's real conversations, 11 gap-fill), each candidate
   vs the current Sonnet 4.6, judged by two models from different families, plus
   SommBench's 128-question wine-theory quiz as a knowledge side metric.

```
node scripts/sommelier-eval/cost-model.mjs                       # cost table, no spend

# 1. generate answers (Pro config: web search on) - one variant, or --all
node scripts/sommelier-eval/run.mjs --variant baseline --env-file ~/testProject/.env --env-file <openai env> --env-file <gemini env>
node scripts/sommelier-eval/run.mjs --all ...

# 2. judge every candidate against the frozen baseline answers
node scripts/sommelier-eval/judge.mjs --all ...

# 3. wine-theory quiz (no system prompt, no search)
node scripts/sommelier-eval/sommbench.mjs --all ...

# 4. report
R=<claude-api skill dir>/shared/evals/report; node $R/build-report-lite.mjs .claude/hillclimb/sommelier-chat/
node scripts/sommelier-eval/cost-model.mjs --measured .claude/hillclimb/sommelier-chat
```

Every script takes `--mock` (no spend, exercises the pipeline), `--cases a,b`
(subset), `--env-file` (repeatable; only `ANTHROPIC_API_KEY` /
`EXPO_PUBLIC_ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` /
`GOOGLE_API_KEY` are read, env vars win). Runs resume: a `(case, rep)` that is
already on disk is skipped, failures land in `errors.jsonl` and are retried.

Files: `cases.json` (fixture user + cases + per-case rubric hints),
`models.json` (candidate matrix, judges, prices), `providers.mjs` (Anthropic
request mirrors the edge function; OpenAI Responses + Gemini generateContent are
what we would ship if that vendor won), `run.mjs`, `judge.mjs`, `sommbench.mjs`.

The system prompt comes from `lib/sommelierPrompt.js`, the same function the
app calls, built from the fixture context in `cases.json`. Output lands under
`.claude/hillclimb/sommelier-chat/<variant>/` (gitignored):
`outputs/` answers + usage, `traces/` full transcripts, `judgments/` raw
verdicts, `results.jsonl` graded rows, `errors.jsonl` failed attempts.
