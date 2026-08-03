import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureAsaasCustomer, createAsaasPaymentRaw, type AsaasBillingType } from "@/lib/asaas/client";

const FORMA_PAGAMENTO_POR_BILLING_TYPE: Record<AsaasBillingType, "boleto" | "pix" | "cartao" | null> = {
  BOLETO: "boleto",
  PIX: "pix",
  // "Cliente escolhe" do lado do Asaas — só sabemos qual forma foi usada
  // de verdade quando o webhook (Etapa 4) informar o pagamento.
  UNDEFINED: null,
};

export type ResultadoCobrancaReal = {
  linkPagamento: string;
  boletoUrl: string | null;
};

// Cria a cobrança REAL no Asaas (Sandbox — Fase 17) pra uma invoice já
// existente (Fase 16): busca a fatura + o cliente, garante o customer no
// Asaas (ensureAsaasCustomer — cria 1x, reaproveita depois), cria o
// payment com o valor/vencimento/descrição da própria fatura, e salva os
// dados retornados nela (asaas_payment_id, asaas_customer_id,
// link_pagamento, boleto_url, forma_pagamento). Idempotente por invoice:
// se ela já tem asaas_payment_id, não cria outra cobrança — só devolve os
// dados já salvos (evita cobrança duplicada se o botão for clicado 2x).
export async function createAsaasPaymentForInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  billingType: AsaasBillingType
): Promise<ResultadoCobrancaReal> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, client_id, valor, data_vencimento, descricao, asaas_payment_id, link_pagamento, boleto_url"
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "Fatura não encontrada.");
  }

  if (invoice.asaas_payment_id) {
    return { linkPagamento: invoice.link_pagamento ?? "", boletoUrl: invoice.boleto_url };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, nome, empresa, asaas_customer_id")
    .eq("id", invoice.client_id)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "Cliente não encontrado.");
  }

  const asaasCustomerId = await ensureAsaasCustomer(supabase, client);

  const payment = await createAsaasPaymentRaw({
    customer: asaasCustomerId,
    billingType,
    value: invoice.valor,
    dueDate: invoice.data_vencimento,
    description: invoice.descricao,
    externalReference: invoice.id,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      asaas_payment_id: payment.id,
      asaas_customer_id: asaasCustomerId,
      forma_pagamento: FORMA_PAGAMENTO_POR_BILLING_TYPE[billingType],
      link_pagamento: payment.invoiceUrl,
      boleto_url: payment.bankSlipUrl ?? null,
    })
    .eq("id", invoiceId);

  if (updateError) {
    throw new Error(
      `Cobrança criada no Asaas (${payment.id}), mas falhou salvar na fatura: ${updateError.message}`
    );
  }

  return { linkPagamento: payment.invoiceUrl, boletoUrl: payment.bankSlipUrl ?? null };
}
