-- Kirozeth AI — Fase 1 — Schema inicial
-- Modelo de acesso: single-tenant, 1 usuário autenticado via Supabase Auth.
-- RLS em todas as tabelas exige apenas auth.uid() IS NOT NULL.

create extension if not exists "pgcrypto";

-- =========================================================
-- clients
-- =========================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  segmento text,
  aniversario_pessoal date,
  aniversario_empresa date,
  created_at timestamptz not null default now()
);

comment on table public.clients is 'Clientes da agência.';

-- =========================================================
-- client_dna — memória persistente por cliente
-- =========================================================
create table if not exists public.client_dna (
  client_id uuid primary key references public.clients (id) on delete cascade,
  tom_de_voz text,
  publico_alvo text,
  produtos text,
  ticket_medio numeric,
  margem numeric,
  cidade text,
  concorrentes jsonb not null default '[]'::jsonb,
  metas text,
  sazonalidade jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.client_dna is 'Memória/DNA do cliente — preenchida ao longo do tempo pelo motor de perguntas e pelo chat.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_dna_updated_at on public.client_dna;
create trigger trg_client_dna_updated_at
  before update on public.client_dna
  for each row
  execute function public.set_updated_at();

-- =========================================================
-- conversations
-- =========================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'ativa' check (status in ('ativa', 'arquivada')),
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_client_id on public.conversations (client_id);

-- =========================================================
-- messages
-- =========================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  remetente text not null check (remetente in ('ia', 'usuario')),
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id_created_at
  on public.messages (conversation_id, created_at);

-- =========================================================
-- questions_pending
-- =========================================================
create table if not exists public.questions_pending (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  pergunta text not null,
  contexto text,
  campo_relacionado text,
  respondida boolean not null default false,
  resposta text,
  created_at timestamptz not null default now()
);

create index if not exists idx_questions_pending_client_id_respondida
  on public.questions_pending (client_id, respondida);

-- =========================================================
-- Trigger: ao criar um client, cria automaticamente
-- um client_dna vazio e uma conversation ativa.
-- =========================================================
create or replace function public.handle_new_client()
returns trigger
language plpgsql
as $$
begin
  insert into public.client_dna (client_id) values (new.id);
  insert into public.conversations (client_id, status) values (new.id, 'ativa');
  return new;
end;
$$;

drop trigger if exists trg_handle_new_client on public.clients;
create trigger trg_handle_new_client
  after insert on public.clients
  for each row
  execute function public.handle_new_client();

-- =========================================================
-- RLS — single-tenant: qualquer usuário autenticado tem acesso total.
-- =========================================================
alter table public.clients enable row level security;
alter table public.client_dna enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.questions_pending enable row level security;

create policy "authenticated_full_access" on public.clients
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.client_dna
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.conversations
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.messages
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated_full_access" on public.questions_pending
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Realtime — habilita replicação para chat ao vivo
-- =========================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.questions_pending;
