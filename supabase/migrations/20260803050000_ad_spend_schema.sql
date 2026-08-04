-- Kirozeth AI — Fase 18 — Controle de gastos com mídia paga (Meta Ads)
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão do
-- resto do projeto: auth.uid() is not null.
--
-- Google Ads fica de fora desta fase — `plataforma` já é genérico
-- ('meta' | 'google') pra a extensão futura seguir o mesmo schema, sem
-- migration nova.

-- =========================================================
-- ad_accounts — conexão OAuth com a plataforma de anúncio, por cliente
-- =========================================================
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  plataforma text not null check (plataforma in ('meta', 'google')),
  meta_ad_account_id text,
  access_token text,
  token_expira_em timestamptz,
  conectado_em timestamptz,
  status text not null default 'desconectado' check (status in ('conectado', 'desconectado', 'erro')),
  ultimo_erro text,
  unique (client_id, plataforma)
);

comment on table public.ad_accounts is
  'Conexão OAuth com a plataforma de anúncio (Fase 18 — só "meta" '
  'implementado, "google" é extensão futura com o mesmo schema). '
  '1 linha por cliente+plataforma (constraint unique) — reconectar '
  'substitui a conexão anterior via upsert, não duplica.';

comment on column public.ad_accounts.access_token is
  'CRIPTOGRAFADO (AES-256-GCM, ver src/lib/security/encryption.ts) antes '
  'de gravar — é o primeiro segredo de terceiro que este projeto guarda '
  'no Postgres (todos os outros, Groq/Supabase/Asaas, ficam só em env '
  'var). Nunca ler esta coluna sem passar por decrypt().';

comment on column public.ad_accounts.ultimo_erro is
  'Mensagem do último erro da Graph API (ex.: token expirado/inválido) '
  '— não pedido explicitamente no escopo, adicionado porque status '
  '"erro" sozinho não é acionável: sem saber O QUE deu errado, o único '
  'jeito de descobrir seria reconectar às cegas.';

alter table public.ad_accounts enable row level security;

create policy "authenticated_full_access" on public.ad_accounts
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- ad_spend — gasto diário, via API (sincronização automática) ou manual
-- =========================================================
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ad_account_id uuid references public.ad_accounts (id) on delete set null,
  data date not null,
  valor numeric(12, 2) not null,
  origem text not null check (origem in ('api', 'manual')),
  criado_em timestamptz not null default now()
);

comment on table public.ad_spend is
  'Gasto diário com mídia paga, por cliente (Fase 18). origem "api" vem '
  'da sincronização automática (cron, uma linha por client_id+data, '
  'nunca duplicada — ver sync-spend.ts); origem "manual" é lançada pelo '
  'usuário, e PODE coexistir com uma linha "api" do mesmo dia (o usuário '
  'pode complementar/corrigir mesmo com conexão ativa — dedup só se '
  'aplica dentro da própria origem "api", não entre origens).';

create index if not exists idx_ad_spend_client_id_data
  on public.ad_spend (client_id, data);

alter table public.ad_spend enable row level security;

create policy "authenticated_full_access" on public.ad_spend
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
