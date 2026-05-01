-- Certificate visual configuration and private event assets

alter table public.events
  add column if not exists event_logo_path text null;

create table if not exists public.event_certificate_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  background_path text null,
  sponsor_image_path text null,
  layout jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_event_certificate_settings_updated_at on public.event_certificate_settings;
create trigger trg_event_certificate_settings_updated_at
before update on public.event_certificate_settings
for each row execute function public.set_updated_at();

alter table public.event_certificate_settings enable row level security;

drop policy if exists p_event_certificate_settings_select_org_super on public.event_certificate_settings;
create policy p_event_certificate_settings_select_org_super
on public.event_certificate_settings
for select
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'));

drop policy if exists p_event_certificate_settings_write_org_super on public.event_certificate_settings;
create policy p_event_certificate_settings_write_org_super
on public.event_certificate_settings
for all
to authenticated
using (public.current_app_role() in ('super_adm', 'organizador'))
with check (public.current_app_role() in ('super_adm', 'organizador'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-assets',
  'event-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
