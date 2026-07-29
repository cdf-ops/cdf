-- Consentimento LGPD e compartilhamento controlado com expositores

create table if not exists public.event_exhibitor_data_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  share_email boolean not null default false,
  share_phone boolean not null default false,
  share_profession boolean not null default false,
  share_city boolean not null default false,
  share_state boolean not null default false,
  updated_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participant_event_consents (
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  exhibitor_data_sharing boolean not null,
  consent_version text not null,
  consent_text text not null,
  source text not null check (source in ('public_registration', 'legacy_registration', 'admin')),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create index if not exists idx_participant_event_consents_participant
  on public.participant_event_consents (participant_id, event_id);

drop trigger if exists trg_event_exhibitor_data_settings_updated_at on public.event_exhibitor_data_settings;
create trigger trg_event_exhibitor_data_settings_updated_at
before update on public.event_exhibitor_data_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_participant_event_consents_updated_at on public.participant_event_consents;
create trigger trg_participant_event_consents_updated_at
before update on public.participant_event_consents
for each row execute function public.set_updated_at();

-- Cadastros anteriores não recebem consentimento presumido.
insert into public.participant_event_consents (
  event_id,
  participant_id,
  exhibitor_data_sharing,
  consent_version,
  consent_text,
  source
)
select distinct
  days.event_id,
  registrations.participant_id,
  false,
  'legacy-no-consent',
  'Cadastro realizado antes da coleta explícita de consentimento para compartilhamento com expositores.',
  'legacy_registration'
from public.event_registrations registrations
join public.event_days days on days.id = registrations.event_day_id
on conflict (event_id, participant_id) do nothing;

alter table public.event_exhibitor_data_settings enable row level security;
alter table public.participant_event_consents enable row level security;

create policy p_exhibitor_settings_select_authenticated
on public.event_exhibitor_data_settings
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'expositor'));

create policy p_exhibitor_settings_write_super
on public.event_exhibitor_data_settings
for all
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

create policy p_participant_consents_select_admin
on public.participant_event_consents
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

create policy p_participant_consents_write_super
on public.participant_event_consents
for all
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

-- Expositores nunca consultam diretamente a tabela que contém documentos e contatos.
drop policy if exists p_participants_select_authenticated on public.participants;
create policy p_participants_select_authenticated
on public.participants
for select
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'));

drop policy if exists p_registrations_select_authenticated on public.event_registrations;
create policy p_registrations_select_authenticated
on public.event_registrations
for select
to authenticated
using (public.current_app_role() in ('organizador', 'recepcao', 'super_adm'));

drop policy if exists p_entry_checkins_select_ops on public.entry_checkins;
create policy p_entry_checkins_select_ops
on public.entry_checkins
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao'));

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
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = stand_checkins.event_exhibitor_id
        and user_link.user_id = auth.uid()
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
      join public.exhibitor_users user_link
        on user_link.exhibitor_company_id = event_link.exhibitor_company_id
      where event_link.id = stand_checkins.event_exhibitor_id
        and user_link.user_id = auth.uid()
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

drop policy if exists p_exhibitor_companies_select_ops on public.exhibitor_companies;
create policy p_exhibitor_companies_select_ops
on public.exhibitor_companies
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or (
    public.current_app_role() = 'expositor'
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = exhibitor_companies.id
        and user_link.user_id = auth.uid()
    )
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
    and exists (
      select 1
      from public.exhibitor_users user_link
      where user_link.exhibitor_company_id = event_exhibitors.exhibitor_company_id
        and user_link.user_id = auth.uid()
    )
  )
);

drop policy if exists p_exhibitor_users_select_ops on public.exhibitor_users;
create policy p_exhibitor_users_select_ops
on public.exhibitor_users
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'recepcao')
  or (public.current_app_role() = 'expositor' and user_id = auth.uid())
);
