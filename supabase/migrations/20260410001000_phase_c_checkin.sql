-- Phase C - check-ins and exhibitor policies

create index if not exists idx_entry_checkins_event_day_checked
  on public.entry_checkins (event_day_id, checked_in_at desc)
  where deleted_at is null;

create index if not exists idx_stand_checkins_event_day_checked
  on public.stand_checkins (event_day_id, checked_in_at desc)
  where deleted_at is null;

create index if not exists idx_exhibitor_users_user
  on public.exhibitor_users (user_id);

create index if not exists idx_event_exhibitors_event_company
  on public.event_exhibitors (event_id, exhibitor_company_id);

alter table public.entry_checkins enable row level security;
alter table public.stand_checkins enable row level security;
alter table public.exhibitor_companies enable row level security;
alter table public.event_exhibitors enable row level security;
alter table public.exhibitor_users enable row level security;

drop policy if exists p_entry_checkins_select_ops on public.entry_checkins;
create policy p_entry_checkins_select_ops
on public.entry_checkins
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao', 'expositor'));

drop policy if exists p_entry_checkins_insert_ops on public.entry_checkins;
create policy p_entry_checkins_insert_ops
on public.entry_checkins
for insert
to authenticated
with check (public.current_app_role() in ('super_adm', 'organizador', 'recepcao'));

drop policy if exists p_entry_checkins_update_super on public.entry_checkins;
create policy p_entry_checkins_update_super
on public.entry_checkins
for update
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

drop policy if exists p_stand_checkins_select_ops on public.stand_checkins;
create policy p_stand_checkins_select_ops
on public.stand_checkins
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao', 'expositor'));

drop policy if exists p_stand_checkins_insert_expositor on public.stand_checkins;
create policy p_stand_checkins_insert_expositor
on public.stand_checkins
for insert
to authenticated
with check (public.current_app_role() in ('super_adm', 'organizador', 'expositor'));

drop policy if exists p_stand_checkins_update_super on public.stand_checkins;
create policy p_stand_checkins_update_super
on public.stand_checkins
for update
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

drop policy if exists p_exhibitor_companies_select_ops on public.exhibitor_companies;
create policy p_exhibitor_companies_select_ops
on public.exhibitor_companies
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao', 'expositor'));

drop policy if exists p_exhibitor_companies_write_super_org on public.exhibitor_companies;
create policy p_exhibitor_companies_write_super_org
on public.exhibitor_companies
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_event_exhibitors_select_ops on public.event_exhibitors;
create policy p_event_exhibitors_select_ops
on public.event_exhibitors
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao', 'expositor'));

drop policy if exists p_event_exhibitors_write_super_org on public.event_exhibitors;
create policy p_event_exhibitors_write_super_org
on public.event_exhibitors
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_exhibitor_users_select_ops on public.exhibitor_users;
create policy p_exhibitor_users_select_ops
on public.exhibitor_users
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao', 'expositor'));

drop policy if exists p_exhibitor_users_write_super_org on public.exhibitor_users;
create policy p_exhibitor_users_write_super_org
on public.exhibitor_users
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

