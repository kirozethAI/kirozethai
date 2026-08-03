-- Kirozeth AI — Fase 17 — Integração de pagamento real via Asaas
-- Não altera nada das fases anteriores. RLS segue o mesmo padrão do
-- resto do projeto: auth.uid() is not null.
--
-- ⚠️ SEMPRE Sandbox nesta fase (https://sandbox.asaas.com/api/v3) — nunca
-- produção do Asaas, mesmo que uma chave de produção fique disponível
-- depois. Ver src/lib/asaas/client.ts.

-- =========================================================
-- clients — cliente cadastrado no Asaas (1x, reaproveitado em toda
-- cobrança futura desse cliente)
-- =========================================================
alter table public.clients
  add column if not exists asaas_customer_id text;

comment on column public.clients.asaas_customer_id is
  'ID do customer no Asaas (Sandbox nesta fase — Fase 17), criado 1x via '
  'ensureAsaasCustomer() e reaproveitado em toda cobrança futura desse '
  'cliente. NULL até a 1ª cobrança real ser gerada pra ele.';

-- =========================================================
-- invoices — dados da cobrança real gerada no Asaas pra essa fatura
-- =========================================================
alter table public.invoices
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_customer_id text,
  add column if not exists forma_pagamento text check (forma_pagamento in ('boleto', 'pix', 'cartao')),
  add column if not exists link_pagamento text,
  add column if not exists boleto_url text;

comment on column public.invoices.asaas_payment_id is
  'ID do payment no Asaas (Sandbox nesta fase). NULL até "Gerar cobrança '
  'real" ser clicado pra essa fatura — até lá, a fatura só existe no '
  'Kirozeth (fluxo manual da Fase 16, continua funcionando sozinho).';

comment on column public.invoices.asaas_customer_id is
  'Cópia do asaas_customer_id usado NESTA cobrança específica, no momento '
  'em que ela foi criada — é um SNAPSHOT (mesmo espírito de '
  'client_documents.conteudo_final, Fase 15), independente do '
  'clients.asaas_customer_id "atual". Não deveriam divergir na prática '
  '(um cliente tem 1 só customer no Asaas), mas manter os dois evita que '
  'uma fatura antiga fique referenciando o customer errado numa hipótese '
  'rara de re-cadastro do cliente no Asaas.';

comment on column public.invoices.link_pagamento is
  'invoiceUrl retornado pelo Asaas — página hospedada por eles onde o '
  'cliente vê e paga a cobrança (boleto/Pix/cartão conforme forma_pagamento).';

comment on column public.invoices.boleto_url is
  'bankSlipUrl retornado pelo Asaas — só preenchido quando forma_pagamento '
  'é "boleto" (ou billingType UNDEFINED e o cliente escolhe boleto do lado '
  'do Asaas).';

create index if not exists idx_invoices_asaas_payment_id
  on public.invoices (asaas_payment_id);
