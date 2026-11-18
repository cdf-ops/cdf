-- Foundation for event reports, registration lifecycle and participant change history.

alter table public.event_registrations
  add column if not exists status text not null default 'active',
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by uuid null references auth.users (id) on delete set null;

alter table public.event_registrations
  drop constraint if exists event_registrations_status_check;

alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('active', 'cancelled'));

alter table public.event_registrations
  drop constraint if exists event_registrations_cancellation_state_check;

alter table public.event_registrations
  add constraint event_registrations_cancellation_state_check
  check (
    (status = 'active' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null)
  );

create index if not exists idx_event_registrations_active_day_created
  on public.event_registrations (event_day_id, created_at)
  where status = 'active';

create index if not exists idx_event_registrations_active_participant
  on public.event_registrations (participant_id)
  where status = 'active';

create table if not exists public.participant_change_history (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  source text not null,
  changes jsonb not null,
  created_at timestamptz not null default now(),
  constraint participant_change_history_source_check
    check (source in ('public_registration', 'reception', 'admin', 'participant_admin', 'import', 'system')),
  constraint participant_change_history_changes_object_check
    check (jsonb_typeof(changes) = 'object' and changes <> '{}'::jsonb)
);

create index if not exists idx_participant_change_history_participant_created
  on public.participant_change_history (participant_id, created_at desc);

alter table public.participant_change_history enable row level security;

revoke all on table public.participant_change_history from anon, authenticated;
grant select, insert on table public.participant_change_history to service_role;
