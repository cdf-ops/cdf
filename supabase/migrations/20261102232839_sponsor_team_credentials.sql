-- Credencial estável da equipe permanente do patrocinador por evento.
-- Esta tabela não representa vínculo comercial entre patrocinador e evento;
-- ela existe apenas para manter o QR Code impresso válido e idempotente.

create table if not exists public.sponsor_team_credentials (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  team_member_id uuid not null references public.sponsor_team_members (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  qr_slug text not null,
  created_at timestamptz not null default now(),
  constraint sponsor_team_credentials_qr_slug_length check (char_length(qr_slug) between 16 and 128),
  constraint sponsor_team_credentials_member_event_unique unique (team_member_id, event_id),
  constraint sponsor_team_credentials_qr_slug_unique unique (qr_slug)
);

create index if not exists idx_sponsor_team_credentials_sponsor_event
  on public.sponsor_team_credentials (sponsor_id, event_id);

create index if not exists idx_sponsor_team_credentials_event
  on public.sponsor_team_credentials (event_id);

alter table public.sponsor_team_credentials enable row level security;

-- Sem políticas para anon/authenticated: toda leitura e escrita passa pelas
-- rotas de servidor que validam a sessão administrativa ou do patrocinador.
