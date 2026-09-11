// The Google Places proxy: Pro-only, three modes each with a pinned field
// mask (that is what controls the billing SKU), per-user caps, strict input
// shapes, and a service-role write-back that must never let a client re-point
// a directory row at a different Google place.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { createHandler } from "./index.ts";
import { fakeDeps, jsonRequest, readJson } from "../_shared/testing.ts";

const USER = { id: "00000000-0000-4000-8000-000000000005" };
const PRO = { is_pro: true, expires_at: "2027-01-01T00:00:00.000Z" };
const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

function setup({ entitlement = PRO as typeof PRO | null, counts = { short: 0, day: 0 }, env = { GOOGLE_PLACES_API_KEY: "g-key" } as Record<string, string | undefined> } = {}) {
  const f = fakeDeps({ user: USER, env });
  f.db.respond("entitlements", { data: entitlement, error: null });
  f.db.respond("places_usage", (q) => {
    if (q.op === "insert") return { error: null };
    return { count: q.filters.some((x) => x.column === "mode") ? counts.day : counts.short, error: null };
  });
  return { ...f, handler: createHandler(f.deps) };
}

const req = (body: unknown) => jsonRequest(body, { url: "https://edge.test/places" });
const googlePlace = (extra: Record<string, unknown> = {}) => ({
  id: PLACE_ID,
  displayName: { text: "Barboursville Vineyards" },
  businessStatus: "OPERATIONAL",
  rating: 4.6,
  userRatingCount: 1200,
  currentOpeningHours: { openNow: true },
  regularOpeningHours: { weekdayDescriptions: ["Monday: 10 AM to 5 PM"] },
  websiteUri: "https://bbvwine.com",
  nationalPhoneNumber: "(540) 832-3824",
  googleMapsUri: "https://maps.google.com/?cid=1",
  photos: [{ name: `places/${PLACE_ID}/photos/abc` }, { name: `places/${PLACE_ID}/photos/def` }],
  ...extra,
});

Deno.test("mode is validated before the entitlement is read", async () => {
  for (const body of [{}, { mode: "nearby" }, { mode: 42 }]) {
    const { handler, db } = setup();
    const res = await handler(req(body));
    assertEquals(res.status, 400);
    assertEquals(await readJson(res), { error: "mode must be one of details, match, photo" });
    assertEquals(db.queriesTo("entitlements").length, 0);
  }
});

Deno.test("a free user is refused with the paywall code before counting or calling Google", async () => {
  const { handler, fetch, db } = setup({ entitlement: null });
  const res = await handler(req({ mode: "details", place_id: PLACE_ID }));
  assertEquals(res.status, 402);
  assertEquals(await readJson(res), { error: "Winery details are a Pro feature.", code: "pro_required" });
  assertEquals(db.queriesTo("places_usage").length, 0);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("each mode has its own daily cap, and the 5-minute window is shared", async () => {
  for (const [mode, cap] of [["details", 40], ["match", 40], ["photo", 60]] as const) {
    const under = setup({ counts: { short: 0, day: cap - 1 } });
    under.fetch.reply(200, mode === "details" ? googlePlace() : mode === "match" ? { places: [] } : { photoUri: "https://x" });
    const body = { mode, place_id: PLACE_ID, name: "Barboursville", photo_name: `places/${PLACE_ID}/photos/abc` };
    assertEquals((await under.handler(req(body))).status, 200, `${mode} under cap`);

    const at = setup({ counts: { short: 0, day: cap } });
    const res = await at.handler(req(body));
    assertEquals(res.status, 429, `${mode} at cap`);
    assertEquals((await readJson(res)).error, "Daily limit reached. Please try again tomorrow.");
    assertEquals(at.fetch.calls.length, 0);
    const dayQuery = at.db.queriesTo("places_usage").find((q) => q.filters.some((x) => x.column === "mode"));
    assertEquals(dayQuery?.filters.find((x) => x.column === "mode")?.value, mode);
  }
  const burst = setup({ counts: { short: 20, day: 0 } });
  assertEquals((await burst.handler(req({ mode: "match", name: "x y" }))).status, 429);
});

Deno.test("an unreadable entitlement or counter fails closed, and a missing key is 503", async () => {
  const a = setup();
  a.db.respond("entitlements", { data: null, error: { message: "x" } });
  assertEquals((await a.handler(req({ mode: "details", place_id: PLACE_ID }))).status, 503);
  const b = setup();
  b.db.respond("places_usage", { count: null, error: { message: "x" } });
  assertEquals((await b.handler(req({ mode: "details", place_id: PLACE_ID }))).status, 503);
  const c = setup({ env: { GOOGLE_PLACES_API_KEY: undefined } });
  assertEquals((await c.handler(req({ mode: "details", place_id: PLACE_ID }))).status, 503);
  assertEquals(c.fetch.calls.length, 0);
});

Deno.test("details: the place id must match the strict pattern", async () => {
  for (const place_id of [undefined, "", "short", "has space " + "x".repeat(20), "x".repeat(201), "a/../b" + "x".repeat(10), "id;drop" + "x".repeat(10)]) {
    const { handler, fetch } = setup();
    const res = await handler(req({ mode: "details", place_id }));
    assertEquals(res.status, 400, JSON.stringify(place_id));
    assertEquals(await readJson(res), { error: "place_id is required" });
    assertEquals(fetch.calls.length, 0);
  }
});

Deno.test("details: pinned field mask, flattened result, first photo only, usage recorded", async () => {
  const { handler, fetch, db } = setup();
  fetch.reply(200, googlePlace());
  const res = await handler(req({ mode: "details", place_id: PLACE_ID }));
  assertEquals(res.status, 200);
  assertEquals(await readJson(res), {
    mode: "details",
    place_id: PLACE_ID,
    name: "Barboursville Vineyards",
    business_status: "OPERATIONAL",
    rating: 4.6,
    rating_count: 1200,
    open_now: true,
    weekday_hours: ["Monday: 10 AM to 5 PM"],
    website: "https://bbvwine.com",
    phone: "(540) 832-3824",
    google_maps_uri: "https://maps.google.com/?cid=1",
    photo_name: `places/${PLACE_ID}/photos/abc`,
  });
  const [call] = fetch.calls;
  assertEquals(call.url, `https://places.googleapis.com/v1/places/${PLACE_ID}`);
  const headers = call.init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-Api-Key"], "g-key");
  assertEquals(headers["X-Goog-FieldMask"], "id,displayName,businessStatus,rating,userRatingCount,regularOpeningHours.weekdayDescriptions,currentOpeningHours.openNow,websiteUri,nationalPhoneNumber,googleMapsUri,photos.name");
  assertEquals(db.queriesTo("places_usage").find((q) => q.op === "insert")?.payload, { user_id: USER.id, mode: "details" });
});

Deno.test("details: a place with no hours, photos or rating flattens to nulls rather than throwing", async () => {
  const { handler, fetch } = setup();
  fetch.reply(200, { id: PLACE_ID, displayName: { text: "Tiny" } });
  const body = await readJson(await handler(req({ mode: "details", place_id: PLACE_ID })));
  assertEquals(body.rating, null);
  assertEquals(body.open_now, null);
  assertEquals(body.weekday_hours, null);
  assertEquals(body.photo_name, null);
  assertEquals(body.business_status, null);
});

Deno.test("details write-back: operating status is stamped on the directory row by place id, through the service role", async () => {
  const { handler, fetch, admin, db, now } = setup();
  fetch.reply(200, googlePlace({ businessStatus: "CLOSED_PERMANENTLY" }));
  await handler(req({ mode: "details", place_id: PLACE_ID }));
  const [q] = admin.queriesTo("winery_directory");
  assertEquals(q.op, "update");
  assertEquals(q.payload, { operating_status: "permanently_closed", updated_at: new Date(now).toISOString() });
  assertEquals(q.filters, [
    { op: "eq", column: "google_place_id", value: PLACE_ID },
    // A row flagged as a duplicate (#271) is never revived by a stamp.
    { op: "or", column: "", value: "operating_status.is.null,operating_status.neq.duplicate" },
  ]);
  assertEquals(db.queriesTo("winery_directory").length, 0, "never through the caller's client");
});

Deno.test("details write-back with a directory id attaches the place id only to an unattached or same-place row", async () => {
  const { handler, fetch, admin } = setup();
  fetch.reply(200, googlePlace({ businessStatus: "CLOSED_TEMPORARILY" }));
  await handler(req({ mode: "details", place_id: PLACE_ID, directory_id: 4242 }));
  const [q] = admin.queriesTo("winery_directory");
  assertEquals(q.payload, { operating_status: "temporarily_closed", updated_at: q.payload && (q.payload as Record<string, unknown>).updated_at, google_place_id: PLACE_ID });
  assertEquals(q.filters[0], { op: "eq", column: "id", value: 4242 });
  // The guard clause: the row must have no place id yet, or the same one.
  assertEquals(q.filters[1], { op: "or", column: "", value: `google_place_id.is.null,google_place_id.eq.${PLACE_ID}` });
  // And never a duplicate row (#271).
  assertEquals(q.filters[2], { op: "or", column: "", value: "operating_status.is.null,operating_status.neq.duplicate" });
});

Deno.test("details write-back: a bogus directory id falls back to the place-id stamp; an unknown status writes nothing", async () => {
  for (const directory_id of [-1, 0, 1.5, "4242", null]) {
    const { handler, fetch, admin } = setup();
    fetch.reply(200, googlePlace());
    await handler(req({ mode: "details", place_id: PLACE_ID, directory_id }));
    const [q] = admin.queriesTo("winery_directory");
    assertEquals(q.filters[0].column, "google_place_id", JSON.stringify(directory_id));
    assertEquals((q.payload as Record<string, unknown>).google_place_id, undefined);
  }
  const { handler, fetch, admin } = setup();
  fetch.reply(200, googlePlace({ businessStatus: "SOMETHING_NEW" }));
  await handler(req({ mode: "details", place_id: PLACE_ID }));
  assertEquals(admin.queriesTo("winery_directory").length, 0);
});

Deno.test("details write-back failure never breaks the details response", async () => {
  const { handler, fetch, admin } = setup();
  admin.respond("winery_directory", { error: { message: "permission denied" } });
  fetch.reply(200, googlePlace());
  const res = await handler(req({ mode: "details", place_id: PLACE_ID }));
  assertEquals(res.status, 200);
  assertEquals((await readJson(res)).name, "Barboursville Vineyards");
});

Deno.test("match: name length is enforced, the query is biased to the stored pin, and the mask is IDs-only", async () => {
  for (const name of [undefined, "", "a", " a ", "x".repeat(201)]) {
    const { handler, fetch } = setup();
    assertEquals((await handler(req({ mode: "match", name }))).status, 400, JSON.stringify(name));
    assertEquals(fetch.calls.length, 0);
  }
  const { handler, fetch } = setup();
  fetch.reply(200, { places: [{ id: PLACE_ID, displayName: { text: "Barboursville Vineyards" }, formattedAddress: "17655 Winery Rd" }, { id: "x".repeat(20) }] });
  const res = await handler(req({ mode: "match", name: "  Barboursville ", lat: 38.17, lng: -78.28 }));
  assertEquals(await readJson(res), {
    mode: "match",
    candidates: [
      { place_id: PLACE_ID, name: "Barboursville Vineyards", address: "17655 Winery Rd" },
      { place_id: "x".repeat(20), name: null, address: null },
    ],
  });
  const [call] = fetch.calls;
  assertEquals(call.url, "https://places.googleapis.com/v1/places:searchText");
  assertEquals((call.init?.headers as Record<string, string>)["X-Goog-FieldMask"], "places.id,places.displayName,places.formattedAddress");
  assertEquals(call.body, {
    textQuery: "Barboursville winery",
    pageSize: 3,
    locationBias: { circle: { center: { latitude: 38.17, longitude: -78.28 }, radius: 5000 } },
  });
});

Deno.test("match: out-of-range or missing coordinates simply drop the bias", async () => {
  for (const coords of [{}, { lat: 95, lng: 0 }, { lat: "38", lng: -78 }]) {
    const { handler, fetch } = setup();
    fetch.reply(200, { places: [] });
    await handler(req({ mode: "match", name: "Barboursville", ...coords }));
    assertEquals("locationBias" in (fetch.calls[0].body as Record<string, unknown>), false, JSON.stringify(coords));
  }
});

Deno.test("photo: the resource name must be a Places photo path, and the width and redirect flag are pinned", async () => {
  for (const photo_name of [undefined, "abc", "places/x/photos/", "places/x/photos/a/b", "https://evil/places/x/photos/y", "places/x/photos/y?x=1"]) {
    const { handler, fetch } = setup();
    assertEquals((await handler(req({ mode: "photo", photo_name }))).status, 400, JSON.stringify(photo_name));
    assertEquals(fetch.calls.length, 0);
  }
  const { handler, fetch } = setup();
  fetch.reply(200, { photoUri: "https://lh3.googleusercontent.com/p/abc" });
  const res = await handler(req({ mode: "photo", photo_name: `places/${PLACE_ID}/photos/abc` }));
  assertEquals(await readJson(res), { mode: "photo", photo_uri: "https://lh3.googleusercontent.com/p/abc" });
  assertEquals(fetch.calls[0].url, `https://places.googleapis.com/v1/places/${PLACE_ID}/photos/abc/media?maxWidthPx=1200&skipHttpRedirect=true`);
});

Deno.test("a Google failure in any mode is a generic 502 with its own copy, and is not metered", async () => {
  const cases = [
    [{ mode: "details", place_id: PLACE_ID }, "Winery details are unavailable right now."],
    [{ mode: "match", name: "Barboursville" }, "Winery lookup is unavailable right now."],
    [{ mode: "photo", photo_name: `places/${PLACE_ID}/photos/abc` }, "Photo unavailable right now."],
  ] as const;
  for (const [body, message] of cases) {
    const { handler, fetch, db } = setup();
    fetch.reply(403, { error: { message: "API key not valid" } });
    const res = await handler(req(body));
    assertEquals(res.status, 502);
    assertEquals(await readJson(res), { error: message });
    assertEquals(db.queriesTo("places_usage").filter((q) => q.op === "insert").length, 0);
  }
});

Deno.test("the Google key is never echoed in any response", async () => {
  const { handler, fetch } = setup();
  fetch.reply(500, "internal g-key leak");
  const res = await handler(req({ mode: "details", place_id: PLACE_ID }));
  const text = await res.text();
  assertEquals(text.includes("g-key"), false);
  assertStringIncludes(text, "unavailable");
});
