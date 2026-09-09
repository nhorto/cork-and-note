// supabase/functions/revenuecat-webhook/index.ts
// RevenueCat → public.entitlements (launch plan §4.5 item 4).
//
// RevenueCat is the system of record for what a user bought; this function is
// how that fact reaches our database, so the chat function can decide "is this
// user Pro?" from one indexed row instead of a third-party round-trip on every
// AI call.
//
// This endpoint runs WITHOUT a Supabase JWT — the caller is RevenueCat, not a
// signed-in user — so its only authentication is the shared secret configured in
// the RevenueCat dashboard's "Authorization header value" field and stored here
// as REVENUECAT_WEBHOOK_SECRET. Without that secret set the function refuses
// every request rather than accepting unauthenticated entitlement grants.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { entitlementUpdatesFromEvent } from "../_shared/entitlements.ts";

/** Constant-time-ish compare so a wrong secret leaks no length/prefix timing. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // No CORS headers on purpose: no browser should ever call this.
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not configured");
    return json({ error: "Not configured" }, 503);
  }
  if (!secretMatches(req.headers.get("Authorization"), expectedSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const updates = entitlementUpdatesFromEvent(body, Date.now());

  // No updates is a success, not a failure: RevenueCat also sends events for
  // other entitlements, for anonymous device ids, and test pings. Returning 2xx
  // stops it retrying something that will never apply.
  if (updates.length === 0) return json({ ok: true, updated: 0 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { error } = await admin
    .from("entitlements")
    .upsert(
      updates.map((u) => ({ ...u, updated_at: new Date().toISOString() })),
      { onConflict: "user_id" }
    );

  if (error) {
    // A 5xx makes RevenueCat retry with backoff, which is what we want: dropping
    // this event would leave a paying user un-entitled with nothing to fix it.
    console.error("entitlements upsert failed:", error);
    return json({ error: "Upsert failed" }, 500);
  }

  return json({ ok: true, updated: updates.length });
});
