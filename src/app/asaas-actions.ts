"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAsaasPaymentForInvoice } from "@/lib/asaas/create-payment";
import type { AsaasBillingType } from "@/lib/asaas/client";

// Botão "Gerar cobrança real" na tela do cliente (Fase 17) — cria a
// cobrança de verdade no Asaas Sandbox pra uma fatura já existente (Fase
// 16). Não substitui nem muda o fluxo manual de "Marcar pago" — os dois
// convivem: uma fatura pode continuar sendo controlada manualmente, ou
// ganhar uma cobrança real que o webhook (Etapa 4) atualiza sozinho
// quando confirmada.
export async function createAsaasPaymentAction(input: {
  invoiceId: string;
  clientId: string;
  billingType: AsaasBillingType;
}) {
  const supabase = await createSupabaseServerClient();

  const resultado = await createAsaasPaymentForInvoice(supabase, input.invoiceId, input.billingType);

  revalidatePath(`/clientes/${input.clientId}`);
  revalidatePath("/financeiro");

  return resultado;
}
