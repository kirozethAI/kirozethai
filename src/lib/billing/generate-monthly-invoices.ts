import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hojeBrasiliaISO } from "@/lib/format/timezone";
import {
  calcularVencimentoDoMes,
  diasAntes,
  primeiroDiaDoMes,
  primeiroDiaProximoMes,
} from "@/lib/billing/date-utils";

// Antecedência de geração da fatura fixa mensal, em dias antes do
// vencimento. 5 dias dá tempo do cliente ver a fatura e organizar o
// pagamento sem gerar cedo demais (o que poderia confundir com o mês
// anterior) nem tarde demais (sem folga nenhuma até o vencimento).
const DIAS_ANTECEDENCIA_GERACAO = 5;

export type ResultadoFaturamentoMensal = {
  cobrancasProcessadas: number;
  faturasGeradas: number;
  falhas: number;
};

// Gera faturas mensais pra cobranças fixas (Fase 16) — chamado pelo cron
// diário (daily-job.ts, Fase 8) e também disponível como disparo manual
// (ver billing-actions.ts) pra testar sem esperar o cron. Pra cada
// client_billing ativo do tipo "fixa": calcula o vencimento deste mês
// (dia_vencimento, ajustado pro último dia do mês em meses mais curtos —
// ver date-utils.ts) e cria a invoice se (a) ainda não existe uma fatura
// pra esse client_billing neste mês E (b) já estamos dentro da janela de
// antecedência (hoje >= vencimento - 5 dias). A condição é "hoje >=" (não
// "hoje ==") de propósito — deixa a geração resiliente a uma falha do cron
// num dia específico: se ele não rodar no dia exato, ainda gera na próxima
// execução, contanto que ainda não tenha passado do vencimento (depois do
// vencimento, markOverdueInvoices assume — ver mark-overdue-invoices.ts).
export async function generateMonthlyInvoices(
  supabase: SupabaseClient<Database>
): Promise<ResultadoFaturamentoMensal> {
  const hoje = hojeBrasiliaISO();

  const { data: cobrancas, error } = await supabase
    .from("client_billing")
    .select("id, client_id, valor_fixo, dia_vencimento")
    .eq("tipo_cobranca", "fixa")
    .eq("ativo", true);

  if (error) {
    throw new Error(`Não foi possível carregar as cobranças fixas: ${error.message}`);
  }

  let faturasGeradas = 0;
  let falhas = 0;

  for (const cobranca of cobrancas ?? []) {
    try {
      // Defensivo — a constraint client_billing_fixa_completa (migration)
      // já impede tipo_cobranca='fixa' sem esses 2 campos, mas o tipo
      // gerado pelo Supabase ainda os marca como nullable.
      if (cobranca.valor_fixo === null || cobranca.dia_vencimento === null) continue;

      const vencimento = calcularVencimentoDoMes(cobranca.dia_vencimento, hoje);
      if (hoje < diasAntes(vencimento, DIAS_ANTECEDENCIA_GERACAO)) continue;

      const { data: existente } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_billing_id", cobranca.id)
        .gte("data_vencimento", primeiroDiaDoMes(vencimento))
        .lt("data_vencimento", primeiroDiaProximoMes(vencimento))
        .maybeSingle();

      if (existente) continue; // já gerada esse mês

      const { error: insertError } = await supabase.from("invoices").insert({
        client_id: cobranca.client_id,
        client_billing_id: cobranca.id,
        descricao: "Mensalidade",
        valor: cobranca.valor_fixo,
        data_vencimento: vencimento,
      });

      if (insertError) throw new Error(insertError.message);
      faturasGeradas++;
    } catch (err) {
      console.error(`[billing] Falha ao gerar fatura da cobrança ${cobranca.id}:`, err);
      falhas++;
    }
  }

  return { cobrancasProcessadas: cobrancas?.length ?? 0, faturasGeradas, falhas };
}
