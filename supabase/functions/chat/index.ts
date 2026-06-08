// supabase/functions/chat/index.ts
// Edge Function proxy for Claude API - AI Wine Sommelier
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user via Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { messages, system_prompt } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get API key from secrets
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build Claude API request
    // Client sends base64 images directly — no URL fetching needed
    const claudeMessages = [];
    for (const msg of messages) {
      const images = msg.images || [];

      if (images.length > 0) {
        // Build multimodal content array with pre-encoded base64 images
        const content: Array<
          | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
          | { type: "text"; text: string }
        > = [];

        for (const img of images) {
          if (img.base64 && img.base64.length > 0) {
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: img.mediaType || "image/jpeg",
                data: img.base64,
              },
            });
          }
        }

        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }

        // Use content array if we have images, otherwise text-only
        if (content.some((c) => c.type === "image")) {
          claudeMessages.push({ role: msg.role, content });
        } else {
          claudeMessages.push({ role: msg.role, content: msg.content || "" });
        }
      } else {
        claudeMessages.push({ role: msg.role, content: msg.content || "" });
      }
    }

    // Call Claude API
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          // Fallback models if needed: "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"
          max_tokens: 1024,
          system: system_prompt || "You are a helpful wine sommelier.",
          messages: claudeMessages,
        }),
      }
    );

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errorText);
      // Return 200 with error field so client can read the details
      return new Response(
        JSON.stringify({
          error: `Claude API error (${claudeResponse.status})`,
          details: errorText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claudeData = await claudeResponse.json();

    // Extract text response
    const responseText =
      claudeData.content
        ?.filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("") || "";

    return new Response(
      JSON.stringify({
        response: responseText,
        usage: claudeData.usage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: `Edge function error: ${error.message}` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
