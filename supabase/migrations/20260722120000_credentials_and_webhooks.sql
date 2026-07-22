-- Participant credentials, configurable badge layouts and optional outbound webhooks.

alter table public.badges
  alter column generated_by drop not null,
  add column if not exists download_slug text null,
  add column if not exists print_count integer not null default 0 check (print_count >= 0),
  add column if not exists last_printed_at timestamptz null,
  add column if not exists last_printed_by uuid null references auth.users (id);

update public.badges
set download_slug = encode(extensions.gen_random_bytes(16), 'hex')
where download_slug is null;

alter table public.badges
  alter column download_slug set not null;

create unique index if not exists uq_badges_download_slug
  on public.badges (download_slug);

create table if not exists public.event_badge_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  city_label text null,
  primary_color text not null default '#09050a',
  secondary_color text not null default '#d9dadd',
  institutional_text text null,
  schedule_text text null,
  social_url text null,
  facebook_label text null,
  instagram_label text null,
  youtube_label text null,
  certificate_url text null,
  updated_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_badge_settings_primary_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint event_badge_settings_secondary_color_check check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

drop trigger if exists trg_event_badge_settings_updated_at on public.event_badge_settings;
create trigger trg_event_badge_settings_updated_at
before update on public.event_badge_settings
for each row execute function public.set_updated_at();

alter table public.event_badge_settings enable row level security;

drop policy if exists p_event_badge_settings_select_org_super on public.event_badge_settings;
create policy p_event_badge_settings_select_org_super
on public.event_badge_settings
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_event_badge_settings_write_org_super on public.event_badge_settings;
create policy p_event_badge_settings_write_org_super
on public.event_badge_settings
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

create table if not exists public.webhook_settings (
  id uuid primary key default gen_random_uuid(),
  event_type text not null unique check (
    event_type in ('registration.completed', 'credential.generated', 'checkin.completed')
  ),
  webhook_url text not null,
  enabled boolean not null default false,
  signing_secret text null,
  updated_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_webhook_settings_updated_at on public.webhook_settings;
create trigger trg_webhook_settings_updated_at
before update on public.webhook_settings
for each row execute function public.set_updated_at();

alter table public.webhook_settings enable row level security;

drop policy if exists p_webhook_settings_super_only on public.webhook_settings;
create policy p_webhook_settings_super_only
on public.webhook_settings
for all
to authenticated
using (public.current_app_role() = 'super_adm')
with check (public.current_app_role() = 'super_adm');

insert into public.webhook_settings (event_type, webhook_url, enabled)
values
  ('registration.completed', 'https://example.invalid/webhooks/registration', false),
  ('credential.generated', 'https://example.invalid/webhooks/credential', false),
  ('checkin.completed', 'https://example.invalid/webhooks/checkin', false)
on conflict (event_type) do nothing;
