-- Kirozeth AI — Fase 3 Bloco B — Geração visual (HTML + Puppeteer)
-- Não altera nada da Fase 1/Fase 2. RLS segue o mesmo padrão: auth.uid() IS NOT NULL.

-- =========================================================
-- content_calendar — campos novos pra guardar a imagem gerada
-- =========================================================
alter table public.content_calendar
  add column if not exists imagem_gerada text,
  add column if not exists imagem_gerada_em timestamptz;

comment on column public.content_calendar.imagem_gerada is
  'Path do arquivo PNG gerado no bucket "post-images" do Supabase Storage '
  '(ex.: "<content_calendar.id>.png"). NULL até a imagem ser gerada. '
  'A URL pública é montada em código (ver src/lib/render/upload-image.ts), '
  'não é guardada aqui, pra não depender do domínio do projeto Supabase.';

-- =========================================================
-- Storage — bucket público pras imagens de post geradas via Puppeteer
-- =========================================================
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Bucket público: qualquer um com a URL consegue baixar a imagem (é
-- conteúdo pra postar nas redes sociais do cliente, não é sensível).
-- Escrever (upload/overwrite) continua exigindo usuário autenticado, mesmo
-- padrão do resto do projeto.
create policy "authenticated_full_access_post_images"
  on storage.objects
  for all
  using (bucket_id = 'post-images' and auth.uid() is not null)
  with check (bucket_id = 'post-images' and auth.uid() is not null);
