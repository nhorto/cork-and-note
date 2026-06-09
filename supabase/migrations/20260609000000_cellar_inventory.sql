-- Wine Cellar inventory — Epic #6 (#23 research, #24 schema).
-- Implements "Part B + C" of docs/design/cellar-schema.md. "Part A" (location-optional
-- logging) already shipped in 20260608010000_logging_optional_location.sql, so it is
-- intentionally omitted here.
--
-- Conventions match the core tables (visits/wines/wishlist): uuid_generate_v4() PKs,
-- references public.users, and "auth.uid() = user_id" RLS. Idempotent + safe to re-run.

-- ============================================================
-- Enum: lifecycle of a bottle / reason a lot leaves the cellar
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cellar_status') then
    create type public.cellar_status as enum
      ('in_cellar','consumed','gifted','sold','spoiled');
  end if;
end$$;

-- ============================================================
-- cellar_bottles — a lot = wine + vintage + size at a location, with a quantity
-- ============================================================
create table if not exists public.cellar_bottles (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,

  -- wine identity (optional FK to a known winery; free-text producer otherwise)
  winery_id     bigint references public.wineries,
  producer      text,
  wine_name     text not null,
  vintage       text,
  wine_type     text,
  varietal      text,
  region        text,

  -- lot / physical
  quantity      integer not null default 1 check (quantity >= 0),
  bottle_size   text not null default '750ml',
  location      text,
  bin           text,

  -- purchase
  purchase_date  date,
  purchase_price numeric(10,2),
  currency       text default 'USD',
  store          text,
  current_value  numeric(10,2),

  -- drinking window (years)
  drink_from    integer,
  drink_by      integer,

  -- personal
  rating        decimal(3,1),
  notes         text,

  status        public.cellar_status not null default 'in_cellar',
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);
create index if not exists cellar_bottles_user_idx   on public.cellar_bottles (user_id);
create index if not exists cellar_bottles_status_idx on public.cellar_bottles (user_id, status);

-- ============================================================
-- cellar_consumptions — audit log of opening/removing bottles, with an
-- optional link to the tasting logged on open (wines.id)
-- ============================================================
create table if not exists public.cellar_consumptions (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.users not null,
  bottle_id     uuid references public.cellar_bottles on delete cascade not null,
  consumed_date date not null default current_date,
  reason        public.cellar_status not null default 'consumed',
  quantity      integer not null default 1 check (quantity > 0),
  note          text,
  wine_id       uuid references public.wines on delete set null,
  created_at    timestamp with time zone default now() not null
);
create index if not exists cellar_consumptions_bottle_idx on public.cellar_consumptions (bottle_id);
create index if not exists cellar_consumptions_user_idx   on public.cellar_consumptions (user_id);

-- ============================================================
-- updated_at trigger for cellar_bottles
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cellar_bottles_set_updated_at on public.cellar_bottles;
create trigger cellar_bottles_set_updated_at
  before update on public.cellar_bottles
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — owner-scoped, mirroring the visits/wishlist policy pattern
-- ============================================================
alter table public.cellar_bottles      enable row level security;
alter table public.cellar_consumptions enable row level security;

drop policy if exists "own cellar select" on public.cellar_bottles;
drop policy if exists "own cellar insert" on public.cellar_bottles;
drop policy if exists "own cellar update" on public.cellar_bottles;
drop policy if exists "own cellar delete" on public.cellar_bottles;
create policy "own cellar select" on public.cellar_bottles for select using (auth.uid() = user_id);
create policy "own cellar insert" on public.cellar_bottles for insert with check (auth.uid() = user_id);
create policy "own cellar update" on public.cellar_bottles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cellar delete" on public.cellar_bottles for delete using (auth.uid() = user_id);

drop policy if exists "own consumption select" on public.cellar_consumptions;
drop policy if exists "own consumption insert" on public.cellar_consumptions;
drop policy if exists "own consumption delete" on public.cellar_consumptions;
create policy "own consumption select" on public.cellar_consumptions for select using (auth.uid() = user_id);
create policy "own consumption insert" on public.cellar_consumptions for insert with check (auth.uid() = user_id);
create policy "own consumption delete" on public.cellar_consumptions for delete using (auth.uid() = user_id);
