-- Allow multiple raffle rounds per event day.

drop index if exists public.uq_raffles_active_day;

create index if not exists idx_raffles_active_day_executed
  on public.raffles (event_day_id, executed_at desc)
  where deleted_at is null;
