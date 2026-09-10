-- AI response reports (Google Play AI-generated content policy).
--
-- Users must be able to flag a problematic sommelier reply from inside the
-- app — an email link is not enough — and the flags must land somewhere a
-- human actually reviews. This is that somewhere: the flag on an assistant
-- chat bubble (components/ReportAiResponseModal.js via lib/aiReports.js)
-- inserts a row here. The reported reply is captured verbatim because chat
-- messages are user-deletable; the report must carry its own copy.
--
-- Append-only from the client: insert-own only, no select/update/delete
-- policies — the owner reviews the queue with the service role
-- (dashboard/SQL), same model as winery_reports.
--
-- Idempotent / safe to re-run.

create table if not exists public.ai_response_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The assistant message being reported, verbatim.
  message_content text not null,
  -- The user prompt that preceded the reply, when the surface had it handy.
  context text,
  reason text not null check (reason in ('inaccurate', 'inappropriate', 'unsafe', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.ai_response_reports enable row level security;

-- Users file reports as themselves. Deliberately no select policy: unlike
-- winery_reports there is nothing for the reporter to look back at, and the
-- reported content may quote another surface's context.
drop policy if exists "ai_response_reports_insert_own" on public.ai_response_reports;
create policy "ai_response_reports_insert_own"
  on public.ai_response_reports for insert
  to authenticated
  with check (user_id = auth.uid());

-- The owner's review query is "what came in since I last looked".
create index if not exists ai_response_reports_created_at_idx
  on public.ai_response_reports (created_at desc);
