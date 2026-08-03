-- Kirozeth AI — Fase 16 — Módulo financeiro (faturamento, sem pagamento real)
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão do
-- resto do projeto: auth.uid() is not null.
--
-- Sem integração de pagamento real nesta fase (isso é a Fase 17) — só
-- registro de cobrança, controle de status manual/automático por data, e
-- fatura em PDF pra envio manual.

-- =========================================================
-- client_billing — configuração de cobrança recorrente por cliente
-- =========================================================
create table if not exists public.client_billing (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tipo_cobranca text not null check (tipo_cobranca in ('fixa', 'variavel')),
  valor_fixo numeric(12, 2),
  dia_vencimento smallint check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint client_billing_fixa_completa check (
    tipo_cobranca <> 'fixa' or (valor_fixo is not null and dia_vencimento is not null)
  )
);

comment on table public.client_billing is
  'Configuração de cobrança recorrente por cliente (Fase 16). tipo_cobranca '
  '"fixa" gera fatura automática todo mês (ver generate-monthly-invoices.ts, '
  'chamado pelo cron diário); "variavel" é só um marcador informativo — '
  'faturas de valor variável são criadas avulsas (ver invoices), sem exigir '
  'uma linha aqui. Um cliente tem no máximo 1 linha ativa nesta tabela na '
  'prática (aplicado em código via upsert, não por constraint de unicidade '
  '— ver Decisões Tomadas no PROGRESS.md).';

-- `atualizado_em` NÃO usa o trigger set_updated_at() (Fase 1) — mesmo
-- padrão da Fase 15 (document_templates.atualizado_em): essa função grava
-- especificamente em `new.updated_at`, nome de coluna diferente. Setado
-- explicitamente pela Server Action de configuração.

create index if not exists idx_client_billing_client_id
  on public.client_billing (client_id);

alter table public.client_billing enable row level security;

create policy "authenticated_full_access" on public.client_billing
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- invoices — faturas (geradas automaticamente ou avulsas)
-- =========================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  client_billing_id uuid references public.client_billing (id) on delete set null,
  descricao text not null,
  valor numeric(12, 2) not null,
  data_vencimento date not null,
  status text not null default 'pendente' check (
    status in ('pendente', 'pago', 'atrasado', 'cancelado')
  ),
  data_pagamento timestamptz,
  criado_em timestamptz not null default now()
);

comment on table public.invoices is
  'Faturas por cliente (Fase 16) — geradas automaticamente a partir de '
  'client_billing (tipo "fixa", client_billing_id preenchido) ou criadas '
  'avulsas (valor variável, client_billing_id NULL). status "atrasado" é '
  'setado pelo cron diário quando data_vencimento passa com status ainda '
  '"pendente" (ver mark-overdue-invoices.ts); status "pago" só é setado '
  'manualmente nesta fase (sem integração de pagamento real — Fase 17).';

create index if not exists idx_invoices_client_id_status
  on public.invoices (client_id, status);

create index if not exists idx_invoices_data_vencimento
  on public.invoices (data_vencimento);

alter table public.invoices enable row level security;

create policy "authenticated_full_access" on public.invoices
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
