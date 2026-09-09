-- Pro tier: server-side entitlement truth + a task dimension on the usage meter
-- (launch plan §4.5 items 4–5). Additive and idempotent — safe to re-run.
--
-- Why a table and not "ask RevenueCat": the chat Edge Function has to decide, on
-- every AI call, whether this user is Pro. A network round-trip to RevenueCat per
-- request would add latency and a third-party outage to the critical path, so the
-- RevenueCat webhook pushes state here and the function reads one indexed row.
-- The client's own `isPro` is never trusted for a paid call.

-- ── public.entitlements ────────────────────────────────────────────────────
-- One row per user, written ONLY by the revenuecat-webhook function using the
-- service role. `expires_at` is the end of the current paid period (null for a
-- non-expiring grant); readers must check it, because a lapsed subscription that
-- never produced a webhook would otherwise stay Pro forever.
create table if not exists public.entitlements (
  user_id    uuid primary key references public.users (id) on delete cascade,
  is_pro     boolean     not null default false,
  expires_at timestamptz,
  source     text        not null default 'revenuecat',
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_pro_idx
  on public.entitlements (is_pro, expires_at);

alter table public.entitlements enable row level security;

-- Users may read their own entitlement (the client uses it only for UI hints —
-- the real gate is server-side). No INSERT/UPDATE/DELETE policy on purpose: a
-- user must not be able to grant themselves Pro. The webhook writes with the
-- service role, which bypasses RLS.
drop policy if exists "own entitlement select" on public.entitlements;
create policy "own entitlement select" on public.entitlements
  for select using (auth.uid() = user_id);

-- ── public.chat_usage.task ─────────────────────────────────────────────────
-- The free tier meters scans (3/month) and sommelier messages (5/month)
-- separately, so usage rows need to say which one they were.
--
-- Rows written before this migration did not record a task, and guessing one
-- would be a fabrication that retroactively spends a meter the user never agreed
-- to — an existing tester could open the app to an exhausted allowance. They are
-- marked 'legacy', which matches neither meter, so metering starts the day the
-- tier ships. New rows default to 'chat', the stricter of the two, so a caller
-- that forgets to say what it was cannot land in the cheaper bucket.
alter table public.chat_usage add column if not exists task text;

update public.chat_usage set task = 'legacy' where task is null;

alter table public.chat_usage alter column task set default 'chat';
alter table public.chat_usage alter column task set not null;

create index if not exists chat_usage_user_task_time_idx
  on public.chat_usage (user_id, task, created_at desc);
