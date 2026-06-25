-- Global participant directory with aggregated event attendance metrics.

create index if not exists idx_event_registrations_participant_day
  on public.event_registrations (participant_id, event_day_id);

create index if not exists idx_entry_checkins_participant_checked
  on public.entry_checkins (participant_id, checked_in_at desc)
  where deleted_at is null;

create or replace function public.list_global_participants(
  p_search text default null,
  p_event_id uuid default null,
  p_city text default null,
  p_profession text default null,
  p_last_checkin_from date default null,
  p_last_checkin_to date default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  participant_id uuid,
  full_name text,
  document_type text,
  document_number text,
  email text,
  phone text,
  state text,
  city text,
  profession text,
  event_count bigint,
  entry_checkin_count bigint,
  last_checkin_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with registration_events as (
    select distinct registrations.participant_id, days.event_id
    from public.event_registrations registrations
    join public.event_days days on days.id = registrations.event_day_id
  ),
  registration_metrics as (
    select participant_id, count(*)::bigint as event_count
    from registration_events
    group by participant_id
  ),
  checkin_metrics as (
    select
      participant_id,
      count(*)::bigint as entry_checkin_count,
      max(checked_in_at) as last_checkin_at
    from public.entry_checkins
    where deleted_at is null
    group by participant_id
  ),
  filtered_participants as (
    select
      participants.id as participant_id,
      participants.full_name,
      participants.document_type,
      participants.document_number,
      participants.email,
      participants.phone,
      participants.state,
      participants.city,
      participants.profession,
      coalesce(registration_metrics.event_count, 0)::bigint as event_count,
      coalesce(checkin_metrics.entry_checkin_count, 0)::bigint as entry_checkin_count,
      checkin_metrics.last_checkin_at
    from public.participants participants
    left join registration_metrics on registration_metrics.participant_id = participants.id
    left join checkin_metrics on checkin_metrics.participant_id = participants.id
    where (
      nullif(trim(p_search), '') is null
      or participants.full_name ilike '%' || trim(p_search) || '%'
      or participants.document_number ilike '%' || trim(p_search) || '%'
      or participants.email ilike '%' || trim(p_search) || '%'
      or participants.phone ilike '%' || trim(p_search) || '%'
    )
    and (
      p_event_id is null
      or exists (
        select 1
        from registration_events
        where registration_events.participant_id = participants.id
          and registration_events.event_id = p_event_id
      )
    )
    and (nullif(trim(p_city), '') is null or participants.city ilike trim(p_city))
    and (nullif(trim(p_profession), '') is null or participants.profession ilike trim(p_profession))
    and (p_last_checkin_from is null or checkin_metrics.last_checkin_at >= p_last_checkin_from)
    and (p_last_checkin_to is null or checkin_metrics.last_checkin_at < p_last_checkin_to + 1)
  )
  select
    filtered_participants.*,
    count(*) over()::bigint as total_count
  from filtered_participants
  order by full_name asc, participant_id asc
  limit greatest(1, least(coalesce(p_limit, 50), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from public;
revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from anon;
revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from authenticated;
grant execute on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) to service_role;
