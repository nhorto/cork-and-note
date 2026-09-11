// supabase/functions/routes/index.ts
// Edge Function proxy for the Google Routes API: fixed-order driving legs for
// the "Plan a wine day" tool (Pro). Design brief:
// docs/research/pro-features-ux-and-implementation-2026-09-11.md section 7.
//
// Same hardening posture as ../places:
//  - The Google key lives HERE (GOOGLE_PLACES_API_KEY, the same key the places
//    function uses; Routes API is enabled on that key), never in the app.
//  - Pro-only: entitlement is checked server-side. 402 opens the paywall.
//  - Per-user rate limiting backed by public.places_usage (mode 'route'),
//    failing closed, on top of the project-wide Google Cloud quota caps.
//  - One computeRoutes call per request, fixed stop order, no optimisation
//    and no matrix: a 10x10 matrix is 100 billed elements, one route is one.
//  - The field mask is pinned server-side (legs duration + distance only).
//    No polyline is requested: the app is mapless and never draws a Google
//    route over the Apple base map (Routes display policy).
//  - Nothing from Google is stored here. The app persists only leg minutes
//    alongside the user's own chosen stops.
import { corsHeaders } from "../_shared/cors.ts";
import { type HandlerDeps, resolveDeps } from "../_shared/deps.ts";
import { isEntitlementActive } from "../_shared/entitlements.ts";

// ── Limits ──────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 10_000;
const MAX_STOPS = 4;

const MODE = "route";
const SHORT_WINDOW_MIN = 5;
const MAX_REQUESTS_SHORT = 20; // shared window with the places modes
const MAX_ROUTES_PER_DAY = 30; // every edit of a day re-routes, so allow a busy planner

const ROUTES_FIELD_MASK = "routes.legs.duration,routes.legs.distanceMeters";

type LatLng = { lat: number; lng: number };

function readLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function toWaypoint({ lat, lng }: LatLng) {
  return { location: { latLng: { latitude: lat, longitude: lng } } };
}

/** Google returns durations as "1234s". Anything else is treated as unknown. */
function parseSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
  if (!match) return null;
  return Math.round(Number(match[1]));
}

/**
 * Build the request handler. `deps` default to the real Supabase clients,
 * `fetch`, `Deno.env` and `Date.now`; tests substitute fakes. The handler
 * itself is exactly what `Deno.serve` ran before the factory existed.
 */
export function createHandler(overrides: Partial<HandlerDeps> = {}) {
  const deps = resolveDeps(overrides);

  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors });
    }

    try {
      // ── Auth ──────────────────────────────────────────────────────────
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Missing authorization" }, 401);

      const supabaseClient = deps.createUserClient(authHeader);

      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized" }, 401);

      // ── Body ──────────────────────────────────────────────────────────
      const raw = await req.text();
      if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const origin = readLatLng(parsed.origin);
      if (!origin) return json({ error: "origin must be { lat, lng }" }, 400);

      const rawStops = parsed.stops;
      if (!Array.isArray(rawStops) || rawStops.length < 1 || rawStops.length > MAX_STOPS) {
        return json({ error: `stops must contain 1 to ${MAX_STOPS} points` }, 400);
      }
      const stops: LatLng[] = [];
      for (const item of rawStops) {
        const point = readLatLng(item);
        if (!point) return json({ error: "each stop must be { lat, lng }" }, 400);
        stops.push(point);
      }
      const returnToOrigin = parsed.returnToOrigin === true;

      // ── Pro gate (server-side; fail closed) ───────────────────────────
      const { data: entitlement, error: entitlementError } = await supabaseClient
        .from("entitlements")
        .select("is_pro, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (entitlementError) {
        console.error("Entitlement read error:", entitlementError);
        return json({ error: "Service temporarily unavailable" }, 503);
      }
      if (!isEntitlementActive(entitlement, deps.now())) {
        return json(
          { error: "Planning a wine day is a Pro feature.", code: "pro_required" },
          402
        );
      }

      // ── Rate limiting (per user, append-only places_usage) ────────────
      const now = deps.now();
      const shortWindowStart = new Date(now - SHORT_WINDOW_MIN * 60_000).toISOString();
      const dayStart = new Date(now - 24 * 60 * 60_000).toISOString();

      const [shortRes, dayRes] = await Promise.all([
        supabaseClient
          .from("places_usage")
          .select("id", { count: "exact", head: true })
          .gte("created_at", shortWindowStart),
        supabaseClient
          .from("places_usage")
          .select("id", { count: "exact", head: true })
          .eq("mode", MODE)
          .gte("created_at", dayStart),
      ]);
      // RLS auto-scopes counts to this user. Fail closed: an unreadable counter
      // refuses the metered Google call rather than running it unmetered.
      if (shortRes.error || dayRes.error) {
        console.error("Rate-limit read error:", shortRes.error, dayRes.error);
        return json({ error: "Service temporarily unavailable" }, 503);
      }
      if ((shortRes.count ?? 0) >= MAX_REQUESTS_SHORT) {
        return json({ error: "Too many requests. Please wait a few minutes." }, 429);
      }
      if ((dayRes.count ?? 0) >= MAX_ROUTES_PER_DAY) {
        return json({ error: "Daily limit reached. Please try again tomorrow." }, 429);
      }

      // ── API key ───────────────────────────────────────────────────────
      const apiKey = deps.env("GOOGLE_PLACES_API_KEY");
      if (!apiKey) {
        console.error("GOOGLE_PLACES_API_KEY not configured");
        return json({ error: "Service temporarily unavailable" }, 503);
      }

      // ── One computeRoutes call, fixed order ───────────────────────────
      const destination = returnToOrigin ? origin : stops[stops.length - 1];
      const intermediates = returnToOrigin ? stops : stops.slice(0, -1);

      const body: Record<string, unknown> = {
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      };
      if (intermediates.length > 0) body.intermediates = intermediates.map(toWaypoint);

      const res = await deps.fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Routes error:", res.status, errText);
        return json({ error: "Drive times are unavailable right now." }, 502);
      }
      const data = await res.json();
      const rawLegs: unknown[] = data?.routes?.[0]?.legs ?? [];
      const expectedLegs = intermediates.length + 1;
      if (rawLegs.length !== expectedLegs) {
        // No route (an island, a typo'd coordinate) comes back as an empty
        // routes array. Say so plainly rather than inventing a drive time.
        console.error("Routes returned", rawLegs.length, "legs, expected", expectedLegs);
        return json({ error: "No drivable route between these stops." }, 422);
      }
      const legs = rawLegs.map((leg) => {
        const { duration, distanceMeters } = leg as {
          duration?: unknown;
          distanceMeters?: unknown;
        };
        return {
          seconds: parseSeconds(duration),
          meters: typeof distanceMeters === "number" ? Math.round(distanceMeters) : null,
        };
      });

      // ── Record usage (append-only; best-effort) ───────────────────────
      const { error: usageError } = await supabaseClient
        .from("places_usage")
        .insert({ user_id: user.id, mode: MODE });
      if (usageError) console.error("Failed to record places_usage:", usageError);

      return json({ legs });
    } catch (error) {
      console.error("Edge function error:", error);
      return json({ error: "Internal error" }, 500);
    }
  };
}

if (import.meta.main) Deno.serve(createHandler());
