-- Índices de apoio para chaves estrangeiras do domínio de patrocinadores.
-- As tabelas ainda estão vazias nesta etapa, evitando impacto operacional.

create index if not exists idx_sponsors_created_by
  on public.sponsors (created_by)
  where created_by is not null;

create index if not exists idx_sponsors_updated_by
  on public.sponsors (updated_by)
  where updated_by is not null;

create index if not exists idx_sponsor_sessions_sponsor
  on public.sponsor_sessions (sponsor_id);

create index if not exists idx_sponsor_team_members_created_by
  on public.sponsor_team_members (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists idx_sponsor_team_members_updated_by
  on public.sponsor_team_members (updated_by_user_id)
  where updated_by_user_id is not null;

create index if not exists idx_sponsor_participant_records_event
  on public.sponsor_participant_records (event_id, captured_at desc);

create index if not exists idx_sponsor_participant_records_participant
  on public.sponsor_participant_records (participant_id);

create index if not exists idx_sponsor_participant_records_invalidated_by
  on public.sponsor_participant_records (invalidated_by)
  where invalidated_by is not null;

create index if not exists idx_event_sponsor_data_settings_updated_by
  on public.event_sponsor_data_settings (updated_by)
  where updated_by is not null;

create index if not exists idx_user_password_vault_updated_by
  on public.user_password_vault (updated_by)
  where updated_by is not null;

