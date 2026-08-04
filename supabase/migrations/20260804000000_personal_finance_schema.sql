-- Kirozeth AI — Fase 19 — Controle financeiro PESSOAL do usuário
-- Módulo 100% isolado: nenhuma referência a clients, invoices, ad_spend
-- nem a nenhuma outra tabela existente. É sobre o dinheiro do PRÓPRIO
-- usuário da agência, não sobre os clientes dela. RLS segue o mesmo
-- padrão do resto do projeto: auth.uid() is not null (single-tenant).

-- =========================================================
-- personal_categories — categorias de receita/despesa pessoal
-- =========================================================
create table if not exists public.personal_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  cor text not null,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.personal_categories is
  'Categorias do financeiro PESSOAL do usuário (Fase 19) — sem nenhuma '
  'relação com clientes da agência. `padrao` = true nas categorias '
  'pré-definidas (seed desta migration); false nas criadas pelo usuário '
  'pela UI. `cor` é um hex (#rrggbb) usado só pra exibição visual. '
  'Unicidade de nome+tipo é aplicada em código (Server Action), não por '
  'constraint — mesmo padrão do resto do projeto.';

alter table public.personal_categories enable row level security;

create policy "authenticated_full_access" on public.personal_categories
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- personal_transactions — lançamentos (receitas e despesas)
-- =========================================================
create table if not exists public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.personal_categories (id),
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(12, 2) not null,
  data date not null,
  recorrente boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.personal_transactions is
  'Lançamentos do financeiro PESSOAL do usuário (Fase 19). `recorrente` '
  'é um MARCADOR VISUAL (lançamento que se repete todo mês, ex.: aluguel, '
  'salário) — NÃO há automação replicando pro mês seguinte (decisão '
  'documentada no PROGRESS.md, Fase 19). `tipo` sempre bate com o tipo da '
  'categoria (validado em código na Server Action).';

create index if not exists idx_personal_transactions_data
  on public.personal_transactions (data);

create index if not exists idx_personal_transactions_categoria
  on public.personal_transactions (categoria_id);

alter table public.personal_transactions enable row level security;

create policy "authenticated_full_access" on public.personal_transactions
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Seed — categorias comuns pré-definidas (padrao = true)
-- "Investimentos" existe nos 2 tipos de propósito: como despesa é um
-- aporte (dinheiro saindo pro investimento), como receita é um
-- rendimento/resgate (dinheiro entrando). "Outros" também existe nos 2.
-- =========================================================
insert into public.personal_categories (nome, tipo, cor, padrao) values
  ('Moradia',            'despesa', '#f97316', true),
  ('Alimentação',        'despesa', '#22c55e', true),
  ('Transporte',         'despesa', '#3b82f6', true),
  ('Lazer',              'despesa', '#a855f7', true),
  ('Investimentos',      'despesa', '#0ea5e9', true),
  ('Outros',             'despesa', '#6b7280', true),
  ('Salário/Pró-labore', 'receita', '#16a34a', true),
  ('Investimentos',      'receita', '#0891b2', true),
  ('Outros',             'receita', '#9ca3af', true);
