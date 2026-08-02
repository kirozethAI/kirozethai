-- Kirozeth AI — Fase 4 (correção) — Recria a policy de RLS do bucket
-- 'client-logos'. Descoberto em produção: upload de logo pela tela de
-- identidade visual falhava com "new row violates row-level security
-- policy", mesmo a policy tendo sido criada (aparentemente) pela migration
-- 20260801030000_visual_dna_schema.sql — o bucket em si existe (criado
-- com sucesso), mas a policy de storage.objects não estava em vigor.
-- `drop policy if exists` torna essa migration segura de rodar de novo.

drop policy if exists "authenticated_full_access_client_logos" on storage.objects;

create policy "authenticated_full_access_client_logos"
  on storage.objects
  for all
  using (bucket_id = 'client-logos' and auth.uid() is not null)
  with check (bucket_id = 'client-logos' and auth.uid() is not null);
