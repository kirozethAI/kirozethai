-- Kirozeth AI — Fase 2 — Calendário comemorativo + sugestões de post (texto)
-- Não altera nada da Fase 1. RLS segue o mesmo padrão: auth.uid() IS NOT NULL.

-- =========================================================
-- special_dates — feriados nacionais + datas de nicho (referência, não por cliente)
-- =========================================================
create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('nacional', 'nicho')),
  mes smallint not null check (mes between 1 and 12),
  dia smallint not null check (dia between 1 and 31),
  segmento text,
  recorrente boolean not null default true,
  ano smallint,
  created_at timestamptz not null default now()
);

comment on table public.special_dates is
  'Feriados nacionais (sincronizados via API Nager.Date) e datas de nicho (seed manual). '
  'Datas fixas (recorrente=true) valem todo ano via mes/dia e `ano` fica null. '
  'Datas móveis (recorrente=false, ex.: Carnaval, Sexta-feira Santa) guardam em `ano` o ano '
  'da ocorrência sincronizada — só valem pra aquele ano específico.';

comment on column public.special_dates.segmento is
  'Segmento do cliente ao qual a data se aplica (ex.: "imobiliario"). NULL = aplica a qualquer segmento.';

create index if not exists idx_special_dates_mes_dia on public.special_dates (mes, dia);
create index if not exists idx_special_dates_segmento on public.special_dates (segmento);

alter table public.special_dates enable row level security;

create policy "authenticated_full_access" on public.special_dates
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Seed inicial: datas de nicho relevantes pro segmento imobiliário
-- (a Bound, cliente da agência, atua nesse segmento).
insert into public.special_dates (nome, tipo, mes, dia, segmento, recorrente) values
  ('Dia do Corretor de Imóveis', 'nicho', 8, 27, 'imobiliario', true),
  ('Dia do Cliente', 'nicho', 9, 15, 'imobiliario', true),
  ('Dia dos Namorados', 'nicho', 6, 12, null, true);

-- =========================================================
-- content_calendar — eventos identificados por cliente + sugestão de post
-- =========================================================
create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  data_evento date not null,
  tipo_evento text not null check (
    tipo_evento in ('feriado_nacional', 'aniversario_pessoal', 'aniversario_empresa', 'data_nicho')
  ),
  nome_evento text not null,
  sugestao_texto text,
  status text not null default 'pendente_geracao' check (
    status in ('pendente_geracao', 'sugerido', 'aprovado', 'rejeitado', 'ajustado')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_calendar is
  'Eventos de calendário detectados pra cada cliente (feriado, aniversário, data de nicho) '
  'e a sugestão de post gerada via Groq pra cada um, com status de aprovação.';

create index if not exists idx_content_calendar_client_id_status
  on public.content_calendar (client_id, status);

create index if not exists idx_content_calendar_data_evento
  on public.content_calendar (data_evento);

-- Reaproveita a função set_updated_at() já criada na migration da Fase 1.
drop trigger if exists trg_content_calendar_updated_at on public.content_calendar;
create trigger trg_content_calendar_updated_at
  before update on public.content_calendar
  for each row
  execute function public.set_updated_at();

alter table public.content_calendar enable row level security;

create policy "authenticated_full_access" on public.content_calendar
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Realtime — habilita replicação (útil pra uma futura tela de calendário;
-- a entrega da sugestão no chat já usa a tabela `messages`, que já é realtime)
-- =========================================================
alter publication supabase_realtime add table public.content_calendar;
