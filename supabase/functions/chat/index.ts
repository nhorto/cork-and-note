// supabase/functions/chat/index.ts
// Edge Function proxy for the Claude API — AI Wine Sommelier.
// Hardened per docs/audits/sommelier-security-audit.md:
//  - per-user rate limiting + daily cap backed by public.chat_usage (#2 / Issue #30)
//  - request-size, image-count/size, and per-message input validation (#3, #4)
//  - proper HTTP status codes; upstream error details are logged, not echoed (#5)
//
// It is also the server-side gate for the Pro tier (launch plan §4.5 item 4).
// The free meters live HERE, not in the app: `isPro` from the client is a
// rendering hint, and a patched client must not be able to buy Claude calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  FAIR_USE_DAILY_CAPS,
  FAIR_USE_MONTHLY_CHAT_CAP,
  FREE_METER_WINDOWS,
  PHOTO_CHAT_PRO_MESSAGE,
  isEntitlementActive,
  limitReachedMessage,
  meterDecision,
  monthWindowStart,
  normalizeTask,
} from "../_shared/entitlements.ts";

// ── Limits ──────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 25_000_000; // ~25MB (base64 images are large)
const MAX_MESSAGES = 50; // conversation history length
const MAX_CONTENT_CHARS = 8_000; // per-message text
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_B64_CHARS = 5_000_000; // ~3.7MB decoded per image
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_ROLES = ["user", "assistant"];

// Rate limits (per authenticated user). The burst cap is global; the daily and
// monthly fair-use caps are per task and live in _shared/entitlements.ts so the
// tests and the client can see the same numbers.
const SHORT_WINDOW_MIN = 5;
const MAX_REQUESTS_SHORT = 15; // ≤15 requests / 5 min, any task

Deno.serve(async (req: Request) => {
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

    let parsed: { messages?: unknown; system_prompt?: unknown; task?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { messages, system_prompt, task } = parsed;

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
    // The fair-use caps are per task (§4.2): normalizeTask sends anything
    // unrecognised to the stricter, more expensive chat bucket.
    const now = Date.now();
    const meteredTask = normalizeTask(task);
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
        .eq("task", meteredTask)
        .gte("created_at", dayStart),
    ]);

    // The chat_usage RLS auto-scopes counts to this user. Fail closed: if the
    // counter is unreachable we cannot enforce limits, so refuse the (paid)
    // Anthropic call rather than run it unmetered.
    if (shortRes.error || dayRes.error) {
      console.error("Rate-limit read error:", shortRes.error, dayRes.error);
      return json({ error: "Service temporarily unavailable" }, 503);
    }
    if ((shortRes.count ?? 0) >= MAX_REQUESTS_SHORT) {
      return json(
        { error: "Rate limit exceeded. Please wait a few minutes and try again." },
        429
      );
    }
    if ((dayRes.count ?? 0) >= FAIR_USE_DAILY_CAPS[meteredTask]) {
      return json(
        { error: "Daily fair-use limit reached. Please try again tomorrow." },
        429
      );
    }

    // ── Free-tier meter + Pro fair use (the monetisation gate) ────────
    const { data: entitlement, error: entitlementError } = await supabaseClient
      .from("entitlements")
      .select("is_pro, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entitlementError) {
      // Fail closed on the paid feature rather than guessing: an unreadable
      // entitlement means we cannot prove this user bought anything.
      console.error("Entitlement read error:", entitlementError);
      return json({ error: "Service temporarily unavailable" }, 503);
    }

    const isPro = isEntitlementActive(entitlement, now);

    // Free chat is text-only: a photo in chat would be a free label scan by the
    // back door, on the more expensive model. The paywall code makes the app
    // treat this exactly like a spent meter.
    if (!isPro && meteredTask === "chat") {
      const hasImages = (messages as Array<Record<string, unknown>>).some(
        (m) => Array.isArray(m.images) && m.images.length > 0
      );
      if (hasImages) {
        return json({ error: PHOTO_CHAT_PRO_MESSAGE, code: "free_limit_reached" }, 402);
      }
    }

    // Usage over the task's window — lifetime for scans, calendar month for
    // chat (§4.2). The free meter and Pro's monthly chat ceiling read the same
    // count; Pro scans need no count at all, the daily cap already bounds them.
    let windowUsed = 0;
    if (!isPro || meteredTask === "chat") {
      let usageQuery = supabaseClient
        .from("chat_usage")
        .select("id", { count: "exact", head: true })
        .eq("task", meteredTask);
      if (FREE_METER_WINDOWS[meteredTask] === "month") {
        usageQuery = usageQuery.gte("created_at", monthWindowStart(now));
      }
      const usageRes = await usageQuery;
      if (usageRes.error) {
        console.error("Usage meter read error:", usageRes.error);
        return json({ error: "Service temporarily unavailable" }, 503);
      }
      windowUsed = usageRes.count ?? 0;
    }

    if (isPro && meteredTask === "chat" && windowUsed >= FAIR_USE_MONTHLY_CHAT_CAP) {
      return json(
        {
          error:
            "You've reached this month's fair-use limit for the sommelier. It resets on the 1st.",
        },
        429
      );
    }

    const meter = meterDecision({ isPro, task: meteredTask, used: windowUsed });
    if (!meter.allowed) {
      // 402 rather than 429: this is a paywall, not a slow-down, and the app
      // opens the RevenueCat paywall on exactly this status.
      return json(
        {
          error: limitReachedMessage(meter.task),
          code: "free_limit_reached",
          meter: {
            task: meter.task,
            limit: meter.limit,
            used: meter.used,
            remaining: meter.remaining,
            isPro: false,
          },
        },
        402
      );
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

    // ── Model selection (server-side allowlist) ───────────────────────
    // The client may pass a `task` hint; we map it to a model HERE. We never
    // accept a raw model string from the client (cost/abuse safety): an unknown
    // or absent task falls back to the default chat model.
    const MODELS: Record<string, string> = {
      chat: "claude-sonnet-4-6", // sommelier conversation (migrated off the deprecated claude-sonnet-4)
      label_scan: "claude-haiku-4-5", // cheap, fast label read/prefill (#59)
    };
    const model =
      typeof task === "string" && Object.prototype.hasOwnProperty.call(MODELS, task)
        ? MODELS[task]
        : MODELS.chat;

    // ── Call Claude ───────────────────────────────────────────────────
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        // Prompt caching (launch plan §4.3): the system prompt is stable across
        // the turns of a sommelier conversation (and byte-identical across all
        // label scans), so mark it as a cache breakpoint — cached reads bill at
        // ~10% of input price. Prompts under the model's minimum cacheable size
        // silently skip the cache, so this is safe for short prompts too.
        system: [
          {
            type: "text",
            text: (system_prompt as string) || "You are a helpful wine sommelier.",
            cache_control: { type: "ephemeral" },
          },
        ],
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
      task: meteredTask,
      input_tokens: claudeData.usage?.input_tokens ?? null,
      output_tokens: claudeData.usage?.output_tokens ?? null,
    });
    if (usageError) console.error("Failed to record chat_usage:", usageError);

    // Hand back the meter this call just spent, so the app can update its
    // "2 free scans left" hint without a second round-trip.
    return json({
      response: responseText,
      usage: claudeData.usage,
      meter: {
        task: meter.task,
        limit: meter.limit,
        used: meter.used + 1,
        remaining: meter.remaining === null ? null : Math.max(0, meter.remaining - 1),
        isPro,
      },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return json({ error: "Internal error" }, 500);
  }
});
