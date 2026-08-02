-- Kirozeth AI — Fase 7 — Histórico auditável de aprovação de posts
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão: auth.uid() IS NOT NULL.

-- =========================================================
-- content_calendar_history — registro de cada mudança de status de content_calendar
-- =========================================================
create table if not exists public.content_calendar_history (
  id uuid primary key default gen_random_uuid(),
  content_calendar_id uuid not null references public.content_calendar (id) on delete cascade,
  status_anterior text check (
    status_anterior in ('pendente_geracao', 'sugerido', 'aprovado', 'rejeitado', 'ajustado')
  ),
  status_novo text not null check (
    status_novo in ('pendente_geracao', 'sugerido', 'aprovado', 'rejeitado', 'ajustado')
  ),
  texto_no_momento text,
  origem text not null default 'chat',
  created_at timestamptz not null default now()
);

comment on table public.content_calendar_history is
  'Histórico auditável de cada mudança de status de content_calendar: quem aprovou/ajustou/rejeitou '
  'o quê, quando, e qual foi o texto exato (sugestao_texto) naquele instante. Tabela de log — só '
  'insert, nunca update (sem updated_at/trigger).';

comment on column public.content_calendar_history.status_anterior is
  'NULL quando a linha de content_calendar acabou de ser criada com este status (ex.: post avulso '
  'criado direto como "sugerido", sem status anterior).';

comment on column public.content_calendar_history.texto_no_momento is
  'Snapshot de content_calendar.sugestao_texto no instante exato desta mudança de status — '
  'preserva o texto mesmo que sugestao_texto seja sobrescrito depois (ex.: por um ajuste seguinte).';

comment on column public.content_calendar_history.origem is
  'De onde veio esta mudança de status (ex.: "chat" — hoje a única origem existente). Sem check '
  'constraint restringindo os valores de propósito: campo deixado pronto pra fontes futuras '
  '(ex.: uma tela de aprovação direta, API externa) sem precisar de migration nova.';

create index if not exists idx_content_calendar_history_content_calendar_id
  on public.content_calendar_history (content_calendar_id, created_at);

alter table public.content_calendar_history enable row level security;

create policy "authenticated_full_access" on public.content_calendar_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Sem Realtime nesta tabela (é histórico, não precisa de UI ao vivo reagindo a ela).
