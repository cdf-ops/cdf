-- Reset emergencial, troca obrigatória de senha e validade do acesso de expositores.

alter table public.user_profiles
  add column if not exists password_change_required boolean not null default false,
  add column if not exists temporary_password_issued_at timestamptz null,
  add column if not exists temporary_password_issued_by uuid null references auth.users (id);

alter table public.exhibitor_users
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended')),
  add column if not exists access_validated_at timestamptz null,
  add column if not exists access_valid_until timestamptz null,
  add column if not exists access_validated_by uuid null references auth.users (id),
  add column if not exists emergency_access_until timestamptz null;

update public.exhibitor_users
set
  access_validated_at = coalesce(access_validated_at, now()),
  access_valid_until = coalesce(access_valid_until, now() + interval '30 days')
where access_validated_at is null or access_valid_until is null;

alter table public.exhibitor_users
  alter column access_validated_at set default now(),
  alter column access_validated_at set not null,
  alter column access_valid_until set default (now() + interval '30 days'),
  alter column access_valid_until set not null;

create index if not exists idx_exhibitor_users_access
  on public.exhibitor_users (user_id, status, access_valid_until, emergency_access_until);

create or replace function public.has_active_exhibitor_access(company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exhibitor_users link
    join public.user_profiles profile on profile.id = link.user_id
    where link.user_id = auth.uid()
      and link.exhibitor_company_id = company_id
      and link.status = 'active'
      and profile.status = 'active'
      and profile.password_change_required = false
      and (
        link.access_valid_until > now()
        or coalesce(link.emergency_access_until, '-infinity'::timestamptz) > now()
      )
  )
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when profile.status <> 'active' or profile.password_change_required then null
    when profile.role <> 'expositor' then profile.role
    when exists (
      select 1
      from public.exhibitor_users link
      where link.user_id = profile.id
        and link.status = 'active'
        and (
          link.access_valid_until > now()
          or coalesce(link.emergency_access_until, '-infinity'::timestamptz) > now()
        )
    ) then profile.role
    else null
  end
  from public.user_profiles profile
  where profile.id = auth.uid()
$$;

drop policy if exists p_events_select_authenticated on public.events;
create policy p_events_select_authenticated
on public.events
for select
to authenticated
using (public.current_app_role() is not null);

drop policy if exists p_event_days_select_authenticated on public.event_days;
create policy p_event_days_select_authenticated
on public.event_days
for select
to authenticated
using (public.current_app_role() is not null);

drop policy if exists p_exhibitor_users_select_ops on public.exhibitor_users;
create policy p_exhibitor_users_select_ops
on public.exhibitor_users
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or user_id = auth.uid()
);

drop policy if exists p_exhibitor_companies_select_ops on public.exhibitor_companies;
create policy p_exhibitor_companies_select_ops
on public.exhibitor_companies
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or (
    public.current_app_role() = 'expositor'
    and public.has_active_exhibitor_access(exhibitor_companies.id)
  )
);

drop policy if exists p_event_exhibitors_select_ops on public.event_exhibitors;
create policy p_event_exhibitors_select_ops
on public.event_exhibitors
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or (
    public.current_app_role() = 'expositor'
    and public.has_active_exhibitor_access(event_exhibitors.exhibitor_company_id)
  )
);

drop policy if exists p_stand_checkins_select_ops on public.stand_checkins;
create policy p_stand_checkins_select_ops
on public.stand_checkins
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.event_exhibitors event_link
      where event_link.id = stand_checkins.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
    )
  )
);

drop policy if exists p_stand_checkins_insert_expositor on public.stand_checkins;
create policy p_stand_checkins_insert_expositor
on public.stand_checkins
for insert
to authenticated
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and operator_user_id = auth.uid()
    and exists (
      select 1
      from public.event_exhibitors event_link
      where event_link.id = stand_checkins.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
    )
    and exists (
      select 1
      from public.entry_checkins entry
      where entry.participant_id = stand_checkins.participant_id
        and entry.event_day_id = stand_checkins.event_day_id
        and entry.deleted_at is null
    )
  )
);

drop policy if exists p_exhibitor_team_select on public.exhibitor_team_members;
create policy p_exhibitor_team_select
on public.exhibitor_team_members
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and public.has_active_exhibitor_access(exhibitor_team_members.exhibitor_company_id)
  )
);

drop policy if exists p_exhibitor_team_insert on public.exhibitor_team_members;
create policy p_exhibitor_team_insert
on public.exhibitor_team_members
for insert
to authenticated
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and created_by = auth.uid()
    and public.has_active_exhibitor_access(exhibitor_team_members.exhibitor_company_id)
  )
);

drop policy if exists p_exhibitor_team_update on public.exhibitor_team_members;
create policy p_exhibitor_team_update
on public.exhibitor_team_members
for update
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and public.has_active_exhibitor_access(exhibitor_team_members.exhibitor_company_id)
  )
)
with check (
  public.current_app_role() in ('super_adm', 'organizador')
  or (
    public.current_app_role() = 'expositor'
    and public.has_active_exhibitor_access(exhibitor_team_members.exhibitor_company_id)
  )
);

drop policy if exists p_exhibitor_credentials_select on public.exhibitor_credentials;
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
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
    )
  )
);

drop policy if exists p_exhibitor_credentials_insert on public.exhibitor_credentials;
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
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
    )
  )
);

drop policy if exists p_exhibitor_credentials_update on public.exhibitor_credentials;
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
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
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
      where event_link.id = exhibitor_credentials.event_exhibitor_id
        and public.has_active_exhibitor_access(event_link.exhibitor_company_id)
    )
  )
);
