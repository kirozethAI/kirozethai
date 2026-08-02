-- Kirozeth AI — Fase 4 — Identidade visual do cliente (cor + logo)
-- Não altera nada das Fases 1-3. RLS segue o mesmo padrão: auth.uid() IS NOT NULL.

-- =========================================================
-- client_dna — campos novos de identidade visual
-- =========================================================
alter table public.client_dna
  add column if not exists cor_primaria text,
  add column if not exists cor_secundaria text,
  add column if not exists logo_url text;

comment on column public.client_dna.cor_primaria is
  'Cor primária da marca, formato hex "#rrggbb" (input type=color do HTML sempre gera esse formato). '
  'NULL = identidade visual não configurada, template de imagem usa o fallback genérico da Fase 3.';
comment on column public.client_dna.cor_secundaria is
  'Cor secundária da marca, formato hex "#rrggbb". NULL = identidade visual não configurada.';
comment on column public.client_dna.logo_url is
  'Path do arquivo de logo no bucket "client-logos" do Supabase Storage '
  '(ex.: "<client_id>.png"). NULL = sem logo. URL pública montada em código '
  '(ver src/lib/render/upload-logo.ts), não guardada aqui.';

-- =========================================================
-- Storage — bucket público pros logos dos clientes
-- =========================================================
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

create policy "authenticated_full_access_client_logos"
  on storage.objects
  for all
  using (bucket_id = 'client-logos' and auth.uid() is not null)
  with check (bucket_id = 'client-logos' and auth.uid() is not null);
