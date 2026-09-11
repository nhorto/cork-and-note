-- Keep the public pages behind a Sommelier answer when a conversation is
-- reopened. Existing rows become an empty list, so old clients and old chats
-- remain valid.
alter table public.messages
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.messages
  drop constraint if exists messages_sources_is_array;

alter table public.messages
  add constraint messages_sources_is_array
  check (jsonb_typeof(sources) = 'array');
