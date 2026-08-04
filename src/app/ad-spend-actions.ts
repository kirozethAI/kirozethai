"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { syncMetaAdSpend } from "@/lib/meta-ads/sync-spend";

// Registra gasto manual (Etapa 4) — sempre disponível, com ou sem conexão
// Meta ativa. Não é um "modo alternativo" que exige desconectar antes: um
// usuário conectado pode complementar/corrigir um dia específico manualmente
// (ver Decisões Tomadas da migration sobre origem "api" e "manual"
// coexistirem no mesmo dia).
export async function registerManualAdSpendAction(input: {
  clientId: string;
  data: string;
  valor: number;
}) {
  const supabase = await createSupabaseServerClient();

  if (!(input.valor >= 0)) {
    throw new Error("O valor precisa ser zero ou maior.");
  }
  if (!input.data) {
    throw new Error("Informe a data do gasto.");
  }

  const { error } = await supabase.from("ad_spend").insert({
    client_id: input.clientId,
    ad_account_id: null,
    data: input.data,
    valor: input.valor,
    origem: "manual",
  });

  if (error) {
    throw new Error(`Não foi possível registrar o gasto: ${error.message}`);
  }

  revalidatePath(`/clientes/${input.clientId}`);
}

// Disparo manual da sincronização do Meta Ads (Etapa 3/6) — mesmo padrão
// já estabelecido nas Fases 2/8/16 pros jobs do cron diário: útil pra
// testar sem esperar o cron, e como fallback manual depois.
export async function syncMetaAdSpendAction() {
  const supabase = await createSupabaseServerClient();
  const resultado = await syncMetaAdSpend(supabase);
  revalidatePath("/");
  return resultado;
}
