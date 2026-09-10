-- Record how many web searches each AI call billed us for.
--
-- The sommelier's Pro-only web search (Anthropic's server-side web_search tool)
-- costs $10 per 1,000 searches on top of the retrieved text as input tokens. The
-- model decides per message whether to search at all, so the only way to know
-- what search actually costs us is to log what it did: this column is what turns
-- "roughly 10-20% of messages probably search" into a number.
--
-- Nullable with no default and no backfill: rows written before this column
-- existed legitimately have no answer, and 0 would be a lie about them (we
-- weren't offering search yet). Nothing gates on it — it is here so a per-day
-- search cap can be argued for or against with evidence later.
--
-- Idempotent / safe to re-run.

alter table public.chat_usage add column if not exists web_searches integer;

comment on column public.chat_usage.web_searches is
  'Anthropic server-side web_search requests billed by this call (usage.server_tool_use.web_search_requests). Null = call predates the column or the model did not report it.';
