-- Limit repeated public registration attempts without storing raw IP addresses.

create table if not exists public.public_registration_attempts (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  fingerprint_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_registration_attempts_lookup
  on public.public_registration_attempts (event_id, fingerprint_hash, created_at desc);

alter table public.public_registration_attempts enable row level security;

create or replace function public.check_public_registration_rate_limit(
  p_event_id uuid,
  p_fingerprint_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_fingerprint_hash, 0));

  delete from public.public_registration_attempts
  where created_at < now() - make_interval(secs => p_window_seconds);

  select count(*)
  into recent_attempts
  from public.public_registration_attempts
  where event_id = p_event_id
    and fingerprint_hash = p_fingerprint_hash
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent_attempts >= p_limit then
    return false;
  end if;

  insert into public.public_registration_attempts (event_id, fingerprint_hash)
  values (p_event_id, p_fingerprint_hash);

  return true;
end;
$$;

revoke all on function public.check_public_registration_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.check_public_registration_rate_limit(uuid, text, integer, integer) to service_role;
