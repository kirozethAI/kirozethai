# Kirozeth AI — Fase 1 (Fundação)

Sistema de agência de marketing autônoma. Fase 1: banco de dados, memória
persistente por cliente (`client_dna`) e chat ao vivo. Sem geração de
imagem, integrações Meta/Google ou aprovação ainda — isso é escopo de fases
futuras.

Veja [PROGRESS.md](./PROGRESS.md) pro histórico de decisões e status atual.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Realtime) — projeto cloud gratuito, código roda local

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto Supabase

1. Crie um projeto gratuito em [app.supabase.com](https://app.supabase.com).
2. Em **Project Settings > API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Copie `.env.local.example` para `.env.local` (se ainda não existir) e
   preencha os três valores. **Nunca commite o `.env.local`.**

### 3. Rodar a migration

No **SQL Editor** do painel Supabase, cole e rode o conteúdo de
[`supabase/migrations/20260801000000_init_schema.sql`](./supabase/migrations/20260801000000_init_schema.sql).

Isso cria as tabelas `clients`, `client_dna`, `conversations`, `messages`,
`questions_pending`, os triggers (criação automática de `client_dna` +
`conversation` ao inserir um cliente), as políticas de RLS e habilita
Realtime em `messages` e `questions_pending`.

### 4. Criar seu usuário

Este é um sistema single-tenant (1 usuário). Em **Authentication > Users >
Add user**, crie seu usuário com e-mail e senha — é com essas credenciais
que você vai logar no app em `/login`.

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000), faça login, cadastre
um cliente em **Novo cliente** e converse no chat — as perguntas do motor de
perguntas (`src/lib/questions-catalog.ts`) vão aparecer automaticamente, uma
de cada vez, e suas respostas atualizam o `client_dna` do cliente.

## Estrutura

- `src/lib/supabase/` — clients Supabase (browser, server, middleware) e tipos do banco
- `src/lib/questions-catalog.ts` — catálogo fixo de perguntas por campo de `client_dna`
- `src/lib/questions-engine.ts` — gera as perguntas pendentes ao cadastrar um cliente novo
- `src/app/actions.ts` — server actions (criar cliente, enviar mensagem no chat)
- `src/app/clientes/` — páginas de cadastro e chat por cliente
- `supabase/migrations/` — schema SQL
