-- Kirozeth AI — Fase 21 — Módulo de CRM (funil de vendas genérico)
-- Não altera nada das fases anteriores, exceto: (1) amplia o check
-- constraint de document_templates.tipo pra aceitar 'proposta_comercial'
-- (mesmo padrão da Fase 5 com content_calendar.tipo_evento); (2) adiciona
-- client_documents.lead_id (nullable) pra permitir gerar/guardar proposta
-- comercial pra um LEAD, que ainda não é um client — reaproveita 100% a
-- infraestrutura de documentos/PDF/Word da Fase 15, sem duplicar nada.
-- RLS segue o padrão do projeto: auth.uid() is not null.

-- =========================================================
-- pipeline_stages — estágios do funil, CONFIGURÁVEIS pelo usuário (não
-- hardcoded no código) — nome, ordem, cor e se é estágio terminal.
-- =========================================================
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null,
  cor text not null,
  tipo_final text not null default 'nenhum' check (tipo_final in ('nenhum', 'ganho', 'perdido')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.pipeline_stages is
  'Estágios do funil de vendas (Fase 21) — CONFIGURÁVEIS via '
  '/crm/estagios (nome, ordem, cor, tipo_final), não hardcoded no '
  'código. tipo_final=''ganho'' marca o(s) estágio(s) que, ao receber um '
  'lead, disparam a conversão automática em cliente (ver '
  'src/lib/crm/convert-lead.ts). Estágio nunca é excluído via UI, só '
  'desativado (`ativo=false`) — evita órfãos em leads.pipeline_stage_id.';

alter table public.pipeline_stages enable row level security;

create policy "authenticated_full_access" on public.pipeline_stages
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- leads — prospects no funil. client_id fica preenchido quando o lead é
-- convertido em cliente de verdade (Etapa 6).
-- =========================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  telefone text,
  email text,
  segmento text,
  origem text,
  pipeline_stage_id uuid not null references public.pipeline_stages (id),
  valor_estimado numeric(12, 2),
  client_id uuid references public.clients (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.leads is
  'Prospects do funil de vendas (Fase 21) — módulo isolado do resto do '
  'sistema, conectado só no ponto de conversão. `client_id` é NULL até '
  'o lead ser convertido (ver Etapa 6); depois disso, aponta pro cliente '
  'real criado a partir dele. `pipeline_stage_id` referencia '
  'pipeline_stages sem `on delete cascade`/`set null` — estágios não são '
  'excluídos via UI (só desativados), então não há necessidade de tratar '
  'esse caso.';

create index if not exists idx_leads_pipeline_stage_id
  on public.leads (pipeline_stage_id);

alter table public.leads enable row level security;

create policy "authenticated_full_access" on public.leads
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- lead_activities — histórico de interações (timeline), incluindo
-- mudança de estágio registrada automaticamente (Etapa 2).
-- =========================================================
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'ligacao', 'reuniao', 'email', 'mudanca_estagio')),
  descricao text not null,
  criado_em timestamptz not null default now()
);

comment on table public.lead_activities is
  'Timeline de interações de um lead (Fase 21) — mesmo espírito de '
  'content_calendar_history (Fase 7): log só-insert, nunca update. '
  '''mudanca_estagio'' é gravada automaticamente a cada movimentação no '
  'Kanban (ver moveLeadStageAction); os outros 4 tipos são lançados '
  'manualmente na ficha do lead.';

create index if not exists idx_lead_activities_lead_id
  on public.lead_activities (lead_id);

alter table public.lead_activities enable row level security;

create policy "authenticated_full_access" on public.lead_activities
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Reaproveitando document_templates/client_documents (Fase 15) pra
-- proposta comercial — amplia o tipo aceito e liga o documento a um
-- LEAD (que ainda não é cliente).
-- =========================================================
alter table public.document_templates
  drop constraint if exists document_templates_tipo_check;

alter table public.document_templates
  add constraint document_templates_tipo_check
  check (tipo in ('contrato', 'termos_uso', 'politica_privacidade', 'proposta_comercial'));

alter table public.client_documents
  add column if not exists lead_id uuid references public.leads (id) on delete cascade;

comment on column public.client_documents.lead_id is
  'Fase 21 — preenchido quando o documento é uma proposta comercial '
  'gerada pra um LEAD (client_id fica NULL nesse caso, mesmo padrão já '
  'usado pra documento do sistema). `on delete cascade` (não `set null`, '
  'diferente de document_template_id): é o mesmo padrão de `client_id` '
  'nesta tabela — o lead é o "dono" do documento, não a fonte/modelo.';

create index if not exists idx_client_documents_lead_id
  on public.client_documents (lead_id);

-- =========================================================
-- Seed — 6 estágios iniciais (editáveis/reordenáveis depois via
-- /crm/estagios) e 1 modelo-base de proposta comercial. TEXTO GENÉRICO
-- DE REFERÊNCIA (mesmo aviso da Fase 15) — ajuste ao seu negócio.
-- =========================================================
insert into public.pipeline_stages (nome, ordem, cor, tipo_final) values
  ('Novo Lead',            1, '#94a3b8', 'nenhum'),
  ('Contato Feito',        2, '#3b82f6', 'nenhum'),
  ('Proposta Enviada',     3, '#f59e0b', 'nenhum'),
  ('Negociação',           4, '#a855f7', 'nenhum'),
  ('Fechado - Ganho',      5, '#22c55e', 'ganho'),
  ('Fechado - Perdido',    6, '#ef4444', 'perdido');

insert into public.document_templates (tipo, nome, conteudo_html) values
(
  'proposta_comercial',
  'Proposta Comercial — Modelo Padrão',
  '<h1>Proposta Comercial</h1>
<p><strong>{{nome_empresa}}</strong> — {{data_atual}}</p>
<hr/>
<h2>Para</h2>
<p>{{nome_lead}}<br/>{{empresa_lead}}</p>
<h2>Sobre a {{nome_empresa}}</h2>
<p>Somos uma agência dedicada a ajudar negócios como o seu a crescer com presença digital consistente e estratégica. Esta proposta descreve o escopo, o investimento e as condições do serviço apresentado.</p>
<h2>Escopo do serviço</h2>
<p>{{servico}}</p>
<h2>Investimento</h2>
<p>{{valor}}</p>
<h2>Validade da proposta</h2>
<p>Esta proposta é válida por {{validade}} a partir da data de emissão.</p>
<h2>Próximos passos</h2>
<p>Para dar andamento, basta confirmar a aceitação por qualquer um dos nossos canais de contato. Ficamos à disposição para esclarecer dúvidas e ajustar o escopo conforme a necessidade.</p>
<hr/>
<p><em>{{nome_empresa}} — proposta gerada em {{data_atual}}.</em></p>'
);
