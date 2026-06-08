# AI Sommelier Security Audit — Cork & Note (Issues #8 and #9)

**Audit date:** 2026-06-08
**Branch audited:** `preserve-ai-sommelier` (now merged to `main`)
**Scope:** Supabase RLS for chat tables/storage (Issue #9) and the `chat` Edge Function proxy to the Anthropic API (Issue #8)
**Method:** Static read-only review. No code was modified or committed during the audit.

---

## Executive summary

The feature is reasonably well-architected: the Anthropic API key is held server-side in the Edge Function and never shipped to the client, the JWT is verified before any model call, and the core `conversations`/`messages` tables have correct, owner-scoped RLS policies. The DELETE-policy fix migration (`20260221`) does correctly close the photo-deletion gap it targets.

However, several real issues remain:

- **The `chat-photos` storage bucket is fully public for reads** (`public = true` + a `SELECT USING (bucket_id = 'chat-photos')` policy with no owner check). Anyone on the internet who can guess or obtain a URL can view any user's uploaded wine/label photos. This is the most serious finding because wine-entry photos can include labels, locations, and personal context, and the public URLs are stored in the database and predictable in structure.
- **No rate limiting or abuse protection** on the Edge Function. Any authenticated user can call the Anthropic-backed endpoint in a loop, running up unbounded API cost. There is also no payload-size cap, so a client can send arbitrarily large base64 images straight to Anthropic.
- **Weak input validation** on the Edge Function: `role`, per-message `content`, image count, and image size are not validated; malformed messages are forwarded to Anthropic largely as-is.
- **Error handling masks failures**: the function returns HTTP 200 with an `error` body on both Claude API errors and internal exceptions, and echoes raw upstream `details` to the client.
- **`config.toml` does not pin `verify_jwt` for the function**, so JWT enforcement at the platform gateway depends on dashboard/CLI defaults rather than being declared in code.

None of the findings are remotely exploitable for cross-user *data modification* — the write/delete policies are sound. The headline risk is **confidentiality of photos** plus **cost/abuse** on the AI endpoint.

---

## Findings

| # | Finding | Severity | File:line | Recommendation |
|---|---------|----------|-----------|----------------|
| 1 | `chat-photos` bucket is public and the storage SELECT policy allows anyone to read any object in the bucket (no owner check, no auth check). Photo public URLs are persisted in `messages.image_urls`. | **High** | `migrations/20260220_create_chat_tables.sql:113-115` (bucket `public=true`), `:125-127` (SELECT policy) | Make the bucket private (`public=false`) and scope SELECT to the owner: `bucket_id='chat-photos' AND (string_to_array(name,'_'))[2] = auth.uid()::text`. Serve images via short-lived signed URLs (`createSignedUrl`) instead of `getPublicUrl` in `lib/chat.js:124-128`. |
| 2 | No rate limiting / abuse controls on the Edge Function; any authed user can call the Anthropic proxy unboundedly. | **High** | `functions/chat/index.ts:11-46` (no throttle before the Claude call at `:112`) | Add per-user rate limiting (e.g. a `usage`/counter table keyed on `user.id` with a time-window check, or Supabase/edge rate-limit middleware). Consider a daily token/cost cap per user. |
| 3 | No request-size or image-size/count validation; client-supplied base64 images are forwarded directly to Anthropic. Enables large-payload cost abuse and memory pressure. | **Medium** | `functions/chat/index.ts:46-109` (images consumed at `:83-94` with no size/count check) | Enforce a max body size, max images per message, and max base64 length; reject oversized payloads with 413/400 before calling Claude. |
| 4 | Weak input validation: only `Array.isArray(messages)` is checked. `msg.role`, `msg.content`, and image fields are not validated; arbitrary `role` values are passed to Anthropic. | **Medium** | `functions/chat/index.ts:48` (only array check); `:73-109` (no per-message validation) | Validate each message: `role ∈ {user,assistant}`, `content` is a string within a length cap, `images` is an array of `{base64, mediaType}` with allowed MIME types. Reject otherwise with 400. |
| 5 | Errors returned as HTTP 200 with an `error` body, and raw upstream `details` echoed to the client on Claude API failure. Breaks HTTP semantics and can leak upstream error internals. | **Medium** | `functions/chat/index.ts:131-145` (Claude error → 200 + `details`), `:165-174` (catch → 200 + `error.message`) | Return proper status codes (4xx/5xx). Log full details server-side (already done at `:133`/`:166`) but return a generic message to the client; do not forward raw `details`/`error.message`. |
| 6 | CORS `Access-Control-Allow-Origin: *` — any origin may invoke the function. Mitigated by JWT requirement, but still over-broad for a known mobile/web client. | **Low** | `functions/chat/index.ts:5-9` | Restrict to the app's known origin(s) if the web build uses a fixed domain; for native-only this is lower risk but tightening is still recommended. |
| 7 | `verify_jwt` is not declared for the function in `config.toml` (no `[functions.chat]` block). JWT gateway enforcement relies on platform default rather than being codified. The function does verify JWT in code (`:34-43`), so this is defense-in-depth, not an open hole. | **Low** | `supabase/config.toml` (no `[functions.chat]` section); enforced in code at `functions/chat/index.ts:34-43` | Add `[functions.chat]\nverify_jwt = true` to `config.toml` so platform-level JWT verification is explicit and version-controlled. |
| 8 | `getConversation` / `getMessages` / `updateConversationTitle` / `addMessage` rely solely on RLS (no `user_id` filter in the query). This is *correct and safe* given the policies, but means security depends entirely on RLS staying enabled. | **Info** | `lib/chat.js:41-50, 52-59, 73-82, 84-99` | No change required; noted so reviewers know RLS is the sole gate. Keep RLS-enabled assertions in any test suite. |
| 9 | Edge Function uses `SUPABASE_ANON_KEY` + caller's Authorization header to resolve the user (correct). No service-role key is used or exposed. | **Info (positive)** | `functions/chat/index.ts:28-37` | No change; confirms least-privilege key usage. |
| 10 | Anthropic API key is read only from `Deno.env` server-side and never returned in any response. No leak path found. | **Info (positive)** | `functions/chat/index.ts:59`, used at `:118`; client never references it (`lib/ai.js`, `lib/chat.js`) | No change; Issue #8's primary concern (key confidentiality) is satisfied. |

### RLS detail (Issue #9)

- **`conversations`** — RLS enabled (`:61`). SELECT/INSERT/UPDATE/DELETE policies all correctly scope to `auth.uid() = user_id` (`:65-79`). **Correct.**
- **`messages`** — RLS enabled (`:62`). SELECT/INSERT/DELETE policies correctly gate via an `EXISTS` subquery on the parent conversation's `user_id` (`:82-110`). **Correct.** Note there is intentionally **no UPDATE policy** on `messages` (messages are immutable once written) — appropriate.
- **No separate "photos" table exists.** Photos are stored only as URLs inside `messages.image_urls` (JSONB) and as objects in the `chat-photos` storage bucket. So photo *metadata* access is governed by the `messages` policies (correct), but photo *file* access is governed by the storage policies (Finding #1, the gap).
- **Storage DELETE fix (`20260221`)** — Verified correct. The original DELETE policy (`20260220:129-134`) only required `auth.role()='authenticated'`, letting any logged-in user delete anyone's photo. The fix (`20260221:9-15`) adds `(string_to_array(name,'_'))[2] = auth.uid()::text`. Because the filename is `chat_{user.id}_{timestamp}_{randomId}.jpg` (`lib/chat.js:109`) and UUIDs contain hyphens (not underscores), index `[2]` reliably yields the full owner UUID. **The fix fully closes the DELETE gap it targets.**
  - Residual gaps the fix does *not* address: the **INSERT** policy (`20260220:118-123`) still lets any authenticated user upload a file named with *another* user's id (no check that `[2] = auth.uid()`), and the **SELECT** policy remains fully public (Finding #1). Recommend tightening the INSERT `WITH CHECK` to also assert `(string_to_array(name,'_'))[2] = auth.uid()::text`.

---

## Manual verification checklist for the owner

These cannot be confirmed from source and must be checked in the Supabase dashboard / CLI:

**Edge Function (Issue #8)**
- [ ] **Secret set:** `ANTHROPIC_API_KEY` is configured under Project Settings → Edge Functions → Secrets (or `supabase secrets list`). Confirm it is the intended (non-expired, correct-tier) key. The function returns HTTP 500 "API key not configured" if missing (`index.ts:60-68`).
- [ ] **Function deployed:** the `chat` function is deployed and its version matches the committed source (`supabase functions list` / dashboard shows recent deploy).
- [ ] **JWT verification enabled at the gateway:** confirm the deployed `chat` function has "Verify JWT" ON (dashboard) — the function also checks JWT in code, but the platform setting should match. (See Finding #7; codify with `[functions.chat] verify_jwt = true`.)
- [ ] **`SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars** are present in the function's environment (auto-injected by Supabase, but verify `index.ts:29-30` resolves non-empty values).
- [ ] **Anthropic billing/usage limits:** set a spend cap or alert on the Anthropic account, since the app has no per-user rate limit yet (Finding #2).
- [ ] **Model availability:** confirm `claude-sonnet-4-20250514` (`index.ts:122`) is accessible to your Anthropic key; otherwise switch to a listed fallback.

**Database & Storage RLS (Issue #9)**
- [ ] **Both migrations applied** to the remote DB (`supabase migration list` shows `20260220` and `20260221` as applied).
- [ ] **RLS is ON in production** for `public.conversations` and `public.messages` (dashboard → Authentication → Policies, or `SELECT relrowsecurity FROM pg_class WHERE relname IN ('conversations','messages')` returns `t` for both).
- [ ] **`chat-photos` bucket visibility:** decide whether it should stay public. Per Finding #1, recommend flipping it to **private** and confirm in dashboard → Storage → Buckets. If kept public, accept that all uploaded photos are world-readable by URL.
- [ ] **Storage policies present:** the three `storage.objects` policies for `chat-photos` exist and the DELETE policy is the *fixed* version containing the `auth.uid()` check (not the original).
- [ ] **Manual cross-user test:** with two test accounts, confirm User B cannot (a) SELECT User A's conversations/messages via the REST API, (b) DELETE User A's photo, and — after tightening — (c) upload a file named with User A's id.

---

## Quick-win remediation order

1. **Finding #1** — make `chat-photos` private + owner-scoped SELECT + switch to signed URLs (confidentiality of user photos).
2. **Finding #2 / #3** — add per-user rate limiting and payload/image size caps (cost & abuse).
3. **Finding #5** — return correct HTTP status codes and stop echoing raw upstream error details.
4. **Finding #4** — strengthen per-message input validation.
5. **Findings #6 / #7 + storage INSERT** — tighten CORS, codify `verify_jwt`, and add the owner check to the storage INSERT policy.
