-- Phase B - participants, registrations, badges policies

create unique index if not exists uq_badges_event_participant
  on public.badges (event_id, participant_id);

create index if not exists idx_participants_document
  on public.participants (document_type, document_number);

create index if not exists idx_event_registrations_event_day
  on public.event_registrations (event_day_id);

alter table public.participants enable row level security;
alter table public.event_registrations enable row level security;
alter table public.badges enable row level security;

drop policy if exists p_participants_select_authenticated on public.participants;
create policy p_participants_select_authenticated
on public.participants
for select
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm', 'expositor'));

drop policy if exists p_participants_write_org_recepcao_super on public.participants;
create policy p_participants_write_org_recepcao_super
on public.participants
for all
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'))
with check (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'));

drop policy if exists p_registrations_select_authenticated on public.event_registrations;
create policy p_registrations_select_authenticated
on public.event_registrations
for select
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm', 'expositor'));

drop policy if exists p_registrations_write_org_recepcao_super on public.event_registrations;
create policy p_registrations_write_org_recepcao_super
on public.event_registrations
for all
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'))
with check (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'));

drop policy if exists p_badges_select_org_super on public.badges;
create policy p_badges_select_org_super
on public.badges
for select
to authenticated
using (public.current_app_role() in ('organizador', 'super_adm'));

drop policy if exists p_badges_write_org_super on public.badges;
create policy p_badges_write_org_super
on public.badges
for all
to authenticated
using (public.current_app_role() in ('organizador', 'super_adm'))
with check (public.current_app_role() in ('organizador', 'super_adm'));

