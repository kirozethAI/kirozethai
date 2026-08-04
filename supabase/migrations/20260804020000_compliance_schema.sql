-- Kirozeth AI — Fase 20 — Compliance publicitário pra nichos regulados
-- (saúde e direito). É um ALERTA HEURÍSTICO de apoio à decisão, nunca um
-- bloqueio nem uma certificação de conformidade — as regras dos conselhos
-- profissionais (CFM/CFO/OAB) mudam com frequência e têm nuances reais.
-- RLS segue o padrão do projeto: auth.uid() is not null.

-- =========================================================
-- compliance_rules — regras de publicidade por nicho regulado
-- =========================================================
create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  nicho text not null check (nicho in ('saude', 'direito')),
  regra text not null,
  gravidade text not null check (gravidade in ('alta', 'media', 'baixa')),
  fonte text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.compliance_rules is
  'Regras de publicidade de nichos regulados (Fase 20), usadas pela '
  'checagem heurística via Groq (src/lib/compliance/check-content.ts). '
  'AVISO: o seed traz regras GERAIS de referência, amplamente conhecidas '
  '— não é lista exaustiva nem validada juridicamente, e `fonte` é '
  'deliberadamente genérica (sem artigo/resolução específica, que muda '
  'com frequência). O usuário deve revisar/expandir com um profissional '
  'pela tela /juridico/compliance.';

alter table public.compliance_rules enable row level security;

create policy "authenticated_full_access" on public.compliance_rules
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- content_calendar.compliance_alertas — snapshot do resultado da
-- checagem feita quando o texto foi gerado/ajustado (Etapa 3/4).
-- null = texto nunca passou pela checagem (cliente fora de nicho
-- regulado, ou post anterior à Fase 20); [] = checado, sem alerta;
-- array com itens = alertas encontrados ({regra, gravidade, motivo}).
-- =========================================================
alter table public.content_calendar
  add column if not exists compliance_alertas jsonb;

comment on column public.content_calendar.compliance_alertas is
  'Fase 20 — resultado da checagem heurística de compliance no momento '
  'da geração/ajuste do texto. null = não checado (fora de nicho '
  'regulado); [] = checado sem alerta; [{regra, gravidade, motivo}] = '
  'alertas. Fica visível nos posts aprovados pra auditoria posterior.';

-- =========================================================
-- Seed — conjunto INICIAL de regras amplamente conhecidas e estáveis.
-- NÃO é lista exaustiva nem validada juridicamente; as fontes são
-- genéricas de propósito (citar artigo/resolução específica arriscaria
-- ficar desatualizado). Revisar/expandir com um profissional.
-- =========================================================
insert into public.compliance_rules (nicho, regra, gravidade, fonte) values
  ('saude', 'Não prometer resultado, cura ou sucesso garantido de tratamento ou procedimento', 'alta',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('saude', 'Não usar depoimento de paciente como prova de eficácia de tratamento', 'alta',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('saude', 'Não expor imagem de paciente (inclusive "antes e depois") sem consentimento claro', 'alta',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('saude', 'Não fazer comparação com outros profissionais ou estabelecimentos de saúde', 'media',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('saude', 'Não anunciar técnica ou tratamento como exclusivo, milagroso ou infalível', 'media',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('saude', 'Manter tom informativo/educativo, evitando apelo promocional agressivo (urgência artificial, sensacionalismo, promoções de procedimentos)', 'media',
   'Princípios gerais de publicidade em saúde (CFM/CFO)'),
  ('direito', 'Não captar clientes de forma direta ou mercantilista (oferta ativa de serviços, promoção, urgência comercial)', 'alta',
   'Princípios gerais de publicidade na advocacia (OAB)'),
  ('direito', 'Não garantir resultado de processo nem criar expectativa de êxito certo', 'alta',
   'Princípios gerais de publicidade na advocacia (OAB)'),
  ('direito', 'Não fazer comparação com outros advogados ou escritórios', 'media',
   'Princípios gerais de publicidade na advocacia (OAB)'),
  ('direito', 'Não divulgar valores de honorários como chamariz comercial', 'media',
   'Princípios gerais de publicidade na advocacia (OAB)'),
  ('direito', 'Manter tom institucional e informativo, sem sensacionalismo nem apelo emocional excessivo', 'media',
   'Princípios gerais de publicidade na advocacia (OAB)');
