-- Website recruitment is separate from app accounts and store enrollment.
create table public.early_access_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (length(email) between 3 and 254),
  platform text not null check (platform in ('Android', 'iPhone')),
  interest text not null check (interest in ('testing', 'launch')),
  android_commitment boolean not null default false,
  consent_version text not null default '2026-09-14',
  attribution jsonb not null default '{}'::jsonb,
  status text not null default 'requested' check (status in ('requested','invited','installed','active','withdrawn')),
  unique(email, platform, interest)
);
alter table public.early_access_requests enable row level security;
revoke all on public.early_access_requests from anon, authenticated;
grant all on public.early_access_requests to service_role;

create table public.early_access_rate_limits (
  created_at timestamptz not null default now(),
  ip_hash text not null,
  email_hash text not null
);
create index early_access_rates_created on public.early_access_rate_limits(created_at);
alter table public.early_access_rate_limits enable row level security;
revoke all on public.early_access_rate_limits from anon, authenticated;
grant all on public.early_access_rate_limits to service_role;

create function public.request_early_access(
  p_email text, p_platform text, p_interest text, p_commitment boolean,
  p_attribution jsonb, p_ip_hash text, p_email_hash text
) returns text language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize this low-volume endpoint so concurrent requests cannot evade caps.
  perform pg_catalog.pg_advisory_xact_lock(20260914, 1500);
  delete from public.early_access_rate_limits where created_at < now() - interval '1 day';
  if (select count(*) from public.early_access_rate_limits) >= 300
    or (select count(*) from public.early_access_rate_limits where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.early_access_rate_limits where email_hash = p_email_hash) >= 3 then
    return 'rate_limited';
  end if;
  insert into public.early_access_rate_limits(ip_hash, email_hash) values (p_ip_hash, p_email_hash);
  insert into public.early_access_requests(email, platform, interest, android_commitment, attribution)
    values (lower(trim(p_email)), p_platform, p_interest, p_commitment, p_attribution)
    on conflict (email, platform, interest) do nothing;
  return 'accepted';
end;
$$;
revoke all on function public.request_early_access(text,text,text,boolean,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.request_early_access(text,text,text,boolean,jsonb,text,text) to service_role;
