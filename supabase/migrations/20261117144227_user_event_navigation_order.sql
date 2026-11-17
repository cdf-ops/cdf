alter table public.user_profiles
  add column if not exists event_navigation_order jsonb not null default '{}'::jsonb;

alter table public.user_profiles
  drop constraint if exists user_profiles_event_navigation_order_object;

alter table public.user_profiles
  add constraint user_profiles_event_navigation_order_object
  check (jsonb_typeof(event_navigation_order) = 'object');

comment on column public.user_profiles.event_navigation_order is
  'Ordem pessoal dos módulos dentro de cada seção fixa da navegação de eventos.';
