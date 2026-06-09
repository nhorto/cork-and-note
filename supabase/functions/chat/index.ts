// supabase/functions/chat/index.ts
// Edge Function proxy for the Claude API — AI Wine Sommelier.
// Hardened per docs/audits/sommelier-security-audit.md:
//  - per-user rate limiting + daily cap backed by public.chat_usage (#2 / Issue #30)
//  - request-size, image-count/size, and per-message input validation (#3, #4)
//  - proper HTTP status codes; upstream error details are logged, not echoed (#5)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Limits ──────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 25_000_000; // ~25MB (base64 images are large)
const MAX_MESSAGES = 50; // conversation history length
const MAX_CONTENT_CHARS = 8_000; // per-message text
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_B64_CHARS = 5_000_000; // ~3.7MB decoded per image
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_ROLES = ["user", "assistant"];

// Rate limits (per authenticated user)
const SHORT_WINDOW_MIN = 5;
const MAX_REQUESTS_SHORT = 15; // ≤15 requests / 5 min
const MAX_REQUESTS_DAY = 150; // ≤150 requests / 24h

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // ── Body size guard (read raw, then parse) ────────────────────────
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }

    let parsed: { messages?: unknown; system_prompt?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { messages, system_prompt } = parsed;

    // ── Input validation ──────────────────────────────────────────────
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array is required" }, 400);
    }
    if (messages.length > MAX_MESSAGES) {
      return json({ error: "Too many messages" }, 400);
    }
    if (system_prompt !== undefined && typeof system_prompt !== "string") {
      return json({ error: "system_prompt must be a string" }, 400);
    }

    for (const msg of messages as Array<Record<string, unknown>>) {
      if (!msg || typeof msg !== "object") {
        return json({ error: "Invalid message" }, 400);
      }
      if (!ALLOWED_ROLES.includes(msg.role as string)) {
        return json({ error: "Invalid message role" }, 400);
      }
      if (msg.content !== undefined && typeof msg.content !== "string") {
        return json({ error: "Message content must be a string" }, 400);
      }
      if (typeof msg.content === "string" && msg.content.length > MAX_CONTENT_CHARS) {
        return json({ error: "Message content too long" }, 400);
      }
      if (msg.images !== undefined) {
        if (!Array.isArray(msg.images)) {
          return json({ error: "images must be an array" }, 400);
        }
        if (msg.images.length > MAX_IMAGES_PER_MESSAGE) {
          return json({ error: "Too many images in a message" }, 400);
        }
        for (const img of msg.images as Array<Record<string, unknown>>) {
          if (!img || typeof img.base64 !== "string") {
            return json({ error: "Invalid image payload" }, 400);
          }
          if (img.base64.length > MAX_IMAGE_B64_CHARS) {
            return json({ error: "Image too large" }, 413);
          }
          if (
            img.mediaType !== undefined &&
            !ALLOWED_MEDIA_TYPES.includes(img.mediaType as string)
          ) {
            return json({ error: "Unsupported image type" }, 400);
          }
        }
      }
    }

    // ── Rate limiting (per user, append-only chat_usage) ──────────────
    const now = Date.now();
    const shortWindowStart = new Date(now - SHORT_WINDOW_MIN * 60_000).toISOString();
    const dayStart = new Date(now - 24 * 60 * 60_000).toISOString();

    const [shortRes, dayRes] = await Promise.all([
      supabaseClient
        .from("chat_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", shortWindowStart),
      supabaseClient
        .from("chat_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart),
    ]);

    // The chat_usage RLS auto-scopes counts to this user. Fail closed on the
    // limits we could read; if the table is unreachable, log and continue
    // (don't take the sommelier down over the counter).
    if (shortRes.error || dayRes.error) {
      console.error("Rate-limit read error:", shortRes.error, dayRes.error);
    } else {
      if ((shortRes.count ?? 0) >= MAX_REQUESTS_SHORT) {
        return json(
          { error: "Rate limit exceeded. Please wait a few minutes and try again." },
          429
        );
      }
      if ((dayRes.count ?? 0) >= MAX_REQUESTS_DAY) {
        return json({ error: "Daily limit reached. Please try again tomorrow." }, 429);
      }
    }

    // ── API key ───────────────────────────────────────────────────────
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return json({ error: "Service temporarily unavailable" }, 503);
    }

    // ── Build Claude messages ─────────────────────────────────────────
    const claudeMessages = [];
    for (const msg of messages as Array<Record<string, unknown>>) {
      const images = (msg.images as Array<Record<string, unknown>>) || [];
      const text = (msg.content as string) || "";

      if (images.length > 0) {
        const content: Array<
          | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
          | { type: "text"; text: string }
        > = [];
        for (const img of images) {
          if (typeof img.base64 === "string" && img.base64.length > 0) {
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: (img.mediaType as string) || "image/jpeg",
                data: img.base64 as string,
              },
            });
          }
        }
        if (text) content.push({ type: "text", text });
        if (content.some((c) => c.type === "image")) {
          claudeMessages.push({ role: msg.role, content });
        } else {
          claudeMessages.push({ role: msg.role, content: text });
        }
      } else {
        claudeMessages.push({ role: msg.role, content: text });
      }
    }

    // ── Call Claude ───────────────────────────────────────────────────
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: (system_prompt as string) || "You are a helpful wine sommelier.",
        messages: claudeMessages,
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errorText);
      // Log details server-side; return a generic message + a proper status code.
      const status = claudeResponse.status === 429 ? 429 : 502;
      return json(
        { error: "The sommelier is unavailable right now. Please try again." },
        status
      );
    }

    const claudeData = await claudeResponse.json();

    const responseText =
      claudeData.content
        ?.filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("") || "";

    // ── Record usage (append-only; best-effort) ───────────────────────
    const { error: usageError } = await supabaseClient.from("chat_usage").insert({
      user_id: user.id,
      input_tokens: claudeData.usage?.input_tokens ?? null,
      output_tokens: claudeData.usage?.output_tokens ?? null,
    });
    if (usageError) console.error("Failed to record chat_usage:", usageError);

    return json({ response: responseText, usage: claudeData.usage });
  } catch (error) {
    console.error("Edge function error:", error);
    return json({ error: "Internal error" }, 500);
  }
});
