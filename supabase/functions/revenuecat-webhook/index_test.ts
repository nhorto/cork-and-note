// The RevenueCat webhook is the only writer of public.entitlements, and it
// runs without a user JWT: a shared secret is its whole authentication. So:
// every way in without the right secret is refused, every event type maps to
// the right row, and a failed write is a 5xx so RevenueCat retries.
import { assert, assertEquals } from "jsr:@std/assert";
import { createHandler } from "./index.ts";
import { fakeDeps, jsonRequest, readJson } from "../_shared/testing.ts";

const SECRET = "whsec_correct_horse_battery";
const UID = "00000000-0000-4000-8000-000000000042";
const OTHER = "00000000-0000-4000-8000-000000000099";

function setup(env: Record<string, string | undefined> = { REVENUECAT_WEBHOOK_SECRET: SECRET }) {
  const f = fakeDeps({ env });
  return { ...f, handler: createHandler(f.deps) };
}

const event = (type: string, extra: Record<string, unknown> = {}) =>
  jsonRequest(
    {
      api_version: "1.0",
      event: {
        type,
        app_user_id: UID,
        entitlement_ids: ["pro"],
        expiration_at_ms: Date.UTC(2027, 0, 1),
        ...extra,
      },
    },
    { auth: SECRET, url: "https://edge.test/revenuecat-webhook" },
  );

Deno.test("only POST is accepted, and there are no CORS headers on purpose", async () => {
  const { handler } = setup();
  const res = await handler(new Request("https://edge.test/w", { method: "GET", headers: { Authorization: SECRET } }));
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  const opt = await handler(new Request("https://edge.test/w", { method: "OPTIONS" }));
  assertEquals(opt.status, 405);
});

Deno.test("with no secret configured every request is refused with 503, never accepted open", async () => {
  const { handler, admin } = setup({ REVENUECAT_WEBHOOK_SECRET: undefined });
  const res = await handler(event("INITIAL_PURCHASE"));
  assertEquals(res.status, 503);
  assertEquals(admin.queries.length, 0);
});

Deno.test("a wrong secret is 401: missing, wrong length, same length, prefix, and a Bearer-prefixed one", async () => {
  // Header values are whitespace-trimmed by HTTP itself before a handler sees
  // them, so a padded secret is not a distinct case.
  for (const auth of ["", "wrong", SECRET.slice(0, -1) + "X", SECRET.slice(0, -1), "Bearer " + SECRET]) {
    const { handler, admin } = setup();
    const req = jsonRequest({ event: { type: "INITIAL_PURCHASE", app_user_id: UID, entitlement_ids: ["pro"] } }, { auth });
    const res = await handler(req);
    assertEquals(res.status, 401, JSON.stringify(auth));
    assertEquals(admin.queries.length, 0);
  }
});

Deno.test("malformed JSON with the right secret is 400", async () => {
  const { handler } = setup();
  const res = await handler(jsonRequest("{nope", { auth: SECRET }));
  assertEquals(res.status, 400);
});

Deno.test("a purchase grants Pro for that user with the expiry, upserted on user_id and stamped with the clock", async () => {
  const { handler, admin, now } = setup();
  const res = await handler(event("INITIAL_PURCHASE"));
  assertEquals(res.status, 200);
  assertEquals(await readJson(res), { ok: true, updated: 1 });
  const [q] = admin.queriesTo("entitlements");
  assertEquals(q.op, "upsert");
  assertEquals(q.options, { onConflict: "user_id" });
  assertEquals(q.payload, [{
    user_id: UID,
    is_pro: true,
    expires_at: new Date(Date.UTC(2027, 0, 1)).toISOString(),
    source: "revenuecat",
    updated_at: new Date(now).toISOString(),
  }]);
});

Deno.test("a sandbox event is recorded as such, so a test purchase is never mistaken for revenue", async () => {
  const { handler, admin } = setup();
  await handler(event("INITIAL_PURCHASE", { environment: "SANDBOX" }));
  const [row] = admin.queriesTo("entitlements")[0].payload as Record<string, unknown>[];
  assertEquals(row.source, "revenuecat_sandbox");
  assertEquals(row.is_pro, true);
});

Deno.test("every event type lands the right entitlement state", async () => {
  const future = Date.UTC(2027, 0, 1);
  const past = Date.UTC(2020, 0, 1);
  const cases: [string, Record<string, unknown>, boolean | null][] = [
    ["RENEWAL", { expiration_at_ms: future }, true],
    ["UNCANCELLATION", { expiration_at_ms: future }, true],
    ["PRODUCT_CHANGE", { expiration_at_ms: future }, true],
    ["CANCELLATION", { expiration_at_ms: future }, true], // cancelled but paid through the period
    ["BILLING_ISSUE", { expiration_at_ms: future }, true], // grace period: still entitled until it lapses
    ["EXPIRATION", { expiration_at_ms: past }, false],
    ["SUBSCRIPTION_PAUSED", { expiration_at_ms: future }, false],
    ["RENEWAL", { expiration_at_ms: past }, false], // an already-lapsed period is not Pro
    ["INITIAL_PURCHASE", { expiration_at_ms: undefined }, true], // a lifetime grant has no expiry
    ["TEST", { app_user_id: "$RCAnonymousID:dashboard" }, null], // RevenueCat's dashboard ping carries no account
  ];
  for (const [type, extra, expectedPro] of cases) {
    const { handler, admin } = setup();
    const res = await handler(event(type, extra));
    assertEquals(res.status, 200, type);
    const body = await readJson(res);
    if (expectedPro === null) {
      assertEquals(body, { ok: true, updated: 0 }, type);
      assertEquals(admin.queries.length, 0, type);
      continue;
    }
    assertEquals(body.updated, 1, type);
    const [row] = admin.queriesTo("entitlements")[0].payload as Record<string, unknown>[];
    assertEquals(row.user_id, UID, type);
    assertEquals(row.is_pro, expectedPro, type);
  }
});

Deno.test("a TRANSFER revokes every previous owner that is one of ours; the new owner gets its own event", async () => {
  const { handler, admin } = setup();
  const res = await handler(event("TRANSFER", { transferred_from: [OTHER, "$RCAnonymousID:abc"], transferred_to: [UID] }));
  assertEquals(await readJson(res), { ok: true, updated: 1 });
  const rows = admin.queriesTo("entitlements")[0].payload as Record<string, unknown>[];
  assertEquals(rows.map((r) => [r.user_id, r.is_pro, r.expires_at]), [[OTHER, false, null]]);
});

Deno.test("events for other entitlements, anonymous ids, or no user are acknowledged with zero updates", async () => {
  const cases = [
    event("INITIAL_PURCHASE", { entitlement_ids: ["premium_cellar"] }),
    event("INITIAL_PURCHASE", { entitlement_ids: [] }),
    event("INITIAL_PURCHASE", { app_user_id: "$RCAnonymousID:1234" }),
    event("INITIAL_PURCHASE", { app_user_id: "not-a-uuid" }),
    event("INITIAL_PURCHASE", { app_user_id: undefined }),
    jsonRequest({ hello: "world" }, { auth: SECRET }),
  ];
  for (const req of cases) {
    const { handler, admin } = setup();
    const res = await handler(req);
    assertEquals(res.status, 200);
    assertEquals(await readJson(res), { ok: true, updated: 0 });
    assertEquals(admin.queries.length, 0);
  }
});

Deno.test("a failed upsert is a 500 so RevenueCat retries instead of dropping a paying user", async () => {
  const { handler, admin } = setup();
  admin.respond("entitlements", { error: { message: "connection reset" } });
  const res = await handler(event("INITIAL_PURCHASE"));
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), { error: "Upsert failed" });
});

Deno.test("the write goes through the service-role client, never the caller's", async () => {
  const { handler, admin, db } = setup();
  await handler(event("RENEWAL"));
  assert(admin.queries.length === 1);
  assertEquals(db.queries.length, 0);
});
