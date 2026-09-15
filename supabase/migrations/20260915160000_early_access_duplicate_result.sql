-- Distinguish a genuinely new request from a repeat so the website sends the
-- acknowledgement and owner alert exactly once per (email, platform, interest).
-- The public HTTP response stays identical for both outcomes.
create or replace function public.request_early_access(
  p_email text, p_platform text, p_interest text, p_commitment boolean,
  p_attribution jsonb, p_ip_hash text, p_email_hash text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  inserted uuid;
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
    on conflict (email, platform, interest) do nothing
    returning id into inserted;
  if inserted is null then
    return 'duplicate';
  end if;
  return 'accepted';
end;
$$;
