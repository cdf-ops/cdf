-- Phase D - raffle/certificate/audit hardening

create unique index if not exists uq_certificates_day_participant
  on public.certificates (event_day_id, participant_id);

create unique index if not exists uq_raffles_active_day
  on public.raffles (event_day_id)
  where deleted_at is null;

create index if not exists idx_audit_created_at
  on public.audit_logs (created_at desc);

create index if not exists idx_raffles_day_executed
  on public.raffles (event_day_id, executed_at desc)
  where deleted_at is null;

create index if not exists idx_raffle_winners_raffle
  on public.raffle_winners (raffle_id);

create index if not exists idx_certificates_day
  on public.certificates (event_day_id, issued_at desc);

alter table public.raffles enable row level security;
alter table public.raffle_winners enable row level security;
alter table public.certificates enable row level security;

drop policy if exists p_raffles_select_ops on public.raffles;
create policy p_raffles_select_ops
on public.raffles
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao'));

drop policy if exists p_raffles_write_org_super on public.raffles;
create policy p_raffles_write_org_super
on public.raffles
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_raffle_winners_select_ops on public.raffle_winners;
create policy p_raffle_winners_select_ops
on public.raffle_winners
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador', 'recepcao'));

drop policy if exists p_raffle_winners_write_org_super on public.raffle_winners;
create policy p_raffle_winners_write_org_super
on public.raffle_winners
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_certificates_select_ops on public.certificates;
create policy p_certificates_select_ops
on public.certificates
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_certificates_write_org_super on public.certificates;
create policy p_certificates_write_org_super
on public.certificates
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

