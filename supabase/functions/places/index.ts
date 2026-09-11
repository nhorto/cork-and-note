// supabase/functions/places/index.ts
// Edge Function proxy for Google Places API (New) — winery enrichment (Pro).
// Cost-lean plan: docs/research/winery-enrichment-google-places.md §2.5.
//
// Design rules (same hardening posture as ../chat):
//  - The Google key lives HERE (GOOGLE_PLACES_API_KEY secret), never in the app.
//  - Pro-only: entitlement is checked server-side; a patched client must not
//    be able to buy Google calls. 402 → the app opens the paywall.
//  - Per-user rate limiting backed by public.places_usage (fail closed), on
//    top of the project-wide per-day quota caps set in Google Cloud — those
//    caps are the structural spend ceiling; these limits stop any single user
//    from eating the whole daily budget.
//  - Field masks are pinned server-side per mode. The mask decides the billed
//    SKU, so the client never influences it:
//      details → Place Details Enterprise (rating/hours/phone/website)
//      match   → Text Search IDs-Only (FREE — populates wineries.google_place_id)
//      photo   → Place Photos (one size-capped URI lookup)
//    No editorialSummary (that's Enterprise+Atmosphere, +$5/1K) at launch.
//  - Nothing from Google is stored except place IDs (policy: IDs are storable
//    indefinitely; ratings/hours/photos are live-fetch only). Deliberate
//    exception (#225): businessStatus is folded into our own directory's
//    operating_status flag — a store of the *fact* that a winery closed, kept
//    to our Overture-seeded rows, not a cache of Google content for display.
import { corsHeaders } from "../_shared/cors.ts";
import { type HandlerDeps, resolveDeps } from "../_shared/deps.ts";
import { isEntitlementActive } from "../_shared/entitlements.ts";

// ── Limits ──────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 10_000;

const MODES = ["details", "match", "photo"] as const;
type Mode = (typeof MODES)[number];

// Rate limits (per authenticated user)
const SHORT_WINDOW_MIN = 5;
const MAX_REQUESTS_SHORT = 20; // ≤20 places calls / 5 min (any mode)
// Record<Mode, …>, not Record<string, …>: a `string` key type accepts a missing
// mode and hands back `undefined`, and `count >= undefined` is false — so the
// cap would silently never fire. That is exactly how Tonight's Pick shipped
// uncapped (see _shared/entitlements.ts). All three modes are covered today;
// this makes it impossible for a fourth to arrive without one.
const MAX_PER_DAY: Record<Mode, number> = {
  details: 40, // ~8 winery-page opens/user/mo in the model; 40/day is generous
  match: 40, // one-time per winery record, then stored
  photo: 60,
};

// Field masks pinned per mode (SKU control — see header comment).
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "businessStatus",
  "rating",
  "userRatingCount",
  "regularOpeningHours.weekdayDescriptions",
  "currentOpeningHours.openNow",
  "websiteUri",
  "nationalPhoneNumber",
  "googleMapsUri",
  "photos.name",
].join(",");

// Google businessStatus → winery_directory.operating_status (#225). A details
// call is the one moment we learn a directory winery's real-world status for
// free (the field rides along on the SKU we already pay for), so we write it
// back — future users' discovery pins reflect it without their own Pro call.
const BUSINESS_STATUS_TO_OPERATING: Record<string, string> = {
  OPERATIONAL: "open", // also clears a stale 'possibly_closed' re-ingest flag
  CLOSED_TEMPORARILY: "temporarily_closed",
  CLOSED_PERMANENTLY: "permanently_closed",
};

const MATCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress";

const MAX_PHOTO_WIDTH = 1200;

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

      const mode = parsed.mode as Mode;
      if (!MODES.includes(mode)) {
        return json({ error: "mode must be one of details, match, photo" }, 400);
      }

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
          { error: "Winery details are a Pro feature.", code: "pro_required" },
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
          .eq("mode", mode)
          .gte("created_at", dayStart),
      ]);
      // RLS auto-scopes counts to this user. Fail closed: unreadable counter →
      // refuse the (metered) Google call rather than run it unmetered.
      if (shortRes.error || dayRes.error) {
        console.error("Rate-limit read error:", shortRes.error, dayRes.error);
        return json({ error: "Service temporarily unavailable" }, 503);
      }
      if ((shortRes.count ?? 0) >= MAX_REQUESTS_SHORT) {
        return json({ error: "Too many requests. Please wait a few minutes." }, 429);
      }
      if ((dayRes.count ?? 0) >= MAX_PER_DAY[mode]) {
        return json({ error: "Daily limit reached. Please try again tomorrow." }, 429);
      }

      // ── API key ───────────────────────────────────────────────────────
      const apiKey = deps.env("GOOGLE_PLACES_API_KEY");
      if (!apiKey) {
        console.error("GOOGLE_PLACES_API_KEY not configured");
        return json({ error: "Service temporarily unavailable" }, 503);
      }

      // ── Dispatch ──────────────────────────────────────────────────────
      let result: unknown;

      if (mode === "details") {
        const placeId = parsed.place_id;
        if (typeof placeId !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(placeId)) {
          return json({ error: "place_id is required" }, 400);
        }
        const res = await deps.fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
          {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": DETAILS_FIELD_MASK,
            },
          }
        );
        if (!res.ok) {
          const errText = await res.text();
          console.error("Places details error:", res.status, errText);
          return json({ error: "Winery details are unavailable right now." }, 502);
        }
        const place = await res.json();

        // Freshness write-back (#225): stamp the matching winery_directory row.
        // The table has no client-write policies, so this uses the service role.
        // Best-effort — a write failure must never break the details response.
        const operatingStatus = BUSINESS_STATUS_TO_OPERATING[place.businessStatus as string];
        if (operatingStatus) {
          try {
            const admin = deps.createAdminClient();
            const stamp = {
              operating_status: operatingStatus,
              updated_at: new Date(deps.now()).toISOString(),
            };
            // The client sends directory_id when the winery page came from a
            // directory pin (promotion doesn't persist the link on wineries, so
            // it only survives that first navigation). With it we can also
            // attach google_place_id to the directory row, which makes every
            // later place-id-only match below actually hit.
            const directoryId = parsed.directory_id;
            if (typeof directoryId === "number" && Number.isInteger(directoryId) && directoryId > 0) {
              // Guard: only stamp when the row has no place id yet or the same
              // one — a hostile client must not re-point an attached row at a
              // different Google place. (placeId is regex-validated above, so
              // interpolating it into the filter is safe.)
              const { error } = await admin
                .from("winery_directory")
                .update({ ...stamp, google_place_id: placeId })
                .eq("id", directoryId)
                .or(`google_place_id.is.null,google_place_id.eq.${placeId}`)
                // Never revive a row flagged as a duplicate (#271): the kept
                // row is the one that should carry the status.
                .or("operating_status.is.null,operating_status.neq.duplicate");
              if (error) console.error("Directory status write-back error:", error);
            } else {
              const { error } = await admin
                .from("winery_directory")
                .update(stamp)
                .eq("google_place_id", placeId)
                .or("operating_status.is.null,operating_status.neq.duplicate");
              if (error) console.error("Directory status write-back error:", error);
            }
          } catch (writeBackError) {
            console.error("Directory status write-back failed:", writeBackError);
          }
        }

        result = {
          place_id: place.id,
          name: place.displayName?.text ?? null,
          business_status: place.businessStatus ?? null,
          rating: place.rating ?? null,
          rating_count: place.userRatingCount ?? null,
          open_now: place.currentOpeningHours?.openNow ?? null,
          weekday_hours: place.regularOpeningHours?.weekdayDescriptions ?? null,
          website: place.websiteUri ?? null,
          phone: place.nationalPhoneNumber ?? null,
          google_maps_uri: place.googleMapsUri ?? null,
          // First photo resource name only — the app requests its URI via
          // mode=photo when (and only when) it has no user photo to show.
          photo_name: place.photos?.[0]?.name ?? null,
        };
      } else if (mode === "match") {
        // Free IDs-Only text search to attach a google_place_id to one of our
        // winery records. Biased to the winery's stored coordinates when known.
        const name = parsed.name;
        if (typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
          return json({ error: "name is required" }, 400);
        }
        const lat = typeof parsed.lat === "number" ? parsed.lat : null;
        const lng = typeof parsed.lng === "number" ? parsed.lng : null;

        const body: Record<string, unknown> = {
          textQuery: `${name.trim()} winery`,
          pageSize: 3,
        };
        if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          body.locationBias = {
            circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
          };
        }

        const res = await deps.fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": MATCH_FIELD_MASK,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("Places match error:", res.status, errText);
          return json({ error: "Winery lookup is unavailable right now." }, 502);
        }
        const data = await res.json();
        result = {
          candidates: (data.places ?? []).map(
            (p: { id: string; displayName?: { text?: string }; formattedAddress?: string }) => ({
              place_id: p.id,
              name: p.displayName?.text ?? null,
              address: p.formattedAddress ?? null,
            })
          ),
        };
      } else {
        // mode === "photo": resolve a photo resource name to a short-lived URI.
        // skipHttpRedirect returns JSON instead of the image bytes, so the app
        // loads the image straight from Google (photo bytes never transit here).
        const photoName = parsed.photo_name;
        if (
          typeof photoName !== "string" ||
          !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName)
        ) {
          return json({ error: "photo_name is required" }, 400);
        }
        const res = await deps.fetch(
          `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${MAX_PHOTO_WIDTH}&skipHttpRedirect=true`,
          { headers: { "X-Goog-Api-Key": apiKey } }
        );
        if (!res.ok) {
          const errText = await res.text();
          console.error("Places photo error:", res.status, errText);
          return json({ error: "Photo unavailable right now." }, 502);
        }
        const data = await res.json();
        result = { photo_uri: data.photoUri ?? null };
      }

      // ── Record usage (append-only; best-effort) ───────────────────────
      const { error: usageError } = await supabaseClient
        .from("places_usage")
        .insert({ user_id: user.id, mode });
      if (usageError) console.error("Failed to record places_usage:", usageError);

      return json({ mode, ...(result as Record<string, unknown>) });
    } catch (error) {
      console.error("Edge function error:", error);
      return json({ error: "Internal error" }, 500);
    }
  };
}

if (import.meta.main) Deno.serve(createHandler());
