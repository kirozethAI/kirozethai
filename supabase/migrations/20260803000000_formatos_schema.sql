-- Kirozeth AI — Fase 12 — Formatos adicionais de conteúdo (Story + Carrossel)
-- Não altera nada das fases anteriores. RLS segue a mesma policy já existente
-- em content_calendar (auth.uid() is not null) — colunas novas na mesma
-- tabela não precisam de policy própria.

alter table public.content_calendar
  add column if not exists story_imagem_gerada text,
  add column if not exists story_imagem_gerada_em timestamptz,
  add column if not exists carrossel_slides jsonb,
  add column if not exists carrossel_gerado_em timestamptz;

comment on column public.content_calendar.story_imagem_gerada is
  'Path do PNG do formato Story (1080x1920) no bucket "post-images" '
  '(ex.: "<content_calendar.id>-story.png"). NULL até ser gerado. '
  'Independente de imagem_gerada (formato post quadrado, Fase 3) — os dois '
  'formatos coexistem pro mesmo evento, gerar um não substitui o outro '
  '(ver Decisões Tomadas da Fase 12: formato é opt-in via botão dedicado na '
  'UI, não escolhido automaticamente).';

comment on column public.content_calendar.carrossel_slides is
  'Array JSON ordenado de paths dos PNGs (1080x1080, um por slide) do '
  'formato Carrossel no bucket "post-images" '
  '(ex.: ["carrossel/<id>/slide-01.png", "carrossel/<id>/slide-02.png", ...]). '
  'NULL até ser gerado. O carrossel não é 1 arquivo único — cada slide é uma '
  'imagem separada, o número de slides varia (3 a 4, ver '
  'src/lib/groq/carousel-suggestion.ts).';

comment on column public.content_calendar.carrossel_gerado_em is
  'Timestamp da última geração do carrossel — usado como versão de '
  'cache-busting nas URLs públicas das imagens (mesmo padrão de '
  'imagem_gerada_em, ver Fase 11).';
