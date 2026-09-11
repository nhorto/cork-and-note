// Provider adapters for the sommelier chat eval. One `complete()` per vendor,
// all returning the same shape so run.mjs / judge.mjs never branch on vendor.
//
// The Anthropic request deliberately mirrors supabase/functions/chat/index.ts
// (system floor + cached sommelier prompt, web_search with max_uses, pause_turn
// resume) so a candidate is judged on what production would actually send.
// The OpenAI and Google requests are the closest equivalent each API offers
// (native web search, low reasoning by default); they are what we WOULD ship
// if that vendor won, not something already in the app.
//
// Raw fetch throughout, like the edge function itself (Deno, no SDK), and so
// the three vendors read the same way side by side.
import fs from "node:fs";
import path from "node:path";

// ── Keys ───────────────────────────────────────────────────────────────────
// Read only recognised assignments from --env-file paths (never executed as
// shell), then let real environment variables win. Same approach as the
// vision benchmark on feat/gemini-wine-vision.
const KEY_NAMES = {
  anthropic: ["ANTHROPIC_API_KEY", "EXPO_PUBLIC_ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};

export function loadKeys(envFiles = []) {
  const allowed = new Set(Object.values(KEY_NAMES).flat());
  const found = {};
  for (const file of envFiles) {
    const text = fs.readFileSync(path.resolve(file.replace(/^~/, process.env.HOME)), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?(\w+)\s*=\s*(.*?)\s*$/);
      if (!m || !allowed.has(m[1])) continue;
      let v = m[2];
      if (v.startsWith('"') || v.startsWith("'")) v = v.slice(1, v.lastIndexOf(v[0]));
      else v = v.split(" #")[0].trim();
      if (v && !v.startsWith("${")) found[m[1]] = v;
    }
  }
  for (const name of allowed) if (process.env[name]) found[name] = process.env[name];
  const keys = {};
  for (const [provider, names] of Object.entries(KEY_NAMES)) {
    keys[provider] = names.map((n) => found[n]).find(Boolean) ?? null;
  }
  return keys;
}

// ── Shared ─────────────────────────────────────────────────────────────────
export const EM_DASH = "—";

class ProviderError extends Error {
  constructor(provider, status, body) {
    super(`${provider} HTTP ${status}: ${String(body).slice(0, 300)}`);
    this.provider = provider;
    this.status = status;
    // 429 is usually a rate limit worth waiting out, unless it is a billing
    // stop (OpenAI "insufficient_quota"): retrying that only burns time.
    const quota = /insufficient_quota|credit_balance_exhausted/.test(String(body));
    this.retryable = (status === 429 && !quota) || status === 408 || status === 409 || status >= 500;
  }
}

async function postJson(url, headers, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new ProviderError(new URL(url).hostname, res.status, text);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

/** Retry transient failures with jittered exponential backoff. Returns {value, attempts}. */
export async function withBackoff(fn, { maxAttempts = 5, baseMs = 2000 } = {}) {
  let attempts = 0;
  for (;;) {
    attempts++;
    try {
      return { value: await fn(), attempts };
    } catch (err) {
      const transient = err?.retryable || err?.name === "AbortError" || err?.code === "ECONNRESET";
      if (!transient || attempts >= maxAttempts) throw Object.assign(err, { attempts });
      const delay = baseMs * 2 ** (attempts - 1) * (0.5 + Math.random());
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// ── Anthropic ──────────────────────────────────────────────────────────────
// Mirrors supabase/functions/chat/index.ts. `effort` "off" sends no thinking
// config (what production sends today, and on Sonnet 4.6 / Haiku that means
// no thinking). On Sonnet 5 / Opus 5 / Fable adaptive thinking is on by
// default, so we set effort explicitly and give max_tokens room for it: the
// production 1024/2048 ceilings would truncate a thinking model, which is one
// of the changes any switch has to ship with.
const ANTHROPIC_FLOOR_RE = /const SYSTEM_PROMPT_FLOOR =\n([\s\S]*?);\n/;

export function loadSystemPromptFloor(repoRoot) {
  const src = fs.readFileSync(path.join(repoRoot, "supabase/functions/chat/index.ts"), "utf8");
  const m = src.match(ANTHROPIC_FLOOR_RE);
  if (!m) throw new Error("Could not find SYSTEM_PROMPT_FLOOR in chat/index.ts");
  // The floor is a chain of "..." + "..." string literals; evaluate that chain only.
  return Function(`"use strict"; return (${m[1]});`)();
}

// Floor first, sommelier prompt second with the cache breakpoint (caches both).
// SommBench sends no system prompt at all, so empty blocks are dropped.
function systemBlocks(req) {
  const blocks = [req.floor, req.system].filter((t) => t && t.trim()).map((text) => ({ type: "text", text }));
  if (!blocks.length) return {};
  blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  return { system: blocks };
}

// Same tool the edge function sends. Haiku 4.5 predates the dynamic-filtering
// variant and 400s on it, so it gets the basic one (same semantics, same price).
const webSearchTool = (model) => ({
  type: /^claude-haiku-4-5/.test(model) ? "web_search_20250305" : "web_search_20260209",
  name: "web_search",
  max_uses: 2,
});
const THINKING_MODELS = /^claude-(sonnet-5|opus-5|fable-5|opus-4-[78])/;

async function anthropicComplete(cfg, req) {
  const { model, effort } = cfg;
  const thinking = effort !== "off" && THINKING_MODELS.test(model);
  const body = {
    model,
    max_tokens: thinking ? 6000 : req.search ? 2048 : 1024,
    ...systemBlocks(req),
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(req.search ? { tools: [webSearchTool(model)] } : {}),
    ...(thinking ? { thinking: { type: "adaptive" }, output_config: { effort } } : {}),
  };
  const headers = { "x-api-key": req.keys.anthropic, "anthropic-version": "2023-06-01" };

  const blocks = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let searches = 0;
  let stop = null;
  let served = null;
  const conversation = [...body.messages];
  for (let resume = 0; ; resume++) {
    const data = await postJson("https://api.anthropic.com/v1/messages", headers, { ...body, messages: conversation }, req.timeoutMs);
    served = data.model;
    blocks.push(...(data.content ?? []));
    for (const k of Object.keys(usage)) usage[k] += data.usage?.[k] ?? 0;
    searches += data.usage?.server_tool_use?.web_search_requests ?? 0;
    stop = data.stop_reason;
    if (stop !== "pause_turn" || resume >= 2) break;
    conversation.push({ role: "assistant", content: data.content });
  }

  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  const transcript = [];
  for (const b of blocks) {
    if (b.type === "server_tool_use") transcript.push({ role: "tool_call", name: b.name, content: JSON.stringify(b.input, null, 2) });
    else if (b.type === "web_search_tool_result") {
      const c = Array.isArray(b.content) ? b.content.map((r) => `${r.title}\n${r.url}`).join("\n\n") : JSON.stringify(b.content);
      transcript.push({ role: "tool_result", name: "web_search", content: c });
    }
  }
  transcript.push({ role: "assistant", content: text });
  return { text, transcript, usage, web_searches: searches, stop_reason: stop, truncated: stop === "max_tokens", served_model: served };
}

const joinSystem = (req) => [req.floor, req.system].filter((t) => t && t.trim()).join("\n\n");

// ── OpenAI (Responses API) ─────────────────────────────────────────────────
// Floor + sommelier prompt become `instructions`; native web_search tool;
// reasoning effort from cfg. Usage: cached tokens are a subset of input.
async function openaiComplete(cfg, req) {
  const body = {
    model: cfg.model,
    ...(joinSystem(req) ? { instructions: joinSystem(req) } : {}),
    input: req.messages.map((m) => ({ role: m.role, content: m.content })),
    max_output_tokens: 6000,
    store: false,
    ...(cfg.effort !== "off" ? { reasoning: { effort: cfg.effort } } : {}),
    ...(req.search ? { tools: [{ type: "web_search" }] } : {}),
  };
  const data = await postJson("https://api.openai.com/v1/responses", { Authorization: `Bearer ${req.keys.openai}` }, body, req.timeoutMs);
  const out = data.output ?? [];
  const transcript = [];
  let text = "";
  let searches = 0;
  for (const item of out) {
    if (item.type === "web_search_call") {
      searches++;
      transcript.push({ role: "tool_call", name: "web_search", content: JSON.stringify(item.action ?? {}, null, 2) });
    } else if (item.type === "message") {
      for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
    }
  }
  transcript.push({ role: "assistant", content: text });
  const u = data.usage ?? {};
  const usage = {
    input_tokens: (u.input_tokens ?? 0) - (u.input_tokens_details?.cached_tokens ?? 0),
    output_tokens: u.output_tokens ?? 0,
    cache_read_input_tokens: u.input_tokens_details?.cached_tokens ?? 0,
    cache_creation_input_tokens: 0,
    reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
  };
  const truncated = data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens";
  return { text, transcript, usage, web_searches: searches, stop_reason: data.status, truncated, served_model: data.model };
}

// ── Google (Gemini generateContent) ────────────────────────────────────────
// systemInstruction carries floor + prompt; Google Search grounding is the
// native search tool; thinkingLevel from cfg. Search count = grounding queries.
async function googleComplete(cfg, req) {
  const body = {
    ...(joinSystem(req) ? { systemInstruction: { parts: [{ text: joinSystem(req) }] } } : {}),
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      maxOutputTokens: 6000,
      ...(cfg.effort !== "off" ? { thinkingConfig: { thinkingLevel: cfg.effort } } : {}),
    },
    ...(req.search ? { tools: [{ google_search: {} }] } : {}),
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
  const data = await postJson(url, { "x-goog-api-key": req.keys.google }, body, req.timeoutMs);
  const cand = data.candidates?.[0] ?? {};
  const text = (cand.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  const queries = cand.groundingMetadata?.webSearchQueries ?? [];
  const transcript = [];
  if (queries.length) transcript.push({ role: "tool_call", name: "google_search", content: queries.join("\n") });
  transcript.push({ role: "assistant", content: text });
  const u = data.usageMetadata ?? {};
  const usage = {
    input_tokens: (u.promptTokenCount ?? 0) - (u.cachedContentTokenCount ?? 0),
    output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    cache_read_input_tokens: u.cachedContentTokenCount ?? 0,
    cache_creation_input_tokens: 0,
    reasoning_tokens: u.thoughtsTokenCount ?? 0,
  };
  return {
    text, transcript, usage,
    // Google bills grounding per request that used it, not per query.
    web_searches: queries.length ? 1 : 0,
    stop_reason: cand.finishReason,
    truncated: cand.finishReason === "MAX_TOKENS",
    served_model: data.modelVersion ?? cfg.model,
  };
}

// ── Mock (pipeline checks without spend) ───────────────────────────────────
async function mockComplete(cfg, req) {
  const last = req.messages.at(-1).content;
  const text = `[mock ${cfg.model}] Reply to: ${last.slice(0, 60)}`;
  return {
    text, transcript: [{ role: "assistant", content: text }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 1500, cache_creation_input_tokens: 0 },
    web_searches: 0, stop_reason: "end_turn", truncated: false, served_model: cfg.model,
  };
}

const ADAPTERS = { anthropic: anthropicComplete, openai: openaiComplete, google: googleComplete, mock: mockComplete };

/**
 * cfg: { provider, model, effort }
 * req: { floor, system, messages, search, keys, timeoutMs }
 */
export async function complete(cfg, req) {
  const fn = ADAPTERS[cfg.provider];
  if (!fn) throw new Error(`Unknown provider ${cfg.provider}`);
  if (cfg.provider !== "mock" && !req.keys[cfg.provider]) throw new Error(`No API key for ${cfg.provider}`);
  const t0 = Date.now();
  const result = await fn(cfg, req);
  return { ...result, latency_s: (Date.now() - t0) / 1000 };
}

/**
 * Structured JSON completion for the judges. Returns parsed JSON.
 * Anthropic: output_config.format json_schema; OpenAI: text.format json_schema.
 */
export async function completeJson(cfg, { system, user, schema, keys, timeoutMs, effort = "low" }) {
  if (cfg.provider === "anthropic") {
    const thinking = THINKING_MODELS.test(cfg.model);
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": keys.anthropic, "anthropic-version": "2023-06-01" },
      {
        model: cfg.model, max_tokens: 4000, system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema }, ...(thinking ? { effort } : {}) },
      },
      timeoutMs
    );
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { value: JSON.parse(text), usage: data.usage, served_model: data.model };
  }
  if (cfg.provider === "openai") {
    const data = await postJson(
      "https://api.openai.com/v1/responses",
      { Authorization: `Bearer ${keys.openai}` },
      {
        model: cfg.model, instructions: system, input: user, store: false, max_output_tokens: 4000,
        reasoning: { effort },
        text: { format: { type: "json_schema", name: "verdict", schema, strict: true } },
      },
      timeoutMs
    );
    const text = (data.output ?? []).flatMap((i) => (i.type === "message" ? i.content : [])).filter((c) => c.type === "output_text").map((c) => c.text).join("");
    return { value: JSON.parse(text), usage: data.usage, served_model: data.model };
  }
  if (cfg.provider === "mock") {
    return { value: { winner: ["A", "B", "tie"][Math.floor(Math.random() * 3)], reasoning: "mock" }, usage: {}, served_model: cfg.model };
  }
  throw new Error(`No JSON adapter for ${cfg.provider}`);
}
