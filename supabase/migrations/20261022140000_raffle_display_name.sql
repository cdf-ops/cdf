alter table public.events
  add column if not exists raffle_display_name text not null default 'Circuito dos Instaladores';

alter table public.events
  drop constraint if exists events_raffle_display_name_length;

alter table public.events
  add constraint events_raffle_display_name_length
  check (char_length(trim(raffle_display_name)) between 1 and 80);
