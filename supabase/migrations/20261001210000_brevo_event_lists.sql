-- Automatically managed Brevo list for each event.

alter table public.event_brevo_settings
  add column if not exists brevo_list_id bigint null,
  add column if not exists brevo_list_name text null,
  add column if not exists brevo_list_synced_at timestamptz null;

alter table public.event_brevo_settings
  drop constraint if exists event_brevo_settings_list_id_positive_check;

alter table public.event_brevo_settings
  add constraint event_brevo_settings_list_id_positive_check
  check (brevo_list_id is null or brevo_list_id > 0);

alter table public.event_brevo_settings
  drop constraint if exists event_brevo_settings_list_pair_check;

alter table public.event_brevo_settings
  add constraint event_brevo_settings_list_pair_check
  check (
    (brevo_list_id is null and brevo_list_name is null)
    or (brevo_list_id is not null and nullif(trim(brevo_list_name), '') is not null)
  );

alter table public.event_brevo_settings
  drop constraint if exists event_brevo_settings_enabled_list_check;

alter table public.event_brevo_settings
  add constraint event_brevo_settings_enabled_list_check
  check (not registration_confirmation_enabled or brevo_list_id is not null)
  not valid;

alter table public.event_brevo_settings
  drop constraint if exists event_brevo_settings_enabled_list_check;

alter table public.event_brevo_settings
  add constraint event_brevo_settings_enabled_list_check
  check (not registration_confirmation_enabled or brevo_list_id is not null)
  not valid;

create unique index if not exists idx_event_brevo_settings_list_id
  on public.event_brevo_settings (brevo_list_id)
  where brevo_list_id is not null;

drop function if exists public.claim_email_delivery_jobs(text, integer, integer);

create function public.claim_email_delivery_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lock_seconds integer default 300
)
returns table (
  job_id uuid,
  event_id uuid,
  event_name text,
  brevo_list_id bigint,
  participant_id uuid,
  recipient_email text,
  template_id bigint,
  contact_attributes jsonb,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_lock_seconds integer := greatest(60, least(coalesce(p_lock_seconds, 300), 1800));
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'Worker ID is required';
  end if;

  return query
  with candidates as (
    select jobs.id
    from public.email_delivery_jobs as jobs
    join public.event_brevo_settings as settings
      on settings.event_id = jobs.event_id
     and settings.brevo_list_id is not null
    where (
      jobs.status in ('pending', 'retryable_failed')
      and coalesce(jobs.next_attempt_at, now()) <= now()
    ) or (
      jobs.status = 'processing'
      and jobs.locked_at < now() - make_interval(secs => v_lock_seconds)
    )
    order by coalesce(jobs.next_attempt_at, jobs.created_at), jobs.created_at
    for update of jobs skip locked
    limit v_limit
  ),
  claimed as (
    update public.email_delivery_jobs as jobs
    set status = 'processing',
        attempt_count = jobs.attempt_count + 1,
        next_attempt_at = null,
        locked_at = now(),
        locked_by = trim(p_worker_id),
        processing_started_at = now(),
        last_error_code = null,
        last_error_message = null
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  ),
  attempts as (
    insert into public.email_delivery_attempts (
      job_id,
      attempt_number,
      outcome
    )
    select claimed.id, claimed.attempt_count, 'started'
    from claimed
    returning email_delivery_attempts.job_id
  )
  select
    claimed.id,
    claimed.event_id,
    events.name,
    settings.brevo_list_id,
    claimed.participant_id,
    claimed.recipient_email,
    claimed.template_id,
    claimed.contact_attributes,
    claimed.attempt_count
  from claimed
  join attempts on attempts.job_id = claimed.id
  join public.events as events on events.id = claimed.event_id
  join public.event_brevo_settings as settings on settings.event_id = claimed.event_id;
end;
$$;

revoke all on function public.claim_email_delivery_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_delivery_jobs(text, integer, integer)
  to service_role;

comment on column public.event_brevo_settings.brevo_list_id is
  'Brevo contact list managed automatically for this event.';

comment on column public.event_brevo_settings.brevo_list_name is
  'Last event name synchronized to the managed Brevo contact list.';

comment on function public.claim_email_delivery_jobs(text, integer, integer) is
  'Atomically leases due email jobs whose events have a managed Brevo list.';
