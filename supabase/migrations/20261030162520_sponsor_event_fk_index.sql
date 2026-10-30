-- Índice dedicado à chave estrangeira event_id.
-- O índice composto anterior começa por sponsor_id e não cobre esta FK isoladamente.

create index if not exists idx_sponsor_participant_records_event_id
  on public.sponsor_participant_records (event_id);

