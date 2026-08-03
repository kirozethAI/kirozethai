"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMonthlyInvoices } from "@/lib/billing/generate-monthly-invoices";
import { markOverdueInvoices } from "@/lib/billing/mark-overdue-invoices";

// Configura a cobrança recorrente de um cliente (Fase 16) — upsert manual
// via código (não constraint de unicidade no banco): se já existe uma
// linha em client_billing pra esse cliente, atualiza; senão, cria. Mantém
// "no máximo 1 configuração de cobrança por cliente" como comportamento
// da aplicação, sem impedir no banco (ver Decisões Tomadas).
export async function upsertClientBillingAction(input: {
  clientId: string;
  tipoCobranca: "fixa" | "variavel";
  valorFixo: number | null;
  diaVencimento: number | null;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: existente } = await supabase
    .from("client_billing")
    .select("id")
    .eq("client_id", input.clientId)
    .maybeSingle();

  const valores = {
    client_id: input.clientId,
    tipo_cobranca: input.tipoCobranca,
    valor_fixo: input.tipoCobranca === "fixa" ? input.valorFixo : null,
    dia_vencimento: input.tipoCobranca === "fixa" ? input.diaVencimento : null,
    ativo: true,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = existente
    ? await supabase.from("client_billing").update(valores).eq("id", existente.id)
    : await supabase.from("client_billing").insert(valores);

  if (error) {
    throw new Error(`Não foi possível salvar a cobrança: ${error.message}`);
  }

  revalidatePath(`/clientes/${input.clientId}`);
}

// Cria uma fatura avulsa de valor variável (Etapa 2) — sem
// client_billing_id (não está ligada a uma cobrança recorrente).
export async function createVariableInvoiceAction(input: {
  clientId: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.descricao.trim()) {
    throw new Error("Descreva o que está sendo cobrado.");
  }
  if (!(input.valor > 0)) {
    throw new Error("O valor precisa ser maior que zero.");
  }

  const { error } = await supabase.from("invoices").insert({
    client_id: input.clientId,
    client_billing_id: null,
    descricao: input.descricao,
    valor: input.valor,
    data_vencimento: input.dataVencimento,
  });

  if (error) {
    throw new Error(`Não foi possível criar a fatura: ${error.message}`);
  }

  revalidatePath(`/clientes/${input.clientId}`);
  revalidatePath("/financeiro");
}

// Marca uma fatura como paga — controle MANUAL nesta fase (sem integração
// de pagamento real, isso é a Fase 17). `data_pagamento` fica com o
// momento em que o usuário clicou, não uma data de pagamento informada
// por ele (mais simples, e não há como validar uma data alegada sem
// integração real de qualquer forma).
export async function markInvoicePaidAction(input: { invoiceId: string; clientId: string }) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "pago", data_pagamento: new Date().toISOString() })
    .eq("id", input.invoiceId);

  if (error) {
    throw new Error(`Não foi possível marcar a fatura como paga: ${error.message}`);
  }

  revalidatePath(`/clientes/${input.clientId}`);
  revalidatePath("/financeiro");
}

// Disparo manual do job de geração mensal (Etapa 3) — mesmo padrão de
// "Sincronizar feriados"/"Verificar datas comemorativas" (Fase 2/8): o
// cron diário já faz isso sozinho, este botão existe pra testar sem
// esperar o cron e como fallback manual.
export async function generateMonthlyInvoicesAction() {
  const supabase = await createSupabaseServerClient();
  const resultado = await generateMonthlyInvoices(supabase);
  revalidatePath("/financeiro");
  return resultado;
}

// Disparo manual do job de marcar atrasadas (Etapa 4) — mesmo motivo do
// disparo manual acima.
export async function markOverdueInvoicesAction() {
  const supabase = await createSupabaseServerClient();
  const resultado = await markOverdueInvoices(supabase);
  revalidatePath("/financeiro");
  return resultado;
}
