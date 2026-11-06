alter table public.sponsor_entry_checkins
  alter column sponsor_credential_id drop not null,
  add column if not exists sponsor_team_credential_id uuid null
    references public.sponsor_team_credentials (id) on delete cascade;

alter table public.sponsor_entry_checkins
  add constraint sponsor_entry_checkins_exactly_one_credential
  check (num_nonnulls(sponsor_credential_id, sponsor_team_credential_id) = 1);

create unique index if not exists uq_sponsor_team_entry_checkins_active
  on public.sponsor_entry_checkins (sponsor_team_credential_id, event_day_id)
  where deleted_at is null and sponsor_team_credential_id is not null;
