// supabase/functions/delete-account/index.ts
// In-app account deletion (#161, App Store Guideline 5.1.1(v)).
//
// Order matters, and every step must succeed before the next runs, so a
// failure leaves the account intact and retryable rather than half-deleted:
//   1. storage objects (photos) — enumerated via list_user_storage_objects,
//      removed through the Storage API so the underlying files are deleted
//   2. database rows — public.delete_user_data() as the calling user
//   3. the auth.users row — via the Auth admin API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Storage API remove() takes a list of paths; keep batches modest.
const REMOVE_BATCH_SIZE = 100;

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
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth: identify the caller from their JWT ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 1. Storage objects ────────────────────────────────────────────
    const { data: objects, error: listError } = await admin.rpc(
      "list_user_storage_objects",
      { p_user_id: user.id }
    );
    if (listError) {
      console.error("delete-account: storage list failed:", listError);
      return json({ error: "Account deletion failed. Please try again." }, 500);
    }

    const byBucket = new Map<string, string[]>();
    for (const obj of objects ?? []) {
      const names = byBucket.get(obj.bucket_id) ?? [];
      names.push(obj.name);
      byBucket.set(obj.bucket_id, names);
    }
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += REMOVE_BATCH_SIZE) {
        const batch = names.slice(i, i + REMOVE_BATCH_SIZE);
        const { error: removeError } = await admin.storage
          .from(bucket)
          .remove(batch);
        if (removeError) {
          console.error(
            `delete-account: removing ${batch.length} objects from ${bucket} failed:`,
            removeError
          );
          return json(
            { error: "Account deletion failed. Please try again." },
            500
          );
        }
      }
    }

    // ── 2. Database rows (RPC scopes itself to auth.uid()) ────────────
    const { error: dataError } = await userClient.rpc("delete_user_data");
    if (dataError) {
      console.error("delete-account: delete_user_data failed:", dataError);
      return json({ error: "Account deletion failed. Please try again." }, 500);
    }

    // ── 3. Auth user ──────────────────────────────────────────────────
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("delete-account: auth user deletion failed:", authError);
      return json({ error: "Account deletion failed. Please try again." }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("delete-account: unhandled error:", err);
    return json({ error: "Account deletion failed. Please try again." }, 500);
  }
});
