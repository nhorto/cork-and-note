-- Per-user AI usage log backing rate-limiting / cost caps on the chat Edge Function
-- (Issue #30 / audit finding #2). Append-only: the user may read and insert their own
-- rows, but has NO update/delete policy, so they cannot reset their own rate-limit
-- counter. The Edge Function inserts one row per Claude call (with token usage).
-- Idempotent / safe to re-run.

create table if not exists public.chat_usage (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,
  created_at    timestamptz not null default now(),
  input_tokens  integer,
  output_tokens integer
);

create index if not exists chat_usage_user_time_idx
  on public.chat_usage (user_id, created_at desc);

alter table public.chat_usage enable row level security;

-- Read + append own rows only. No UPDATE/DELETE policy on purpose (tamper-resistant).
drop policy if exists "own usage select" on public.chat_usage;
drop policy if exists "own usage insert" on public.chat_usage;
create policy "own usage select" on public.chat_usage
  for select using (auth.uid() = user_id);
create policy "own usage insert" on public.chat_usage
  for insert with check (auth.uid() = user_id);
