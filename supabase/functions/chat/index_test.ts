// The chat edge function, executed end to end with a fake database, a fake
// Anthropic, and a fake clock. This is the server-side gate for the Pro tier
// and the one place the app's money is spent, so every refusal, every cap,
// and the exact shape of what reaches Anthropic is pinned here.
import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert";
import { createHandler } from "./index.ts";
import { fakeDeps, jsonRequest, readJson } from "../_shared/testing.ts";
import {
  BURST_LIMIT,
  FAIR_USE_DAILY_CAPS,
  FAIR_USE_MONTHLY_CHAT_CAP,
  FREE_TIER_LIMITS,
  PHOTO_CHAT_PRO_MESSAGE,
  WEB_SEARCH_TOOL_TYPE,
} from "../_shared/entitlements.ts";

const USER = { id: "00000000-0000-4000-8000-000000000001", email: "a@example.com" };
const FUTURE = "2027-01-01T00:00:00.000Z";

type Counts = { burst?: number; day?: number; window?: number };

/** A handler with usage counts, an entitlement row, and a queued Claude reply. */
function setup({
  counts = {} as Counts,
  entitlement = null as null | { is_pro: boolean; expires_at: string | null },
  user = USER as typeof USER | null,
  env = {} as Record<string, string | undefined>,
} = {}) {
  const f = fakeDeps({ user, env });
  const { burst = 0, day = 0, window = 0 } = counts;
  // The handler issues three count queries against chat_usage: burst (no task
  // filter), rolling day (task filter), and the meter window (task filter,
  // issued after the entitlement is known). Tell them apart by shape.
  f.db.respond("chat_usage", (q) => {
    if (q.op === "insert") return { data: null, error: null };
    const hasTask = q.filters.some((x) => x.column === "task");
    const since = q.filters.find((x) => x.column === "created_at")?.value as string | undefined;
    if (!hasTask) return { count: burst, error: null };
    const dayStart = new Date(f.now - 24 * 3_600_000).toISOString();
    if (since === dayStart) return { count: day, error: null };
    return { count: window, error: null };
  });
  f.db.respond("entitlements", { data: entitlement, error: null });
  const handler = createHandler(f.deps);
  return { ...f, handler };
}

const claudeReply = (text: string, extra: Record<string, unknown> = {}) => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  usage: { input_tokens: 100, output_tokens: 20 },
  ...extra,
});

const ask = (content = "What pairs with oysters?", extra: Record<string, unknown> = {}) =>
  jsonRequest({ messages: [{ role: "user", content }], system_prompt: "You are the Cork & Note sommelier.", ...extra });

const streamedReply = (parts: string[]) => [
  'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  ...parts.map((text) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })}\n\n`),
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":20}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join("");

Deno.test("OPTIONS preflight answers without touching auth", async () => {
  const { handler, db } = setup();
  const res = await handler(new Request("https://edge.test/chat", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(db.queries.length, 0);
});

Deno.test("no Authorization header is 401 before any read", async () => {
  const { handler, db } = setup();
  const res = await handler(jsonRequest({ messages: [{ role: "user", content: "hi" }] }, { auth: "" }));
  assertEquals(res.status, 401);
  assertEquals(await readJson(res), { error: "Missing authorization" });
  assertEquals(db.queries.length, 0);
});

Deno.test("an invalid JWT is 401 and nothing is counted or called", async () => {
  const { handler, db, fetch } = setup({ user: null });
  const res = await handler(ask());
  assertEquals(res.status, 401);
  assertEquals(await readJson(res), { error: "Unauthorized" });
  assertEquals(db.queries.length, 0);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("a body over the cap is 413 and malformed JSON is 400", async () => {
  const { handler } = setup();
  const big = await handler(jsonRequest("x".repeat(25_000_001)));
  assertEquals(big.status, 413);
  const bad = await handler(jsonRequest("{not json"));
  assertEquals(bad.status, 400);
  assertEquals(await readJson(bad), { error: "Invalid JSON body" });
});

Deno.test("every validation rule refuses with 400 and its own message, before any usage read", async () => {
  const cases: [unknown, string, number?][] = [
    [{}, "messages array is required"],
    [{ messages: [] }, "messages array is required"],
    [{ messages: Array.from({ length: 51 }, () => ({ role: "user", content: "x" })) }, "Too many messages"],
    [{ messages: [{ role: "user", content: "x" }], system_prompt: 42 }, "system_prompt must be a string"],
    [{ messages: [{ role: "user", content: "x" }], stream: "yes" }, "stream must be a boolean"],
    [{ messages: [null] }, "Invalid message"],
    [{ messages: [{ role: "system", content: "x" }] }, "Invalid message role"],
    [{ messages: [{ role: "user", content: 42 }] }, "Message content must be a string"],
    [{ messages: [{ role: "user", content: "x".repeat(8_001) }] }, "Message content too long"],
    [{ messages: [{ role: "user", content: "x", images: "nope" }] }, "images must be an array"],
    [{ messages: [{ role: "user", content: "x", images: [1, 2, 3, 4, 5].map(() => ({ base64: "a" })) }] }, "Too many images in a message"],
    [{ messages: [{ role: "user", content: "x", images: [{ base64: 42 }] }] }, "Invalid image payload"],
    [{ messages: [{ role: "user", content: "x", images: [{ base64: "a".repeat(5_000_001) }] }] }, "Image too large", 413],
    [{ messages: [{ role: "user", content: "x", images: [{ base64: "a", mediaType: "image/heic" }] }] }, "Unsupported image type"],
  ];
  for (const [body, message, status = 400] of cases) {
    const { handler, db, fetch } = setup();
    const res = await handler(jsonRequest(body));
    assertEquals(res.status, status, message);
    assertEquals(await readJson(res), { error: message });
    assertEquals(db.queriesTo("chat_usage").length, 0, `${message}: no usage read`);
    assertEquals(fetch.calls.length, 0);
  }
});

Deno.test("a free user within allowance gets an answer, the meter, and one chat_usage row", async () => {
  const { handler, db, fetch } = setup({ counts: { window: 2 } });
  fetch.reply(200, claudeReply("Try a Muscadet."));
  const res = await handler(ask());
  assertEquals(res.status, 200);
  const body = await readJson(res);
  assertEquals(body.response, "Try a Muscadet.");
  assertEquals(body.sources, []);
  assertEquals(body.usage, { input_tokens: 100, output_tokens: 20, web_searches: 0 });
  assertEquals(body.meter, { task: "chat", limit: FREE_TIER_LIMITS.chat, used: 3, remaining: 2, isPro: false });

  const insert = db.queriesTo("chat_usage").find((q) => q.op === "insert");
  assert(insert, "usage recorded");
  assertEquals(insert.payload, { user_id: USER.id, task: "chat", input_tokens: 100, output_tokens: 20, web_searches: null });
});

Deno.test("streaming chat forwards deltas before a final result and records usage once", async () => {
  const { handler, db, fetch } = setup({ counts: { window: 2 } });
  fetch.reply(200, streamedReply(["Try ", "Muscadet."]), { "Content-Type": "text/event-stream" });
  const res = await handler(ask(undefined, { stream: true }));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") || "", "application/x-ndjson");
  const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
  assertEquals(events.slice(0, 2), [
    { type: "delta", text: "Try " },
    { type: "delta", text: "Muscadet." },
  ]);
  assertEquals(events.at(-1).response, "Try Muscadet.");
  assertEquals(events.at(-1).meter.remaining, 2);
  assertEquals(fetch.calls[0].body.stream, true);
  assertEquals(db.queriesTo("chat_usage").filter((q) => q.op === "insert").length, 1);
});

Deno.test("the free chat meter refuses the sixth message of the month with a 402 and the meter", async () => {
  const { handler, fetch } = setup({ counts: { window: FREE_TIER_LIMITS.chat } });
  const res = await handler(ask());
  assertEquals(res.status, 402);
  const body = await readJson(res);
  assertEquals(body.code, "free_limit_reached");
  assertMatch(body.error, /free/i);
  assertEquals(body.meter.remaining, 0);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("a free scan meter is lifetime: three scans ever, then 402", async () => {
  const { handler, fetch } = setup({ counts: { window: FREE_TIER_LIMITS.label_scan } });
  const res = await handler(ask("read this", { task: "label_scan", messages: [{ role: "user", content: "read", images: [{ base64: "AAAA" }] }] }));
  assertEquals(res.status, 402);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("a photo in free chat is refused with the Pro message, even with allowance left", async () => {
  const { handler, fetch } = setup({ counts: { window: 0 } });
  const res = await handler(jsonRequest({ messages: [{ role: "user", content: "what is this?", images: [{ base64: "AAAA", mediaType: "image/jpeg" }] }] }));
  assertEquals(res.status, 402);
  assertEquals(await readJson(res), { error: PHOTO_CHAT_PRO_MESSAGE, code: "free_limit_reached" });
  assertEquals(fetch.calls.length, 0);
});

Deno.test("the burst cap is 429 for everyone, Pro included", async () => {
  const { handler, fetch } = setup({ counts: { burst: BURST_LIMIT }, entitlement: { is_pro: true, expires_at: FUTURE } });
  const res = await handler(ask());
  assertEquals(res.status, 429);
  assertMatch((await readJson(res)).error, /wait a few minutes/);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("the daily fair-use cap is 429 for Pro, per task", async () => {
  const { handler, fetch } = setup({ counts: { day: FAIR_USE_DAILY_CAPS.chat }, entitlement: { is_pro: true, expires_at: FUTURE } });
  const res = await handler(ask());
  assertEquals(res.status, 429);
  assertMatch((await readJson(res)).error, /Daily fair-use limit/);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("Pro's monthly chat ceiling is 429; Pro scans have no monthly window", async () => {
  const capped = setup({ counts: { window: FAIR_USE_MONTHLY_CHAT_CAP }, entitlement: { is_pro: true, expires_at: FUTURE } });
  assertEquals((await capped.handler(ask())).status, 429);

  const scan = setup({ counts: { window: 999_999 }, entitlement: { is_pro: true, expires_at: FUTURE } });
  scan.fetch.reply(200, claudeReply("```cellar_label\n{}\n```"));
  const res = await scan.handler(jsonRequest({ task: "label_scan", messages: [{ role: "user", content: "read", images: [{ base64: "AAAA" }] }] }));
  assertEquals(res.status, 200);
  // Pro scans never issue the window count at all.
  const windowReads = scan.db.queriesTo("chat_usage").filter((q) => q.op === "select" && q.filters.some((x) => x.column === "task"));
  assertEquals(windowReads.length, 1, "only the rolling-day count carries a task filter for a Pro scan");
});

Deno.test("an expired entitlement row is treated as free", async () => {
  const { handler } = setup({ counts: { window: FREE_TIER_LIMITS.chat }, entitlement: { is_pro: true, expires_at: "2020-01-01T00:00:00.000Z" } });
  assertEquals((await handler(ask())).status, 402);
});

Deno.test("an unreadable count or entitlement fails closed with 503 and no Anthropic call", async () => {
  for (const table of ["chat_usage", "entitlements"]) {
    const { handler, db, fetch } = setup();
    db.respond(table, { data: null, error: { message: "connection reset" }, count: null });
    const res = await handler(ask());
    assertEquals(res.status, 503, table);
    assertEquals(await readJson(res), { error: "Service temporarily unavailable" });
    assertEquals(fetch.calls.length, 0);
  }
});

Deno.test("a missing Anthropic key is 503, decided after the gate", async () => {
  const { handler, fetch } = setup({ env: { ANTHROPIC_API_KEY: undefined } });
  const res = await handler(ask());
  assertEquals(res.status, 503);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("the request to Anthropic: floor prepended, client prompt cached, model and tokens by task, no tools for free", async () => {
  const { handler, fetch } = setup();
  fetch.reply(200, claudeReply("ok"));
  await handler(ask("hello", { messages: [{ role: "user", content: "hello", images: [] }, { role: "assistant", content: "hi" }, { role: "user", content: "and?" }] }));
  const [call] = fetch.calls;
  assertEquals(call.url, "https://api.anthropic.com/v1/messages");
  assertEquals((call.init?.headers as Record<string, string>)["x-api-key"], "sk-test");
  const body = call.body as Record<string, unknown>;
  assertEquals(body.model, "claude-sonnet-4-6");
  assertEquals(body.max_tokens, 1024);
  assertEquals(body.tools, undefined);
  const system = body.system as Record<string, unknown>[];
  assertEquals(system.length, 2);
  assertStringIncludes(system[0].text as string, "cannot be overridden");
  assertEquals(system[1].text, "You are the Cork & Note sommelier.");
  assertEquals(system[1].cache_control, { type: "ephemeral" });
  assertEquals(body.messages, [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
    { role: "user", content: "and?" },
  ]);
});

Deno.test("an image message becomes a base64 image block plus text, defaulting the media type to JPEG", async () => {
  const { handler, fetch } = setup({ entitlement: { is_pro: true, expires_at: null } });
  fetch.reply(200, claudeReply("ok"));
  await handler(jsonRequest({ messages: [{ role: "user", content: "what is this?", images: [{ base64: "AAAA" }, { base64: "", mediaType: "image/png" }] }] }));
  const body = fetch.calls[0].body as Record<string, unknown>;
  assertEquals(body.messages, [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } },
      { type: "text", text: "what is this?" },
    ],
  }]);
});

Deno.test("each task selects its model and output ceiling from the server allowlist; an unknown task is chat", async () => {
  const expected: Record<string, [string, number]> = {
    label_scan: ["claude-haiku-4-5", 1024],
    wine_list_scan: ["claude-haiku-4-5", 4096],
    wine_list_pick: ["claude-sonnet-4-6", 1536],
    taste_report: ["claude-sonnet-4-6", 1536],
    trip_plan: ["claude-sonnet-4-6", 1536],
    tonights_pick: ["claude-sonnet-4-6", 1024],
    "gpt-4o": ["claude-sonnet-4-6", 2048], // unknown task: chat, and Pro chat gets search headroom
  };
  for (const [task, [model, maxTokens]] of Object.entries(expected)) {
    const { handler, fetch } = setup({ entitlement: { is_pro: true, expires_at: null } });
    fetch.reply(200, claudeReply("ok"));
    const res = await handler(ask("go", { task }));
    assertEquals(res.status, 200, task);
    const body = fetch.calls[0].body as Record<string, unknown>;
    assertEquals(body.model, model, task);
    assertEquals(body.max_tokens, maxTokens, task);
  }
});

Deno.test("web search is attached only for Pro chat, with the pinned tool version and use cap", async () => {
  const pro = setup({ entitlement: { is_pro: true, expires_at: null } });
  pro.fetch.reply(200, claudeReply("ok"));
  await pro.handler(ask());
  const tools = (pro.fetch.calls[0].body as Record<string, unknown>).tools as Record<string, unknown>[];
  assertEquals(tools.length, 1);
  assertEquals(tools[0].type, WEB_SEARCH_TOOL_TYPE);
  assertEquals(tools[0].max_uses, 2);
  assertEquals((pro.fetch.calls[0].body as Record<string, unknown>).max_tokens, 2048);

  const proScan = setup({ entitlement: { is_pro: true, expires_at: null } });
  proScan.fetch.reply(200, claudeReply("ok"));
  await proScan.handler(ask("read", { task: "label_scan" }));
  assertEquals((proScan.fetch.calls[0].body as Record<string, unknown>).tools, undefined);
});

Deno.test("a searched Pro reply returns text across blocks, deduplicated sources, and the search count", async () => {
  const { handler, fetch, db } = setup({ entitlement: { is_pro: true, expires_at: null } });
  fetch.reply(200, {
    content: [
      { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "Octagon" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://bvwine.com/octagon", title: "Octagon" }] },
      { type: "text", text: "Octagon is " },
      { type: "text", text: "their flagship." },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 500, output_tokens: 80, server_tool_use: { web_search_requests: 1 } },
  });
  const body = await readJson(await handler(ask()));
  assertEquals(body.response, "Octagon is their flagship.");
  assertEquals(body.sources, [{ url: "https://bvwine.com/octagon", title: "Octagon" }]);
  assertEquals(body.usage.web_searches, 1);
  assertEquals(body.meter, { task: "chat", limit: null, used: 1, remaining: null, isPro: true });
  const insert = db.queriesTo("chat_usage").find((q) => q.op === "insert");
  assertEquals((insert?.payload as Record<string, unknown>).web_searches, 1);
});

Deno.test("a pause_turn is resumed by re-sending the partial turn, at most twice, then the answer is stitched", async () => {
  const { handler, fetch } = setup({ entitlement: { is_pro: true, expires_at: null } });
  const paused = (text: string) => ({
    content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }, { type: "text", text }],
    stop_reason: "pause_turn",
    usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } },
  });
  fetch.reply(200, paused("part one. ")).reply(200, paused("part two. ")).reply(200, paused("part three. ")).reply(200, claudeReply("never sent"));
  const body = await readJson(await handler(ask()));
  assertEquals(fetch.calls.length, 3, "initial call plus MAX_PAUSE_RESUMES");
  assertEquals(body.response, "part one. part two. part three. ");
  assertEquals(body.usage, { input_tokens: 30, output_tokens: 15, web_searches: 3 });
  // Each resume appends the paused assistant turn verbatim and adds no user message.
  const second = fetch.calls[1].body as { messages: Record<string, unknown>[] };
  assertEquals(second.messages.length, 2);
  assertEquals(second.messages[1].role, "assistant");
  const third = fetch.calls[2].body as { messages: Record<string, unknown>[] };
  assertEquals(third.messages.length, 3);
});

Deno.test("an upstream 429 passes through as 429; any other upstream failure is a generic 502; neither is metered", async () => {
  for (const [upstream, expected] of [[429, 429], [500, 502], [400, 502], [529, 502]] as const) {
    const { handler, fetch, db } = setup({ entitlement: { is_pro: true, expires_at: null } });
    fetch.reply(upstream, { error: { type: "overloaded", message: "secret details" } });
    const res = await handler(ask());
    assertEquals(res.status, expected, `upstream ${upstream}`);
    const body = await readJson(res);
    assertEquals(body, { error: "The sommelier is unavailable right now. Please try again." });
    assertEquals(db.queriesTo("chat_usage").filter((q) => q.op === "insert").length, 0, "a failed call is not metered");
  }
});

Deno.test("a failed usage insert still returns the answer (best effort) but the optimistic meter counts it", async () => {
  const { handler, fetch, db } = setup({ counts: { window: 1 } });
  db.respond("chat_usage", (q) => (q.op === "insert" ? { error: { message: "rls" } } : { count: q.filters.some((x) => x.column === "task") ? 1 : 0, error: null }));
  fetch.reply(200, claudeReply("ok"));
  const body = await readJson(await handler(ask()));
  assertEquals(body.response, "ok");
  assertEquals(body.meter.used, 2);
});

Deno.test("usage counts and the entitlement read are scoped the way row-level security expects", () => {
  // Pinned on purpose: chat_usage counts carry NO user_id filter (RLS scopes
  // them), while the entitlements read DOES filter by user_id. If either
  // changes, the RLS probe expectations must change with it.
  const { handler, db, fetch } = setup();
  fetch.reply(200, claudeReply("ok"));
  return handler(ask()).then(() => {
    const usageReads = db.queriesTo("chat_usage").filter((q) => q.op === "select");
    assertEquals(usageReads.length, 3);
    for (const q of usageReads) {
      assert(!q.filters.some((x) => x.column === "user_id"), "chat_usage counts rely on RLS");
      assertEquals(q.options, { count: "exact", head: true });
    }
    const [ent] = db.queriesTo("entitlements");
    assertEquals(ent.filters, [{ op: "eq", column: "user_id", value: USER.id }]);
    assert(ent.modifiers.maybeSingle);
  });
});

Deno.test("an unexpected throw is a 500 with no detail leaked", async () => {
  const { handler } = setup();
  const badReq = new Request("https://edge.test/chat", { method: "POST", headers: { Authorization: "Bearer x" } });
  Object.defineProperty(badReq, "text", { value: () => Promise.reject(new Error("stream broke: /etc/secrets")) });
  const res = await handler(badReq);
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), { error: "Internal error" });
});
