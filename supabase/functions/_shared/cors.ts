// supabase/functions/_shared/cors.ts
// Shared CORS policy for the edge functions (launch plan §2.3, "tighten CORS").
//
// The functions previously answered `Access-Control-Allow-Origin: *`, which
// invites any website to call them from a visitor's browser. Cork & Note is a
// native app: React Native's fetch sends no `Origin` header and browsers are the
// only clients CORS applies to, so restricting this costs the app nothing.
//
// Policy: a browser origin is echoed back only if it is on the allowlist in the
// ALLOWED_ORIGINS secret (comma-separated). With the secret unset — the default —
// no browser origin is granted access at all, while the native app is unaffected.
// Requests still need a valid JWT regardless; this is defence in depth, not the
// authorisation boundary.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Responses differ by Origin, so caches must not share them.
    Vary: "Origin",
  };

  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
