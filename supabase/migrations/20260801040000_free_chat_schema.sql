-- Kirozeth AI — Fase 5 — Conversa livre estruturada (classificador de intenção)
-- Não altera nada das Fases 1-4 além de ampliar o check constraint de
-- content_calendar.tipo_evento pra aceitar 'avulso' (posts pedidos pelo
-- cliente via chat livre, fora do calendário automático da Fase 2).

alter table public.content_calendar
  drop constraint if exists content_calendar_tipo_evento_check;

alter table public.content_calendar
  add constraint content_calendar_tipo_evento_check
  check (
    tipo_evento in (
      'feriado_nacional',
      'aniversario_pessoal',
      'aniversario_empresa',
      'data_nicho',
      'avulso'
    )
  );

comment on column public.content_calendar.tipo_evento is
  'feriado_nacional/aniversario_pessoal/aniversario_empresa/data_nicho são criados '
  'pelo motor de calendário (Fase 2). avulso é criado a pedido do cliente via '
  'chat livre (Fase 5, ver src/lib/chat/handle-free-message.ts) — mesmo fluxo '
  'de aprovação/ajuste/rejeição e geração de imagem, sem estar ligado a uma '
  'data comemorativa específica.';
