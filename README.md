# ProduEvent - Clube do Frio (Web)

Base do MVP construída com:
- Next.js (App Router)
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS v4

## Rodando localmente

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

2. Preencha as variáveis do Supabase em `.env.local`.
3. Instale dependências (se necessário):

```bash
npm install
```

4. Suba o projeto:

```bash
npm run dev
```

## Banco de dados (Supabase)

Migrations e seed ficam em:
- `supabase/migrations/20260409230000_init_mvp.sql`
- `supabase/migrations/20260409233000_phase_b_policies.sql`
- `supabase/migrations/20260410001000_phase_c_checkin.sql`
- `supabase/migrations/20260410003000_phase_d_finalize.sql`
- `supabase/seed.sql`

Fluxo sugerido:
1. Rodar migration no Supabase.
2. Criar usuários no Auth.
3. Rodar `seed.sql` para aplicar roles iniciais.

## Escopo já implementado (Plano A + B + C + D)

- Setup técnico inicial.
- Auth com e-mail/senha.
- RBAC inicial (`super_adm`, `organizador`, `recepcao`, `expositor`).
- Tela de Login.
- Tela principal de Eventos (listagem, filtros, busca).
- Tela de Configuração de Evento (novo/edição + datas múltiplas).
- Inscrição pública por evento (`/inscricao/[eventId]`).
- Painel interno de Inscrições.
- Lista de Participantes com busca.
- Cadastro manual de participante (recepção/organizador/super-adm).
- Painel de Credenciais com geração sob demanda.
- Check-in Recepção (entrada do evento, incluindo fluxo "incluir no dia e fazer check-in").
- Lista do Dia (monitor consolidado de entrada + stand).
- Check-in Expositor (registro no stand, respeitando regra de check-in de entrada prévio).
- Sorteio por dia (controle + exclusão lógica por super-adm).
- Modo Telão de sorteio (`/telao/sorteio/[eventId]`).
- Certificados manuais (um a um).
- Relatórios de check-in e conversão por expositor.
- Auditoria com filtros e exportação CSV.
- Estrutura de banco do MVP com políticas iniciais de segurança.

## Próximas fases

- Ajustes de UX para aderência fina ao Stitch.
- Integração final de PDF real (credencial/certificado) + n8n em produção.
- Refinos de performance e observabilidade.

## Como testar localmente (fluxo rápido)

1. Rode as migrations no Supabase SQL Editor na ordem:
   - `20260409230000_init_mvp.sql`
   - `20260409233000_phase_b_policies.sql`
   - `20260410001000_phase_c_checkin.sql`
   - `20260410003000_phase_d_finalize.sql`
2. Crie 4 usuários no Supabase Auth:
   - `superadm@clubedofrio.com`
   - `organizador@clubedofrio.com`
   - `recepcao@clubedofrio.com`
   - `expositor@clubedofrio.com`
3. Rode o `supabase/seed.sql`.
4. Configure `.env.local` com:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
5. Execute `npm run dev`.
6. Testes principais:
   - Login como `organizador` e criar evento.
   - Cadastrar datas no evento.
   - Abrir `Inscrições` e copiar/abrir link público.
   - Fazer inscrição pública em 1+ dias.
   - Voltar em `Participantes` e conferir registro.
   - Gerar credencial em `Credenciais`.
   - Fazer check-in de entrada em `Check-in Recepção`.
   - Validar monitor em `Lista do Dia`.

### Preparação para testar Check-in Expositor

Antes de testar como expositor, rode este SQL no Supabase (ajuste os e-mails se necessário):

```sql
insert into public.exhibitor_companies (name)
values ('Expositor Teste')
on conflict do nothing;

insert into public.event_exhibitors (event_id, exhibitor_company_id, stand_name)
select
  e.id,
  c.id,
  'Stand 01'
from public.events e
cross join public.exhibitor_companies c
where e.name = 'Evento Teste 2026'
  and c.name = 'Expositor Teste'
on conflict (event_id, exhibitor_company_id) do nothing;

insert into public.exhibitor_users (user_id, exhibitor_company_id)
select
  u.id,
  c.id
from auth.users u
cross join public.exhibitor_companies c
where u.email = 'expositor@clubedofrio.com.br'
  and c.name = 'Expositor Teste'
on conflict (user_id, exhibitor_company_id) do nothing;
```

Depois:
1. Fazer login como expositor.
2. Abrir evento.
3. Ir em `Check-in Expositor`.
4. Buscar documento de quem já passou no check-in de entrada.
5. Registrar visita no stand.

### Testes Fase D (Sorteio, Certificado, Relatório, Auditoria)

1. Como organizador, acesse `Sorteio`.
2. Selecione o dia e execute sorteio com 1 prêmio.
3. Abra `Abrir Telão` para validar exibição dos ganhadores.
4. Como super-adm, valide exclusão lógica do sorteio.
5. Acesse `Certificados`, selecione o dia e emita manualmente para um participante.
6. Acesse `Relatórios` e valide:
   - check-ins por dia
   - totais do evento
   - conversão por expositor no dia
7. Como super-adm, acesse `Auditoria`, filtre por ação e exporte CSV.

## Diretriz de UI

Durante a evolução das telas, o objetivo é manter a interface o mais próxima possível dos esboços enviados no Stitch, respeitando composição, hierarquia e linguagem visual.
