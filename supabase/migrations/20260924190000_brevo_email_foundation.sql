-- Brevo transactional email foundation.
-- The platform is the source of truth for configuration, queueing, attempts,
-- and provider delivery events. Operational writes are performed with the
-- service role; authenticated users only receive the read/write access needed
-- by the event administration screens.

create table if not exists public.brevo_templates (
  template_id bigint primary key,
  name text not null,
  subject text not null,
  sender_name text null,
  sender_email text null,
  reply_to text null,
  tag text null,
  is_active boolean not null default false,
  brevo_created_at timestamptz null,
  brevo_modified_at timestamptz null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brevo_templates_active_name
  on public.brevo_templates (is_active, name);

create table if not exists public.event_brevo_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  registration_confirmation_enabled boolean not null default false,
  registration_template_id bigint null references public.brevo_templates (template_id),
  updated_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_brevo_settings_enabled_template_check check (
    not registration_confirmation_enabled or registration_template_id is not null
  )
);

create table if not exists public.brevo_contact_links (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  brevo_contact_id bigint not null unique,
  synced_email text not null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  participant_id uuid not null references public.participants (id),
  communication_type text not null default 'registration_confirmation'
    check (communication_type in ('registration_confirmation')),
  recipient_email text not null,
  template_id bigint not null references public.brevo_templates (template_id),
  contact_attributes jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'accepted',
      'delivered',
      'retryable_failed',
      'permanent_failed',
      'cancelled'
    )
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz null default now(),
  locked_at timestamptz null,
  locked_by text null,
  brevo_contact_id bigint null,
  brevo_message_id text null unique,
  last_error_code text null,
  last_error_message text null,
  processing_started_at timestamptz null,
  accepted_at timestamptz null,
  delivered_at timestamptz null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_delivery_jobs_contact_attributes_object_check
    check (jsonb_typeof(contact_attributes) = 'object')
);

create index if not exists idx_email_delivery_jobs_event_status
  on public.email_delivery_jobs (event_id, status, created_at desc);

create index if not exists idx_email_delivery_jobs_participant_event
  on public.email_delivery_jobs (participant_id, event_id);

create index if not exists idx_email_delivery_jobs_due
  on public.email_delivery_jobs (next_attempt_at, created_at)
  where status in ('pending', 'retryable_failed');

create table if not exists public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.email_delivery_jobs (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  n8n_execution_id text null,
  outcome text not null default 'started'
    check (outcome in ('started', 'accepted', 'retryable_failed', 'permanent_failed')),
  brevo_message_id text null,
  response_status integer null,
  error_code text null,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  unique (job_id, attempt_number)
);

create index if not exists idx_email_delivery_attempts_job_started
  on public.email_delivery_attempts (job_id, started_at desc);

create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid null references public.email_delivery_jobs (id) on delete set null,
  brevo_message_id text not null,
  event_type text not null,
  deduplication_key text not null unique,
  occurred_at timestamptz null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  constraint email_delivery_events_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists idx_email_delivery_events_message_received
  on public.email_delivery_events (brevo_message_id, received_at desc);

create or replace function public.enqueue_registration_confirmation(
  p_event_id uuid,
  p_participant_id uuid,
  p_recipient_email text,
  p_contact_attributes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id bigint;
  v_idempotency_key text;
  v_job_id uuid;
begin
  select registration_template_id
    into v_template_id
  from public.event_brevo_settings
  where event_id = p_event_id
    and registration_confirmation_enabled = true;

  if v_template_id is null then
    return null;
  end if;

  if nullif(trim(p_recipient_email), '') is null then
    raise exception 'Recipient email is required';
  end if;

  if jsonb_typeof(coalesce(p_contact_attributes, '{}'::jsonb)) <> 'object' then
    raise exception 'Contact attributes must be a JSON object';
  end if;

  v_idempotency_key := format(
    'registration_confirmation:%s:%s',
    p_event_id,
    p_participant_id
  );

  insert into public.email_delivery_jobs (
    event_id,
    participant_id,
    communication_type,
    recipient_email,
    template_id,
    contact_attributes,
    idempotency_key
  )
  values (
    p_event_id,
    p_participant_id,
    'registration_confirmation',
    lower(trim(p_recipient_email)),
    v_template_id,
    coalesce(p_contact_attributes, '{}'::jsonb),
    v_idempotency_key
  )
  on conflict (idempotency_key) do update
    set recipient_email = excluded.recipient_email,
        template_id = excluded.template_id,
        contact_attributes = excluded.contact_attributes
    where public.email_delivery_jobs.status in ('pending', 'retryable_failed')
  returning id into v_job_id;

  if v_job_id is null then
    select id
      into v_job_id
    from public.email_delivery_jobs
    where idempotency_key = v_idempotency_key;
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.enqueue_registration_confirmation(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_registration_confirmation(uuid, uuid, text, jsonb)
  to service_role;

create or replace function public.claim_email_delivery_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lock_seconds integer default 300
)
returns table (
  job_id uuid,
  event_id uuid,
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
    where (
      jobs.status in ('pending', 'retryable_failed')
      and coalesce(jobs.next_attempt_at, now()) <= now()
    ) or (
      jobs.status = 'processing'
      and jobs.locked_at < now() - make_interval(secs => v_lock_seconds)
    )
    order by coalesce(jobs.next_attempt_at, jobs.created_at), jobs.created_at
    for update skip locked
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
    claimed.participant_id,
    claimed.recipient_email,
    claimed.template_id,
    claimed.contact_attributes,
    claimed.attempt_count
  from claimed
  join attempts on attempts.job_id = claimed.id;
end;
$$;

revoke all on function public.claim_email_delivery_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_delivery_jobs(text, integer, integer)
  to service_role;

create or replace function public.complete_email_delivery_job(
  p_job_id uuid,
  p_worker_id text,
  p_outcome text,
  p_n8n_execution_id text default null,
  p_brevo_contact_id bigint default null,
  p_brevo_message_id text default null,
  p_response_status integer default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.email_delivery_jobs%rowtype;
  v_status text;
begin
  if p_outcome not in ('accepted', 'retryable_failed', 'permanent_failed') then
    raise exception 'Unsupported delivery outcome';
  end if;

  select *
    into v_job
  from public.email_delivery_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Delivery job not found';
  end if;

  if v_job.status <> 'processing' or v_job.locked_by is distinct from trim(p_worker_id) then
    if v_job.status in ('accepted', 'delivered', 'retryable_failed', 'permanent_failed', 'cancelled') then
      return v_job.status;
    end if;
    raise exception 'Delivery job is not leased by this worker';
  end if;

  if p_outcome = 'accepted' and (p_brevo_contact_id is null or nullif(trim(p_brevo_message_id), '') is null) then
    raise exception 'Brevo contact ID and message ID are required for accepted deliveries';
  end if;

  update public.email_delivery_attempts
  set outcome = p_outcome,
      n8n_execution_id = nullif(trim(p_n8n_execution_id), ''),
      brevo_message_id = nullif(trim(both '<>' from trim(p_brevo_message_id)), ''),
      response_status = p_response_status,
      error_code = nullif(trim(p_error_code), ''),
      error_message = nullif(left(trim(p_error_message), 1000), ''),
      completed_at = now()
  where job_id = v_job.id
    and attempt_number = v_job.attempt_count;

  if p_outcome = 'accepted' then
    insert into public.brevo_contact_links (
      participant_id,
      brevo_contact_id,
      synced_email,
      last_synced_at
    )
    values (
      v_job.participant_id,
      p_brevo_contact_id,
      v_job.recipient_email,
      now()
    )
    on conflict (participant_id) do update
      set brevo_contact_id = excluded.brevo_contact_id,
          synced_email = excluded.synced_email,
          last_synced_at = excluded.last_synced_at;

    update public.email_delivery_jobs
    set status = 'accepted',
        brevo_contact_id = p_brevo_contact_id,
        brevo_message_id = trim(both '<>' from trim(p_brevo_message_id)),
        accepted_at = now(),
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        last_error_code = null,
        last_error_message = null,
        failed_at = null
    where id = v_job.id
    returning status into v_status;
  elsif p_outcome = 'retryable_failed' then
    update public.email_delivery_jobs
    set status = 'retryable_failed',
        next_attempt_at = coalesce(p_retry_at, now() + interval '5 minutes'),
        locked_at = null,
        locked_by = null,
        last_error_code = nullif(trim(p_error_code), ''),
        last_error_message = nullif(left(trim(p_error_message), 1000), ''),
        failed_at = now()
    where id = v_job.id
    returning status into v_status;
  else
    update public.email_delivery_jobs
    set status = 'permanent_failed',
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        last_error_code = nullif(trim(p_error_code), ''),
        last_error_message = nullif(left(trim(p_error_message), 1000), ''),
        failed_at = now()
    where id = v_job.id
    returning status into v_status;
  end if;

  return v_status;
end;
$$;

revoke all on function public.complete_email_delivery_job(
  uuid, text, text, text, bigint, text, integer, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_email_delivery_job(
  uuid, text, text, text, bigint, text, integer, text, text, timestamptz
) to service_role;

create or replace function public.sync_brevo_templates(
  p_templates jsonb,
  p_deactivate_missing boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_synced_count integer;
begin
  if jsonb_typeof(p_templates) <> 'array' then
    raise exception 'Brevo templates must be a JSON array';
  end if;

  if jsonb_array_length(p_templates) > 1000 then
    raise exception 'Brevo template catalog exceeds 1000 entries';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_templates) as item
    where jsonb_typeof(item) <> 'object'
      or nullif(trim(item ->> 'id'), '') is null
      or nullif(trim(item ->> 'name'), '') is null
  ) then
    raise exception 'Brevo template catalog contains an invalid entry';
  end if;

  with incoming as (
    select distinct on (template.id)
      template.id as template_id,
      trim(template.name) as name,
      coalesce(trim(template.subject), '') as subject,
      nullif(trim(template."senderName"), '') as sender_name,
      nullif(lower(trim(template."senderEmail")), '') as sender_email,
      nullif(lower(trim(template."replyTo")), '') as reply_to,
      nullif(trim(template.tag), '') as tag,
      coalesce(template."isActive", false) as is_active,
      template."createdAt" as brevo_created_at,
      template."modifiedAt" as brevo_modified_at
    from jsonb_to_recordset(p_templates) as template (
      id bigint,
      name text,
      subject text,
      "senderName" text,
      "senderEmail" text,
      "replyTo" text,
      tag text,
      "isActive" boolean,
      "createdAt" timestamptz,
      "modifiedAt" timestamptz
    )
    where template.id > 0
    order by template.id, template."modifiedAt" desc nulls last
  ),
  upserted as (
    insert into public.brevo_templates (
      template_id,
      name,
      subject,
      sender_name,
      sender_email,
      reply_to,
      tag,
      is_active,
      brevo_created_at,
      brevo_modified_at,
      synced_at
    )
    select
      incoming.template_id,
      incoming.name,
      incoming.subject,
      incoming.sender_name,
      incoming.sender_email,
      incoming.reply_to,
      incoming.tag,
      incoming.is_active,
      incoming.brevo_created_at,
      incoming.brevo_modified_at,
      now()
    from incoming
    on conflict (template_id) do update
      set name = excluded.name,
          subject = excluded.subject,
          sender_name = excluded.sender_name,
          sender_email = excluded.sender_email,
          reply_to = excluded.reply_to,
          tag = excluded.tag,
          is_active = excluded.is_active,
          brevo_created_at = excluded.brevo_created_at,
          brevo_modified_at = excluded.brevo_modified_at,
          synced_at = excluded.synced_at
    returning template_id
  )
  select count(*) into v_synced_count from upserted;

  if p_deactivate_missing then
    update public.brevo_templates as existing
    set is_active = false,
        synced_at = now()
    where existing.is_active = true
      and not exists (
        select 1
        from jsonb_array_elements(p_templates) as item
        where (item ->> 'id')::bigint = existing.template_id
      );
  end if;

  return v_synced_count;
end;
$$;

revoke all on function public.sync_brevo_templates(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.sync_brevo_templates(jsonb, boolean)
  to service_role;

create or replace function public.record_brevo_delivery_event(
  p_message_id text,
  p_event_type text,
  p_deduplication_key text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id text := nullif(trim(both '<>' from trim(p_message_id)), '');
  v_event_type text := lower(trim(p_event_type));
  v_job_id uuid;
  v_status text;
  v_inserted_count integer;
begin
  if v_message_id is null or nullif(trim(p_deduplication_key), '') is null then
    raise exception 'Message ID and deduplication key are required';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Brevo delivery payload must be a JSON object';
  end if;

  select id
    into v_job_id
  from public.email_delivery_jobs
  where brevo_message_id = v_message_id;

  insert into public.email_delivery_events (
    job_id,
    brevo_message_id,
    event_type,
    deduplication_key,
    occurred_at,
    payload
  )
  values (
    v_job_id,
    v_message_id,
    v_event_type,
    trim(p_deduplication_key),
    p_occurred_at,
    p_payload
  )
  on conflict (deduplication_key) do nothing;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    return 'duplicate';
  end if;

  if v_job_id is null then
    return 'unmatched';
  end if;

  if v_event_type = 'delivered' then
    update public.email_delivery_jobs
    set status = 'delivered',
        delivered_at = coalesce(p_occurred_at, now()),
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        last_error_code = null,
        last_error_message = null,
        failed_at = null
    where id = v_job_id
    returning status into v_status;
  elsif v_event_type in ('soft_bounce', 'softbounce') then
    update public.email_delivery_jobs
    set status = 'retryable_failed',
        next_attempt_at = now() + interval '24 hours',
        locked_at = null,
        locked_by = null,
        last_error_code = v_event_type,
        last_error_message = nullif(left(trim(p_payload ->> 'reason'), 1000), ''),
        failed_at = coalesce(p_occurred_at, now())
    where id = v_job_id
      and status <> 'delivered'
    returning status into v_status;
  elsif v_event_type in (
    'hard_bounce',
    'hardbounce',
    'blocked',
    'invalid',
    'invalid_email',
    'error',
    'spam',
    'unsubscribed'
  ) then
    update public.email_delivery_jobs
    set status = 'permanent_failed',
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        last_error_code = v_event_type,
        last_error_message = nullif(left(trim(p_payload ->> 'reason'), 1000), ''),
        failed_at = coalesce(p_occurred_at, now())
    where id = v_job_id
      and status <> 'delivered'
    returning status into v_status;
  end if;

  if v_status is null then
    select status into v_status from public.email_delivery_jobs where id = v_job_id;
  end if;

  return v_status;
end;
$$;

revoke all on function public.record_brevo_delivery_event(text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_brevo_delivery_event(text, text, text, timestamptz, jsonb)
  to service_role;

drop trigger if exists trg_brevo_templates_updated_at on public.brevo_templates;
create trigger trg_brevo_templates_updated_at
before update on public.brevo_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_event_brevo_settings_updated_at on public.event_brevo_settings;
create trigger trg_event_brevo_settings_updated_at
before update on public.event_brevo_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_brevo_contact_links_updated_at on public.brevo_contact_links;
create trigger trg_brevo_contact_links_updated_at
before update on public.brevo_contact_links
for each row execute function public.set_updated_at();

drop trigger if exists trg_email_delivery_jobs_updated_at on public.email_delivery_jobs;
create trigger trg_email_delivery_jobs_updated_at
before update on public.email_delivery_jobs
for each row execute function public.set_updated_at();

alter table public.brevo_templates enable row level security;
alter table public.event_brevo_settings enable row level security;
alter table public.brevo_contact_links enable row level security;
alter table public.email_delivery_jobs enable row level security;
alter table public.email_delivery_attempts enable row level security;
alter table public.email_delivery_events enable row level security;

create policy p_brevo_templates_select_admin
on public.brevo_templates
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_event_brevo_settings_select_admin
on public.event_brevo_settings
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_event_brevo_settings_write_admin
on public.event_brevo_settings
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_brevo_contact_links_select_admin
on public.brevo_contact_links
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_email_delivery_jobs_select_admin
on public.email_delivery_jobs
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_email_delivery_attempts_select_admin
on public.email_delivery_attempts
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_email_delivery_events_select_admin
on public.email_delivery_events
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

comment on table public.brevo_templates is
  'Sanitized cache of Brevo transactional email templates available for event configuration.';

comment on table public.event_brevo_settings is
  'Per-event Brevo configuration. Static event content remains inside the selected Brevo template.';

comment on table public.brevo_contact_links is
  'Stable mapping between a Clube do Frio participant and the corresponding Brevo contact.';

comment on table public.email_delivery_jobs is
  'Durable transactional email outbox and current provider delivery state.';

comment on table public.email_delivery_attempts is
  'Append-only processing attempt history for each email delivery job.';

comment on table public.email_delivery_events is
  'Deduplicated raw transactional delivery events received from Brevo.';

comment on function public.enqueue_registration_confirmation(uuid, uuid, text, jsonb) is
  'Creates or refreshes one pending registration confirmation per participant and event.';

comment on function public.claim_email_delivery_jobs(text, integer, integer) is
  'Atomically leases due email jobs to one worker and records a new attempt.';

comment on function public.complete_email_delivery_job(
  uuid, text, text, text, bigint, text, integer, text, text, timestamptz
) is 'Atomically records the outcome of a leased email delivery attempt.';

comment on function public.sync_brevo_templates(jsonb, boolean) is
  'Atomically refreshes the sanitized Brevo template catalog and deactivates missing templates.';

comment on function public.record_brevo_delivery_event(text, text, text, timestamptz, jsonb) is
  'Deduplicates a Brevo transactional event and advances the matching delivery job state.';
