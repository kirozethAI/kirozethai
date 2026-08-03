-- Kirozeth AI — Fase 14 — Configuração de design editável (sem redeploy)
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão do
-- resto do projeto: auth.uid() is not null.

-- =========================================================
-- design_config — chave/valor global (NÃO é por cliente — identidade
-- visual por cliente já existe em client_dna, Fase 4, e continua separada)
-- =========================================================
create table if not exists public.design_config (
  chave text primary key,
  valor jsonb not null,
  descricao text not null,
  updated_at timestamptz not null default now()
);

comment on table public.design_config is
  'Configuração GLOBAL de design dos templates de imagem (Fase 14) — '
  'faixas de fonte, cores de fallback, parâmetros de gradiente/vinheta '
  '(Fase 13). Editável via tela /configuracoes/design, sem precisar de '
  'novo deploy. Diferente de client_dna: aqui é a regra que vale pra '
  'TODOS os clientes sem identidade visual própria, ou a base que toda '
  'geração usa (ex.: faixas de fonte valem pra qualquer cliente).';

comment on column public.design_config.valor is
  'jsonb — pode ser um número simples, uma string (cor hex), ou um array '
  'estruturado (ex.: font_size_scale). Ver src/lib/render/templates/shared.ts '
  '(DesignConfig) pro shape esperado de cada chave.';

-- Reaproveita a função set_updated_at() já criada na migration da Fase 1.
drop trigger if exists trg_design_config_updated_at on public.design_config;
create trigger trg_design_config_updated_at
  before update on public.design_config
  for each row
  execute function public.set_updated_at();

alter table public.design_config enable row level security;

create policy "authenticated_full_access" on public.design_config
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Seed: os valores EXATOS validados na Fase 13 (diagnóstico visual +
-- consulta aos skills de design) — a transição pra configuração no banco
-- não perde o resultado da Fase 13, só passa a permitir editar sem
-- redeploy. Ver src/lib/render/templates/shared.ts (DEFAULT_DESIGN_CONFIG)
-- pro fallback hardcoded que cobre qualquer falha em ler esta tabela.
insert into public.design_config (chave, valor, descricao) values
  (
    'font_size_scale',
    '[{"maxChars":80,"size":70},{"maxChars":150,"size":58},{"maxChars":250,"size":46},{"maxChars":400,"size":36},{"maxChars":null,"size":28}]'::jsonb,
    'Tamanho de fonte (px) por faixa de tamanho do texto (nº de caracteres). Faixas percorridas em ordem; a última (maxChars null) cobre qualquer texto acima da faixa anterior. Usado por todos os templates de post + Story + Carrossel.'
  ),
  (
    'gradiente_angulo',
    '150'::jsonb,
    'Ângulo (graus) do gradiente linear de fundo quando o cliente tem cor de marca configurada (clássico, cartão, story, carrossel).'
  ),
  (
    'gradiente_brilho_opacidade',
    '40'::jsonb,
    'Intensidade (0-100) do brilho de luz no canto superior esquerdo do fundo gradiente de marca (Fase 13).'
  ),
  (
    'gradiente_vinheta_opacidade',
    '33'::jsonb,
    'Intensidade (0-100) da vinheta escura no canto inferior direito do fundo gradiente de marca — dá profundidade/contraste (Fase 13, "LILA RULE" do skill design-taste-frontend).'
  ),
  (
    'fundo_fallback_cor1',
    '"#1f2937"'::jsonb,
    'Primeira cor do gradiente de fundo usado quando o cliente NÃO tem identidade visual configurada.'
  ),
  (
    'fundo_fallback_cor2',
    '"#111827"'::jsonb,
    'Segunda cor do gradiente de fundo usado quando o cliente NÃO tem identidade visual configurada.'
  ),
  (
    'texto_cor_fallback',
    '"#ffffff"'::jsonb,
    'Cor do texto quando não há cor de marca configurada (usada em cima do fundo de fallback).'
  ),
  (
    'texto_cor_limiar_luminancia',
    '150'::jsonb,
    'Limiar de luminância (0-255) usado pra decidir se o texto fica branco ou escuro em cima da cor de marca do cliente — valores mais altos tornam mais fácil o texto sair escuro.'
  ),
  (
    'acento_fallback_constelacao',
    '"#a855f7"'::jsonb,
    'Cor de destaque padrão do template Constelação quando o cliente não tem marca configurada (tag, anéis, linha divisória).'
  ),
  (
    'acento_fallback_estatistica',
    '"#22d3ee"'::jsonb,
    'Cor de destaque padrão do template Estatística quando o cliente não tem marca configurada (número em destaque, tag).'
  )
on conflict (chave) do nothing;
