import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hojeBrasiliaISO } from "@/lib/format/timezone";

export type ResultadoAtualizacaoAtrasos = {
  marcadasAtrasadas: number;
};

// Marca como "atrasado" toda invoice com status ainda "pendente" e
// data_vencimento no passado (Fase 16) — chamado pelo cron diário e
// também disponível como disparo manual (ver billing-actions.ts). Só
// mexe em status "pendente": uma fatura "paga" ou "cancelada" com
// vencimento passado não é tocada (não faz sentido "atrasar" uma fatura
// já resolvida).
export async function markOverdueInvoices(
  supabase: SupabaseClient<Database>
): Promise<ResultadoAtualizacaoAtrasos> {
  const hoje = hojeBrasiliaISO();

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "atrasado" })
    .eq("status", "pendente")
    .lt("data_vencimento", hoje)
    .select("id");

  if (error) {
    throw new Error(`Não foi possível atualizar faturas atrasadas: ${error.message}`);
  }

  return { marcadasAtrasadas: data?.length ?? 0 };
}
