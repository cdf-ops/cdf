-- Permanent, human-friendly participant number shared across every event.

create sequence if not exists public.participant_number_seq
  as integer
  minvalue 1000
  maxvalue 99999
  start with 1000
  increment by 1
  no cycle;

alter table public.participants
  add column if not exists participant_number integer;

alter sequence public.participant_number_seq owned by public.participants.participant_number;

alter table public.participants
  alter column participant_number set default nextval('public.participant_number_seq'::regclass);

with numbered_participants as (
  select
    id,
    (999 + row_number() over (order by created_at asc, id asc))::integer as assigned_number
  from public.participants
  where participant_number is null
)
update public.participants participants
set participant_number = numbered_participants.assigned_number
from numbered_participants
where participants.id = numbered_participants.id;

select setval(
  'public.participant_number_seq',
  coalesce((select max(participant_number) from public.participants), 1000),
  exists(select 1 from public.participants)
);

alter table public.participants
  alter column participant_number set not null;

create unique index if not exists uq_participants_participant_number
  on public.participants (participant_number);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_participants_participant_number_range'
      and conrelid = 'public.participants'::regclass
  ) then
    alter table public.participants
      add constraint chk_participants_participant_number_range
      check (participant_number between 1000 and 99999);
  end if;
end;
$$;

create or replace function public.prevent_participant_number_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.participant_number is distinct from old.participant_number then
    raise exception 'O número global do participante não pode ser alterado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_participants_immutable_number on public.participants;
create trigger trg_participants_immutable_number
before update of participant_number on public.participants
for each row
execute function public.prevent_participant_number_change();

grant usage, select on sequence public.participant_number_seq to authenticated, service_role;

drop function if exists public.list_global_participants(text, uuid, text, text, date, date, integer, integer);

create function public.list_global_participants(
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
  participant_number integer,
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
      participants.participant_number,
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
      or case
        when trim(p_search) ~ '^[0-9]{4,5}$'
          then participants.participant_number = trim(p_search)::integer
        else false
      end
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
  order by participant_number asc
  limit greatest(1, least(coalesce(p_limit, 50), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from public;
revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from anon;
revoke all on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) from authenticated;
grant execute on function public.list_global_participants(text, uuid, text, text, date, date, integer, integer) to service_role;
