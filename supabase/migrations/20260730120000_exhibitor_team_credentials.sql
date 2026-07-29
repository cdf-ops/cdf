-- Equipe geral das empresas expositoras e credenciais visuais por evento

alter table public.exhibitor_companies
  add column if not exists logo_path text null;

create table if not exists public.exhibitor_team_members (
  id uuid primary key default gen_random_uuid(),
  exhibitor_company_id uuid not null references public.exhibitor_companies (id) on delete cascade,
  full_name text not null,
  job_title text null,
  linked_user_id uuid null references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_exhibitor_team_linked_user
  on public.exhibitor_team_members (exhibitor_company_id, linked_user_id)
  where linked_user_id is not null;

create index if not exists idx_exhibitor_team_company_status
  on public.exhibitor_team_members (exhibitor_company_id, status, full_name);

create table if not exists public.exhibitor_credentials (
  id uuid primary key default gen_random_uuid(),
  event_exhibitor_id uuid not null references public.event_exhibitors (id) on delete cascade,
  team_member_id uuid not null references public.exhibitor_team_members (id) on delete restrict,
  category text not null default 'expositor'
    check (category in ('expositor', 'organizacao', 'palestrante', 'imprensa', 'convidado')),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  generated_at timestamptz not null default now(),
  generated_by uuid null references auth.users (id),
  last_printed_at timestamptz null,
  last_printed_by uuid null references auth.users (id),
  print_count integer not null default 0 check (print_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_exhibitor_id, team_member_id)
);

create index if not exists idx_exhibitor_credentials_event
  on public.exhibitor_credentials (event_exhibitor_id, status);

create or replace function public.validate_exhibitor_credential_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_company_id uuid;
  member_company_id uuid;
begin
  select exhibitor_company_id
    into event_company_id
  from public.event_exhibitors
  where id = new.event_exhibitor_id;

  select exhibitor_company_id
    into member_company_id
  from public.exhibitor_team_members
  where id = new.team_member_id;

  if event_company_id is null or member_company_id is null or event_company_id <> member_company_id then
    raise exception 'A pessoa credenciada não pertence à empresa vinculada ao evento.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_exhibitor_team_members_updated_at on public.exhibitor_team_members;
create trigger trg_exhibitor_team_members_updated_at
before update on public.exhibitor_team_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_exhibitor_credentials_updated_at on public.exhibitor_credentials;
create trigger trg_exhibitor_credentials_updated_at
before update on public.exhibitor_credentials
for each row execute function public.set_updated_at();

drop trigger if exists trg_validate_exhibitor_credential_company on public.exhibitor_credentials;
create trigger trg_validate_exhibitor_credential_company
before insert or update of event_exhibitor_id, team_member_id on public.exhibitor_credentials
for each row execute function public.validate_exhibitor_credential_company();

alter table public.exhibitor_team_members enable row level security;
alter table public.exhibitor_credentials enable row level security;

create policy p_exhibitor_team_select
on public.exhibitor_team_members
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = exhibitor_team_members.exhibitor_company_id
        and user_link.user_id = auth.uid()
    )
  )
);

create policy p_exhibitor_team_insert
on public.exhibitor_team_members
for insert
to authenticated
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and created_by = auth.uid()
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = exhibitor_team_members.exhibitor_company_id
        and user_link.user_id = auth.uid()
    )
  )
);

create policy p_exhibitor_team_update
on public.exhibitor_team_members
for update
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = exhibitor_team_members.exhibitor_company_id
        and user_link.user_id = auth.uid()
    )
  )
)
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = exhibitor_team_members.exhibitor_company_id
        and user_link.user_id = auth.uid()
    )
  )
);

create policy p_exhibitor_credentials_select
on public.exhibitor_credentials
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.event_exhibitors event_link
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and user_link.user_id = auth.uid()
    )
  )
);

create policy p_exhibitor_credentials_insert
on public.exhibitor_credentials
for insert
to authenticated
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and generated_by = auth.uid()
    and exists (
      select 1
      from public.event_exhibitors event_link
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and user_link.user_id = auth.uid()
    )
  )
);

create policy p_exhibitor_credentials_update
on public.exhibitor_credentials
for update
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.event_exhibitors event_link
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and user_link.user_id = auth.uid()
    )
  )
)
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.event_exhibitors event_link
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and user_link.user_id = auth.uid()
    )
  )
);
