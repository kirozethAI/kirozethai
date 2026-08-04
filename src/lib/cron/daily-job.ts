import { createAdminClient } from "@/lib/supabase/admin";
import { checkHolidaysUpToDate } from "@/lib/calendar/holidays-check";
import { syncNationalHolidays } from "@/lib/calendar/holidays-sync";
import { runCalendarEngine } from "@/lib/calendar/calendar-engine";
import { generateSuggestionsForPending } from "@/lib/calendar/generate-suggestions";
import { generateMonthlyInvoices } from "@/lib/billing/generate-monthly-invoices";
import { markOverdueInvoices } from "@/lib/billing/mark-overdue-invoices";
import { syncMetaAdSpend } from "@/lib/meta-ads/sync-spend";

export type ResultadoJobDiario = {
  feriadosSincronizados: boolean;
  clientesProcessados: number;
  eventosDetectados: number;
  sugestoesGeradas: number;
  falhasGeracao: number;
  faturasGeradas: number;
  faturasMarcadasAtrasadas: number;
  gastosMetaSincronizados: number;
  falhasSincronizacaoMeta: number;
};

// Job diário que substitui a necessidade de clicar manualmente em
// "Sincronizar feriados" e "Verificar datas comemorativas" todo dia — esses
// botões continuam existindo como fallback (ver Decisões Tomadas da Fase 8
// em PROGRESS.md). Roda pra TODOS os clientes, em sequência:
// 1. Sincroniza feriados nacionais SÓ se checkHolidaysUpToDate indicar que
//    special_dates está desatualizada (evita sincronizar sem necessidade).
// 2. runCalendarEngine (detecção de eventos, já tem dedup próprio).
// 3. generateSuggestionsForPending (geração de texto via Groq).
// Usa o client de service role (admin.ts) porque não há sessão de usuário
// nesse contexto — chamado pelo agendamento em src/instrumentation.ts, não
// por uma requisição HTTP de alguém logado.
export async function runDailyJob(): Promise<ResultadoJobDiario> {
  const inicio = new Date().toISOString();
  const supabase = createAdminClient();

  const statusFeriados = await checkHolidaysUpToDate(supabase);
  let feriadosSincronizados = false;
  if (!statusFeriados.atualizado) {
    await syncNationalHolidays(supabase, [statusFeriados.anoAtual, statusFeriados.anoSeguinte]);
    feriadosSincronizados = true;
  }

  const deteccao = await runCalendarEngine(supabase);
  const geracao = await generateSuggestionsForPending(supabase);

  // Financeiro (Fase 16) — independente do calendário/Groq acima, roda em
  // sequência no mesmo job só por conveniência de agendamento (1 cron só).
  // Falha aqui não deve derrubar o resultado do resto do job diário.
  let faturasGeradas = 0;
  let faturasMarcadasAtrasadas = 0;
  try {
    const faturamento = await generateMonthlyInvoices(supabase);
    faturasGeradas = faturamento.faturasGeradas;
  } catch (err) {
    console.error("[cron] Falha ao gerar faturas mensais:", err);
  }
  try {
    const atrasos = await markOverdueInvoices(supabase);
    faturasMarcadasAtrasadas = atrasos.marcadasAtrasadas;
  } catch (err) {
    console.error("[cron] Falha ao marcar faturas atrasadas:", err);
  }

  // Meta Ads (Fase 18) — mesma lógica de isolamento: falha aqui (ou dentro
  // de syncMetaAdSpend, por conta individual) não deve derrubar o
  // resultado do resto do job diário. syncMetaAdSpend já isola erro POR
  // CONTA internamente; este try/catch cobre só o caso da própria função
  // falhar antes disso (ex.: erro ao listar as contas conectadas).
  let gastosMetaSincronizados = 0;
  let falhasSincronizacaoMeta = 0;
  try {
    const sincronizacaoMeta = await syncMetaAdSpend(supabase);
    gastosMetaSincronizados = sincronizacaoMeta.gastosRegistrados;
    falhasSincronizacaoMeta = sincronizacaoMeta.falhas;
  } catch (err) {
    console.error("[cron] Falha ao sincronizar gasto do Meta Ads:", err);
  }

  const resultado: ResultadoJobDiario = {
    feriadosSincronizados,
    clientesProcessados: deteccao.clientesProcessados,
    eventosDetectados: deteccao.eventosCriados,
    sugestoesGeradas: geracao.geradas,
    falhasGeracao: geracao.falhas,
    faturasGeradas,
    faturasMarcadasAtrasadas,
    gastosMetaSincronizados,
    falhasSincronizacaoMeta,
  };

  console.log(
    `[cron] Job diário concluído (iniciado ${inicio}): ` +
      `feriados ${feriadosSincronizados ? "ressincronizados agora" : "já estavam atualizados"}; ` +
      `${resultado.clientesProcessados} cliente(s) processado(s), ` +
      `${resultado.eventosDetectados} evento(s) novo(s) detectado(s), ` +
      `${resultado.sugestoesGeradas} sugestão(ões) gerada(s), ` +
      `${resultado.falhasGeracao} falha(s) de geração; ` +
      `${resultado.faturasGeradas} fatura(s) mensal(is) gerada(s), ` +
      `${resultado.faturasMarcadasAtrasadas} fatura(s) marcada(s) como atrasada(s); ` +
      `${resultado.gastosMetaSincronizados} gasto(s) do Meta Ads sincronizado(s), ` +
      `${resultado.falhasSincronizacaoMeta} falha(s) de sincronização.`
  );

  return resultado;
}
