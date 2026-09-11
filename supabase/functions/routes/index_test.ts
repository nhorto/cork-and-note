// The routes proxy: Pro-only, one Google call per request in fixed order with
// a pinned field mask, capped per user, and honest about "no route".
import { assertEquals } from "jsr:@std/assert";
import { createHandler } from "./index.ts";
import { fakeDeps, jsonRequest, readJson } from "../_shared/testing.ts";

const USER = { id: "00000000-0000-4000-8000-000000000003" };
const PRO = { is_pro: true, expires_at: "2027-01-01T00:00:00.000Z" };
const origin = { lat: 38.9, lng: -77.4 };
const stops = [{ lat: 38.17, lng: -78.28 }, { lat: 38.4, lng: -78.1 }];

function setup({ entitlement = PRO as typeof PRO | null, counts = { short: 0, day: 0 }, env = { GOOGLE_PLACES_API_KEY: "g-key" } as Record<string, string | undefined> } = {}) {
  const f = fakeDeps({ user: USER, env });
  f.db.respond("entitlements", { data: entitlement, error: null });
  f.db.respond("places_usage", (q) => {
    if (q.op === "insert") return { error: null };
    return { count: q.filters.some((x) => x.column === "mode") ? counts.day : counts.short, error: null };
  });
  return { ...f, handler: createHandler(f.deps) };
}

const req = (body: unknown) => jsonRequest(body, { url: "https://edge.test/routes" });
const googleLegs = (n: number) => ({ routes: [{ legs: Array.from({ length: n }, (_, i) => ({ duration: `${(i + 1) * 600}s`, distanceMeters: (i + 1) * 10_000.4 })) }] });

Deno.test("input validation: origin and one to four in-range stops", async () => {
  const cases: [unknown, string][] = [
    [{ stops }, "origin must be { lat, lng }"],
    [{ origin: { lat: "38", lng: -77 }, stops }, "origin must be { lat, lng }"],
    [{ origin: { lat: 91, lng: 0 }, stops }, "origin must be { lat, lng }"],
    [{ origin, stops: [] }, "stops must contain 1 to 4 points"],
    [{ origin, stops: Array(5).fill(stops[0]) }, "stops must contain 1 to 4 points"],
    [{ origin, stops: [{ lat: NaN, lng: 1 }] }, "each stop must be { lat, lng }"],
    [{ origin, stops: [{ lat: 1, lng: 181 }] }, "each stop must be { lat, lng }"],
  ];
  for (const [body, message] of cases) {
    const { handler, fetch, db } = setup();
    const res = await handler(req(body));
    assertEquals(res.status, 400, message);
    assertEquals(await readJson(res), { error: message });
    assertEquals(fetch.calls.length, 0);
    assertEquals(db.queriesTo("entitlements").length, 0, "validated before any read");
  }
  const { handler } = setup();
  assertEquals((await handler(jsonRequest("x".repeat(10_001)))).status, 413);
  assertEquals((await handler(jsonRequest("{"))).status, 400);
});

Deno.test("a free user is refused with the paywall code before any counting or Google call", async () => {
  const { handler, fetch, db } = setup({ entitlement: null });
  const res = await handler(req({ origin, stops }));
  assertEquals(res.status, 402);
  assertEquals(await readJson(res), { error: "Planning a wine day is a Pro feature.", code: "pro_required" });
  assertEquals(db.queriesTo("places_usage").length, 0);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("an unreadable entitlement or counter fails closed with 503", async () => {
  const a = setup();
  a.db.respond("entitlements", { data: null, error: { message: "x" } });
  assertEquals((await a.handler(req({ origin, stops }))).status, 503);
  const b = setup();
  b.db.respond("places_usage", { count: null, error: { message: "x" } });
  assertEquals((await b.handler(req({ origin, stops }))).status, 503);
  assertEquals(b.fetch.calls.length, 0);
});

Deno.test("the 5-minute window is shared across modes and the day cap is per route", async () => {
  const short = setup({ counts: { short: 20, day: 0 } });
  const r1 = await short.handler(req({ origin, stops }));
  assertEquals(r1.status, 429);
  assertEquals((await readJson(r1)).error, "Too many requests. Please wait a few minutes.");

  const day = setup({ counts: { short: 0, day: 30 } });
  const r2 = await day.handler(req({ origin, stops }));
  assertEquals(r2.status, 429);
  assertEquals((await readJson(r2)).error, "Daily limit reached. Please try again tomorrow.");
  const dayQuery = day.db.queriesTo("places_usage").find((q) => q.filters.some((x) => x.column === "mode"));
  assertEquals(dayQuery?.filters.find((x) => x.column === "mode")?.value, "route");
});

Deno.test("a missing Google key is 503 after the gate", async () => {
  const { handler, fetch } = setup({ env: { GOOGLE_PLACES_API_KEY: undefined } });
  assertEquals((await handler(req({ origin, stops }))).status, 503);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("one computeRoutes call in fixed order with the pinned field mask, and legs parsed to whole seconds and meters", async () => {
  const { handler, fetch, db } = setup();
  fetch.reply(200, googleLegs(2));
  const res = await handler(req({ origin, stops }));
  assertEquals(res.status, 200);
  assertEquals(await readJson(res), { legs: [{ seconds: 600, meters: 10_000 }, { seconds: 1200, meters: 20_001 }] });

  assertEquals(fetch.calls.length, 1);
  const [call] = fetch.calls;
  assertEquals(call.url, "https://routes.googleapis.com/directions/v2:computeRoutes");
  const headers = call.init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-Api-Key"], "g-key");
  assertEquals(headers["X-Goog-FieldMask"], "routes.legs.duration,routes.legs.distanceMeters");
  assertEquals(call.body, {
    origin: { location: { latLng: { latitude: 38.9, longitude: -77.4 } } },
    destination: { location: { latLng: { latitude: 38.4, longitude: -78.1 } } },
    intermediates: [{ location: { latLng: { latitude: 38.17, longitude: -78.28 } } }],
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  });
  const insert = db.queriesTo("places_usage").find((q) => q.op === "insert");
  assertEquals(insert?.payload, { user_id: USER.id, mode: "route" });
});

Deno.test("returnToOrigin makes the origin the destination and every stop an intermediate", async () => {
  const { handler, fetch } = setup();
  fetch.reply(200, googleLegs(3));
  const res = await handler(req({ origin, stops, returnToOrigin: true }));
  assertEquals(res.status, 200);
  assertEquals((await readJson(res)).legs.length, 3);
  const body = fetch.calls[0].body as Record<string, unknown>;
  assertEquals(body.destination, body.origin);
  assertEquals((body.intermediates as unknown[]).length, 2);
});

Deno.test("a single stop sends no intermediates key at all", async () => {
  const { handler, fetch } = setup();
  fetch.reply(200, googleLegs(1));
  await handler(req({ origin, stops: [stops[0]] }));
  assertEquals("intermediates" in (fetch.calls[0].body as Record<string, unknown>), false);
});

Deno.test("no route back from Google is a 422 that says so, not an invented drive time, and is not metered", async () => {
  for (const reply of [{ routes: [] }, {}, googleLegs(1)]) {
    const { handler, fetch, db } = setup();
    fetch.reply(200, reply);
    const res = await handler(req({ origin, stops }));
    assertEquals(res.status, 422);
    assertEquals(await readJson(res), { error: "No drivable route between these stops." });
    assertEquals(db.queriesTo("places_usage").filter((q) => q.op === "insert").length, 0);
  }
});

Deno.test("an unparseable leg is reported as unknown rather than a wrong number", async () => {
  const { handler, fetch } = setup();
  fetch.reply(200, { routes: [{ legs: [{ duration: "soon", distanceMeters: "far" }, { duration: "90.6s", distanceMeters: 5 }] }] });
  const res = await handler(req({ origin, stops }));
  assertEquals(await readJson(res), { legs: [{ seconds: null, meters: null }, { seconds: 91, meters: 5 }] });
});

Deno.test("a Google failure is a generic 502 with the detail kept server-side", async () => {
  const { handler, fetch } = setup();
  fetch.reply(403, { error: { message: "API key not valid. Please pass a valid API key." } });
  const res = await handler(req({ origin, stops }));
  assertEquals(res.status, 502);
  assertEquals(await readJson(res), { error: "Drive times are unavailable right now." });
});
