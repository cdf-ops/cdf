-- Banner de patrocinadores exibido no rodapé do telão de sorteios.

alter table public.events
  add column if not exists raffle_sponsor_banner_path text null;
