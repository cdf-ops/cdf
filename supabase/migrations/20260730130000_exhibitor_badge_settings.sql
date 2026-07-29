-- Modelo independente da credencial visual da equipe expositora por evento.

create table if not exists public.event_exhibitor_badge_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  city_label text null,
  primary_color text not null default '#09050a',
  secondary_color text not null default '#d9dadd',
  front_label text not null default 'EXPOSITOR',
  social_heading text not null default 'Acompanhe o Clube do Frio',
  company_heading text not null default 'EQUIPE EXPOSITORA',
  institutional_text text null,
  schedule_heading text not null default 'PROGRAMAÇÃO',
  schedule_text text null,
  social_url text null,
  facebook_label text null,
  instagram_label text null,
  youtube_label text null,
  show_job_title boolean not null default true,
  show_event_logo boolean not null default true,
  show_social_qr boolean not null default true,
  company_logo_size text not null default 'medium'
    check (company_logo_size in ('small', 'medium', 'large')),
  updated_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_exhibitor_badge_settings_primary_color_check
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint event_exhibitor_badge_settings_secondary_color_check
    check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

drop trigger if exists trg_event_exhibitor_badge_settings_updated_at
  on public.event_exhibitor_badge_settings;
create trigger trg_event_exhibitor_badge_settings_updated_at
before update on public.event_exhibitor_badge_settings
for each row execute function public.set_updated_at();

alter table public.event_exhibitor_badge_settings enable row level security;

create policy p_event_exhibitor_badge_settings_select
on public.event_exhibitor_badge_settings
for select
to authenticated
using (
  public.current_app_role() in ('super_adm', 'organizador', 'expositor')
);

create policy p_event_exhibitor_badge_settings_write
on public.event_exhibitor_badge_settings
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));
