#!/usr/bin/env node
// Sommelier chat: what does one message cost on each candidate model, and what
// does a Pro subscriber cost us per month?
//
// Grounded in the real per-call usage the chat edge function records in
// public.chat_usage (snapshot in ./chat-usage-snapshot.json: task, tokens,
// web searches, timestamp; no user ids). Everything the log does NOT record is
// an explicit, printed assumption, and each one can be replaced by measured
// numbers from the eval runner (`--measured .claude/hillclimb/sommelier-chat`).
//
//   node scripts/sommelier-eval/cost-model.mjs
//   node scripts/sommelier-eval/cost-model.mjs --measured .claude/hillclimb/sommelier-chat
//   node scripts/sommelier-eval/cost-model.mjs --prefix 2500   # bigger cellar context
//
// Prices are first-party Anthropic list prices per MTok (claude-api skill
// "Current Models" table, cached 2026-06-24; web search $10 per 1,000).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};

// ── Prices ($ per million tokens) ─────────────────────────────────────────
// cacheRead: 0.1× input except Fable 5.1 ($0.25 flat). cacheWrite: 1.25× input.
// minCache: prefixes shorter than this silently do not cache (billed as input).
// tokenizer: relative token count for the same text vs Sonnet 4.6 (the model
// the usage log was recorded on). Sonnet 5 / Opus 5 / Fable 5.1 share a new
// tokenizer that produces ~30% more tokens (model-migration guide).
const PRICES = {
  // Anthropic (claude-api skill table, cached 2026-06-24)
  "claude-sonnet-4-6": { provider: "anthropic", in: 3, out: 15, cacheRead: 0.3, minCache: 1024, tokenizer: 1.0 },
  "claude-sonnet-5":   { provider: "anthropic", in: 2, out: 10, cacheRead: 0.2, minCache: 1024, tokenizer: 1.3 },
  "claude-opus-5":     { provider: "anthropic", in: 5, out: 25, cacheRead: 0.5, minCache: 512,  tokenizer: 1.3 },
  "claude-fable-5-1":  { provider: "anthropic", in: 10, out: 50, cacheRead: 0.25, minCache: 512, tokenizer: 1.3 },
  "claude-haiku-4-5":  { provider: "anthropic", in: 1, out: 5, cacheRead: 0.1, minCache: 4096, tokenizer: 1.0 },
  // OpenAI (developers.openai.com/api/docs/pricing, read 2026-09-11). Cached
  // input is automatic prefix caching at 0.1x; no minimum we model.
  "gpt-5.6-luna":      { provider: "openai", in: 0.2, out: 1.2, cacheRead: 0.02, minCache: 0, tokenizer: 1.0 },
  "gpt-5.6-terra":     { provider: "openai", in: 2, out: 12, cacheRead: 0.2, minCache: 0, tokenizer: 1.0 },
  "gpt-5.6-sol":       { provider: "openai", in: 4, out: 20, cacheRead: 0.4, minCache: 0, tokenizer: 1.0 },
  "gpt-6-astra":       { provider: "openai", in: 10, out: 50, cacheRead: 1.0, minCache: 0, tokenizer: 1.0 },
  // Google (ai.google.dev/gemini-api/docs/pricing, read 2026-09-11). 3.8 Flash
  // is introductory pricing through 2026-12-31; it DOUBLES on 2027-01-01.
  "gemini-3.8-flash":  { provider: "google", in: 0.75, out: 3.75, cacheRead: 0.075, minCache: 0, tokenizer: 1.0, note: "doubles 2027-01-01" },
  "gemini-3.1-pro-preview": { provider: "google", in: 2, out: 12, cacheRead: 0.2, minCache: 0, tokenizer: 1.0 },
};
// Web search, per search. OpenAI and Anthropic: $10 per 1,000 calls. Google
// grounding: $14 per 1,000 after 5,000 free requests a month across Gemini 3.x,
// which at current volume is effectively free; the paid rate is used here so
// the comparison does not lean on a free tier that stops at scale.
const WEB_SEARCH_USD = { anthropic: 10 / 1000, openai: 10 / 1000, google: 14 / 1000 };

// ── Candidates ─────────────────────────────────────────────────────────────
// `thinking` = extra output tokens per message spent on reasoning. The current
// production config (Sonnet 4.6, no thinking param) spends zero, so the logged
// output tokens are answer-only. On Sonnet 5 / Opus 5 / Fable 5.1 adaptive
// thinking is on by default and its tokens are billed as output. These
// per-effort figures are PLACEHOLDERS for a short chat reply; the eval runner
// measures the real number per candidate and `--measured` swaps them in.
const THINKING_ASSUMED = { off: 0, low: 150, medium: 500, high: 1200 };

const CANDIDATES = [
  { id: "sonnet-4.6 (current)", model: "claude-sonnet-4-6", effort: "off" },
  { id: "sonnet-5 low",         model: "claude-sonnet-5",   effort: "low" },
  { id: "sonnet-5 medium",      model: "claude-sonnet-5",   effort: "medium" },
  { id: "opus-5 low",           model: "claude-opus-5",     effort: "low" },
  { id: "opus-5 medium",        model: "claude-opus-5",     effort: "medium" },
  { id: "fable-5.1 low",        model: "claude-fable-5-1",  effort: "low" },
  { id: "haiku-4.5",            model: "claude-haiku-4-5",  effort: "off" },
  { id: "gpt-5.6-luna low",     model: "gpt-5.6-luna",      effort: "low" },
  { id: "gpt-5.6-terra low",    model: "gpt-5.6-terra",     effort: "low" },
  { id: "gpt-5.6-sol low",      model: "gpt-5.6-sol",       effort: "low" },
  { id: "gpt-6-astra low",      model: "gpt-6-astra",       effort: "low" },
  { id: "gemini-3.8-flash low", model: "gemini-3.8-flash",  effort: "low" },
  { id: "gemini-3.1-pro low",   model: "gemini-3.1-pro-preview", effort: "low" },
];

// ── Revenue side ───────────────────────────────────────────────────────────
// Launch plan: $9.99/mo, $59.99/yr. Apple keeps 30% (15% on the Small Business
// Program, which a <$1M/yr developer qualifies for).
const PLANS = [
  { id: "monthly, Apple 30%", netPerMonth: 9.99 * 0.70 },
  { id: "monthly, Apple 15%", netPerMonth: 9.99 * 0.85 },
  { id: "annual,  Apple 30%", netPerMonth: (59.99 / 12) * 0.70 },
  { id: "annual,  Apple 15%", netPerMonth: (59.99 / 12) * 0.85 },
];
const FAIR_USE_MONTHLY_CHAT_CAP = 1000; // _shared/entitlements.ts

// ── 1. Observed traffic ────────────────────────────────────────────────────
const rows = JSON.parse(fs.readFileSync(path.join(here, "chat-usage-snapshot.json"), "utf8"));
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const pct = (xs, p) => {
  const s = sorted(xs);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const inputs = rows.map((r) => r.input_tokens);
const outputs = rows.map((r) => r.output_tokens);
// web_searches is only recorded where search was on the table (Pro chat since
// 2026-09-10); the legacy rows predate it. Search rate = searches per message
// among searchable rows, so it reflects what a Pro user actually triggers.
const searchable = rows.filter((r) => r.web_searches !== null);
const searchRate = searchable.length
  ? mean(searchable.map((r) => r.web_searches))
  : 0;

const traffic = {
  n: rows.length,
  inputMedian: pct(inputs, 0.5),
  inputP90: pct(inputs, 0.9),
  outputMedian: pct(outputs, 0.5),
  outputP90: pct(outputs, 0.9),
  searchRate,
  searchableN: searchable.length,
};

// ── 2. The cached prefix the log does not see ─────────────────────────────
// `usage.input_tokens` EXCLUDES cache reads and cache writes, and the edge
// function only stores input_tokens. So the system prompt (floor + sommelier
// prompt + the user's cellar/tasting context) is invisible in the log whenever
// it is long enough to cache. We size it from the prompt template in lib/sommelierPrompt.js
// plus a mid-sized context, at ~4 chars/token on the Sonnet 4.6 tokenizer.
function estimatePrefixTokens() {
  const src = fs.readFileSync(path.join(here, "../../lib/sommelierPrompt.js"), "utf8");
  const start = src.indexOf("return `You are an expert wine sommelier");
  const end = src.indexOf("${context}`;", start);
  const template = start >= 0 && end > start ? src.slice(start, end) : "";
  const floorSrc = fs.readFileSync(
    path.join(here, "../../supabase/functions/chat/index.ts"),
    "utf8"
  );
  const floorChars = (floorSrc.match(/"([^"\n]*)" \+/g) || []).join("").length;
  // Mid-sized context: 8 places, 20 tastings, 25 cellar lots at ~80 chars each.
  const contextChars = (8 + 20 + 25) * 80 + 400;
  return Math.round((template.length + floorChars + contextChars) / 4);
}
const prefixTokens = Number(flag("--prefix", estimatePrefixTokens()));

// ── 3. Optional: measured usage from the eval runner ──────────────────────
// Each variant dir under the flow holds results.jsonl rows with `model` and
// `usage`. When present for a candidate's model, mean measured usage replaces
// the assumptions for that candidate (thinking overhead, tokenizer, searches).
function loadMeasured(flowDir) {
  if (!flowDir) return {};
  const out = {};
  for (const variant of fs.readdirSync(flowDir)) {
    const file = path.join(flowDir, variant, "results.jsonl");
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    for (const row of lines) {
      if (!row.model || !row.usage || row.status !== "ok") continue;
      const key = `${row.model}|${row.meta?.effort ?? "off"}`;
      (out[key] ??= []).push(row);
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([key, rs]) => [
      key,
      {
        n: rs.length,
        input: mean(rs.map((r) => r.usage.input_tokens ?? 0)),
        cacheRead: mean(rs.map((r) => r.usage.cache_read_input_tokens ?? 0)),
        cacheWrite: mean(rs.map((r) => r.usage.cache_creation_input_tokens ?? 0)),
        output: mean(rs.map((r) => r.usage.output_tokens ?? 0)),
        searches: mean(rs.map((r) => r.web_searches ?? 0)),
      },
    ])
  );
}
const measured = loadMeasured(flag("--measured", null));

// ── 4. Cost of one message ────────────────────────────────────────────────
// `profile` = { input, output, searches } at Sonnet 4.6 token counts.
function messageCost(candidate, profile) {
  const p = PRICES[candidate.model];
  // Served model ids may carry a date suffix (claude-haiku-4-5-20251001).
  const mKey = Object.keys(measured).find((k) => k.startsWith(`${candidate.model}`) && k.endsWith(`|${candidate.effort}`));
  const m = mKey ? measured[mKey] : null;
  if (m) {
    // Measured: price the usage fields directly (cache write at 1.25× input).
    return {
      input: (m.input * p.in) / 1e6,
      prefix: (m.cacheRead * p.cacheRead + m.cacheWrite * p.in * 1.25) / 1e6,
      output: (m.output * p.out) / 1e6,
      search: m.searches * WEB_SEARCH_USD[p.provider],
      source: `measured (n=${m.n})`,
    };
  }
  const tk = p.tokenizer;
  const prefix = prefixTokens * tk;
  // Cached on every turn but the first of a conversation; assume the typical
  // conversation is ~3 turns, so 1/3 of messages write the cache and 2/3 read
  // it. Below the model's minimum cacheable size it is plain input every time.
  const prefixCost =
    prefix < p.minCache && p.minCache > 0
      ? (prefix * p.in) / 1e6
      : ((prefix * p.in * 1.25) / 3 + (prefix * p.cacheRead * 2) / 3) / 1e6;
  const thinking = THINKING_ASSUMED[candidate.effort];
  return {
    input: (profile.input * tk * p.in) / 1e6,
    prefix: prefixCost,
    output: ((profile.output * tk + thinking) * p.out) / 1e6,
    search: profile.searches * WEB_SEARCH_USD[p.provider],
    source: "assumed",
  };
}
const total = (c) => c.input + c.prefix + c.output + c.search;

// ── 5. Print ───────────────────────────────────────────────────────────────
const usd = (x, d = 4) => `$${x.toFixed(d)}`;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log("SOMMELIER CHAT: COST PER MESSAGE AND PER PRO USER\n");
console.log("Observed traffic (public.chat_usage, task in legacy/chat):");
console.log(`  ${traffic.n} messages; uncached input median ${traffic.inputMedian} / p90 ${traffic.inputP90} tokens;`);
console.log(`  output median ${traffic.outputMedian} / p90 ${traffic.outputP90} tokens (Sonnet 4.6 tokenizer, no thinking);`);
console.log(`  web searches per Pro message: ${searchRate.toFixed(2)} (from ${traffic.searchableN} searchable rows)`);
console.log(`  cached prefix (system prompt + context), NOT in the log: ~${prefixTokens} tokens (estimated; --prefix to override)\n`);

const profiles = {
  typical: { input: traffic.inputMedian, output: traffic.outputMedian, searches: searchRate },
  heavy: { input: traffic.inputP90, output: traffic.outputP90, searches: Math.min(2, searchRate * 2) },
};

for (const [name, profile] of Object.entries(profiles)) {
  console.log(`Per-message cost, ${name} message (input ${profile.input}, output ${profile.output}, ${profile.searches.toFixed(2)} searches):`);
  console.log(`  ${pad("candidate", 24)}${rpad("total", 9)}${rpad("input", 9)}${rpad("prefix", 9)}${rpad("output", 9)}${rpad("search", 9)}  vs current  source`);
  const base = total(messageCost(CANDIDATES[0], profile));
  for (const c of CANDIDATES) {
    const cost = messageCost(c, profile);
    const t = total(cost);
    console.log(
      `  ${pad(c.id, 24)}${rpad(usd(t), 9)}${rpad(usd(cost.input), 9)}${rpad(usd(cost.prefix), 9)}${rpad(usd(cost.output), 9)}${rpad(usd(cost.search), 9)}  ${rpad((t / base).toFixed(2) + "x", 8)}  ${cost.source}`
    );
  }
  console.log();
}

// Per Pro user per month. Usage levels: the heaviest observed user-month in
// the log, a plausible engaged user, a power user, and the fair-use cap.
const byUserMonth = {};
for (const r of rows) {
  const k = r.created_at.slice(0, 7);
  byUserMonth[k] = (byUserMonth[k] ?? 0) + 1;
}
const USAGE_LEVELS = [
  { id: "10 msgs/mo", n: 10 },
  { id: "34 msgs/mo (max seen)", n: 34 },
  { id: "100 msgs/mo", n: 100 },
  { id: "300 msgs/mo", n: 300 },
  { id: `${FAIR_USE_MONTHLY_CHAT_CAP} msgs/mo (cap)`, n: FAIR_USE_MONTHLY_CHAT_CAP },
];

console.log("Cost per Pro user per month (typical-message cost x messages):");
console.log(`  ${pad("candidate", 24)}${USAGE_LEVELS.map((u) => rpad(u.id, 24)).join("")}`);
for (const c of CANDIDATES) {
  const per = total(messageCost(c, profiles.typical));
  console.log(`  ${pad(c.id, 24)}${USAGE_LEVELS.map((u) => rpad(usd(per * u.n, 2), 24)).join("")}`);
}
console.log();

console.log("Break-even: messages per month before AI cost exceeds net subscription revenue");
console.log(`  ${pad("candidate", 24)}${PLANS.map((p) => rpad(p.id, 22)).join("")}`);
for (const c of CANDIDATES) {
  const per = total(messageCost(c, profiles.typical));
  console.log(`  ${pad(c.id, 24)}${PLANS.map((p) => rpad(Math.floor(p.netPerMonth / per), 22)).join("")}`);
}
console.log(`  (net revenue/month: ${PLANS.map((p) => `${p.id} = ${usd(p.netPerMonth, 2)}`).join("; ")})\n`);

console.log("Gross margin at 34 msgs/mo (heaviest user-month observed), monthly plan after Apple 15%:");
for (const c of CANDIDATES) {
  const cost = total(messageCost(c, profiles.typical)) * 34;
  const net = PLANS[1].netPerMonth;
  console.log(`  ${pad(c.id, 24)} AI cost ${rpad(usd(cost, 2), 7)}  margin ${rpad(((1 - cost / net) * 100).toFixed(1) + "%", 7)}`);
}
console.log();

console.log("Assumptions to replace with measured numbers (run the eval, then --measured):");
console.log(`  - thinking tokens per message by effort: ${JSON.stringify(THINKING_ASSUMED)} (adaptive thinking is on by default on Sonnet 5 / Opus 5 / Fable 5.1)`);
console.log("  - OpenAI / Google token counts assumed equal to Sonnet 4.6 (factor 1.0); their reasoning-token overhead at low effort uses the same placeholder");
console.log("  - new-tokenizer factor 1.3x for Sonnet 5 / Opus 5 / Fable 5.1 (migration guide: ~30% more tokens than Sonnet 4.6)");
console.log("  - prefix cache: 1 write per 3 reads; Haiku 4.5 never caches it (4096-token minimum)");
console.log("  - chat_usage does not store cache_read/cache_creation tokens, so the prefix term above is modelled, not logged");
