-- ProduEvent MVP - base schema
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'recepcao' check (role in ('super_adm', 'organizador', 'recepcao', 'expositor')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  details text null,
  status text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'encerrado')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (event_id, date)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  document_type text not null,
  document_number text not null,
  email text not null,
  phone text not null,
  state text not null,
  city text not null,
  profession text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, document_number)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  event_day_id uuid not null references public.event_days (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, event_day_id)
);

create table if not exists public.entry_checkins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  event_day_id uuid not null references public.event_days (id),
  operator_user_id uuid not null references auth.users (id),
  origin text not null default 'recepcao',
  checked_in_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null references auth.users (id)
);

create unique index if not exists uq_entry_checkin_active
  on public.entry_checkins (participant_id, event_day_id)
  where deleted_at is null;

create table if not exists public.exhibitor_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_exhibitors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  exhibitor_company_id uuid not null references public.exhibitor_companies (id) on delete cascade,
  stand_name text null,
  created_at timestamptz not null default now(),
  unique (event_id, exhibitor_company_id)
);

create table if not exists public.exhibitor_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exhibitor_company_id uuid not null references public.exhibitor_companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, exhibitor_company_id)
);

create table if not exists public.stand_checkins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  event_day_id uuid not null references public.event_days (id),
  event_exhibitor_id uuid not null references public.event_exhibitors (id),
  operator_user_id uuid not null references auth.users (id),
  checked_in_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null references auth.users (id)
);

create unique index if not exists uq_stand_checkin_active
  on public.stand_checkins (participant_id, event_day_id, event_exhibitor_id)
  where deleted_at is null;

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  event_id uuid not null references public.events (id),
  qr_slug text not null unique,
  pdf_url text null,
  generated_by uuid not null references auth.users (id),
  generated_at timestamptz not null default now()
);

create table if not exists public.raffles (
  id uuid primary key default gen_random_uuid(),
  event_day_id uuid not null references public.event_days (id),
  prize_description text not null,
  winners_count int not null default 1 check (winners_count > 0),
  executed_at timestamptz null,
  executed_by uuid null references auth.users (id),
  deleted_at timestamptz null,
  deleted_by uuid null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.raffle_winners (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles (id) on delete cascade,
  participant_id uuid not null references public.participants (id),
  created_at timestamptz not null default now(),
  unique (raffle_id, participant_id)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  event_day_id uuid not null references public.event_days (id),
  issued_by uuid not null references auth.users (id),
  pdf_url text null,
  issued_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users (id),
  action text not null,
  context jsonb null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_participants_updated_at on public.participants;
create trigger trg_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

drop trigger if exists trg_exhibitor_companies_updated_at on public.exhibitor_companies;
create trigger trg_exhibitor_companies_updated_at
before update on public.exhibitor_companies
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role, status)
  values (new.id, 'recepcao', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select role
  from public.user_profiles
  where id = auth.uid()
$$;

alter table public.user_profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_days enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists p_user_profiles_select_own_or_admin on public.user_profiles;
create policy p_user_profiles_select_own_or_admin
on public.user_profiles
for select
to authenticated
using (id = auth.uid() or public.current_app_role() = 'super_adm');

drop policy if exists p_user_profiles_update_admin on public.user_profiles;
create policy p_user_profiles_update_admin
on public.user_profiles
for update
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

drop policy if exists p_events_select_authenticated on public.events;
create policy p_events_select_authenticated
on public.events
for select
to authenticated
using (true);

drop policy if exists p_events_write_org_or_super on public.events;
create policy p_events_write_org_or_super
on public.events
for all
to authenticated
using (public.current_app_role() in ('organizador', 'super_adm'))
with check (public.current_app_role() in ('organizador', 'super_adm'));

drop policy if exists p_event_days_select_authenticated on public.event_days;
create policy p_event_days_select_authenticated
on public.event_days
for select
to authenticated
using (true);

drop policy if exists p_event_days_write_org_or_super on public.event_days;
create policy p_event_days_write_org_or_super
on public.event_days
for all
to authenticated
using (public.current_app_role() in ('organizador', 'super_adm'))
with check (public.current_app_role() in ('organizador', 'super_adm'));

drop policy if exists p_audit_select_super on public.audit_logs;
create policy p_audit_select_super
on public.audit_logs
for select
to authenticated
using (public.current_app_role() = 'super_adm');

drop policy if exists p_audit_insert_org_recepcao_super on public.audit_logs;
create policy p_audit_insert_org_recepcao_super
on public.audit_logs
for insert
to authenticated
with check (public.current_app_role() in ('organizador', 'recepcao', 'super_adm', 'expositor'));
