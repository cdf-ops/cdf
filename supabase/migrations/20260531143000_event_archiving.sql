-- Preserve event history while removing archived events from daily operation.

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check
  check (status in ('rascunho', 'ativo', 'encerrado', 'arquivado'));

alter table public.events
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references auth.users (id);

create index if not exists idx_events_status
  on public.events (status);
