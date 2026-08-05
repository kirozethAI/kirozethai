-- Kirozeth AI — Fase 22 — NeuroScore (avaliação heurística de persuasão)
-- Não altera nada das fases anteriores. RLS segue o padrão do projeto:
-- auth.uid() is not null.
--
-- AVISO IMPORTANTE (documentado também no PROGRESS.md e em toda a UI): a
-- nota_geral e as dimensões avaliadas são uma ESTIMATIVA HEURÍSTICA de IA
-- (via visão computacional da Groq), não uma medição real de atenção nem
-- dado estatístico de nenhuma plataforma de rede social.

-- =========================================================
-- neuroscore_evaluations — resultado de cada avaliação (post gerado com
-- loop de qualidade, upload manual, ou landing page).
-- =========================================================
create table if not exists public.neuroscore_evaluations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  origem text not null check (origem in ('post_gerado', 'upload_manual', 'landing_page')),
  content_calendar_id uuid references public.content_calendar (id) on delete cascade,
  tentativa_numero int not null default 1,
  imagem_avaliada_url text not null,
  url_original text,
  nota_geral numeric(3, 1) not null,
  gancho_inicial text,
  gatilhos_desejo jsonb,
  fatores_retencao jsonb,
  fatores_algoritmo jsonb,
  pontos_fracos jsonb,
  sugestoes jsonb,
  probabilidade_conversao_estimada text,
  criado_em timestamptz not null default now()
);

comment on table public.neuroscore_evaluations is
  'Avaliações NeuroScore (Fase 22) — ESTIMATIVA HEURÍSTICA de IA via '
  'visão computacional (Groq vision), não medição real de atenção nem '
  'dado estatístico de plataforma nenhuma. origem=''post_gerado'' vem do '
  'loop de qualidade na aprovação de um post (ver '
  'src/lib/neuroscore/generate-with-quality-loop.ts, content_calendar_id '
  'preenchido, tentativa_numero = qual tentativa venceu o loop, até 3); '
  'origem=''upload_manual''/''landing_page'' vêm da avaliação avulsa em '
  '/neuroscore (content_calendar_id NULL, tentativa_numero sempre 1, sem '
  'loop de regeneração — não há o que regenerar em conteúdo externo). '
  '`client_id` é opcional em qualquer origem (pode ficar NULL numa '
  'avaliação avulsa não associada a nenhum cliente cadastrado).';

comment on column public.neuroscore_evaluations.tentativa_numero is
  'Qual tentativa do loop de qualidade (1 a 3) produziu ESTA avaliação '
  'salva — não é uma contagem de quantas tentativas rodaram no total '
  '(só a vencedora é persistida; tentativas descartadas não geram linha '
  'aqui). Sempre 1 pra origem upload_manual/landing_page (sem loop).';

create index if not exists idx_neuroscore_evaluations_client_id
  on public.neuroscore_evaluations (client_id);

create index if not exists idx_neuroscore_evaluations_content_calendar_id
  on public.neuroscore_evaluations (content_calendar_id);

alter table public.neuroscore_evaluations enable row level security;

create policy "authenticated_full_access" on public.neuroscore_evaluations
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- =========================================================
-- Storage — bucket público pras imagens avaliadas AVULSAS (Etapa 5):
-- uploads manuais e screenshots de landing page. As tentativas do loop
-- de qualidade (Etapa 4, origem='post_gerado') continuam usando o
-- bucket "post-images" de sempre (mesmo ciclo de vida do post em si —
-- cada tentativa sobe pra um path <id>-neuroscore-tentativa-N.png
-- próprio, e a vencedora acaba sobrescrevendo o path definitivo
-- <id>.png via upsert, igual a qualquer regeneração). Bucket separado
-- pra Etapa 5 porque é conteúdo de avaliação avulsa (upload externo ou
-- screenshot de site de terceiro), sem nenhuma relação com um post
-- gerado pelo sistema — mesmo raciocínio de "ciclo de vida diferente"
-- já usado pra separar client-logos de post-images na Fase 4.
-- =========================================================
insert into storage.buckets (id, name, public)
values ('neuroscore-uploads', 'neuroscore-uploads', true)
on conflict (id) do nothing;

create policy "authenticated_full_access_neuroscore_uploads"
  on storage.objects
  for all
  using (bucket_id = 'neuroscore-uploads' and auth.uid() is not null)
  with check (bucket_id = 'neuroscore-uploads' and auth.uid() is not null);
