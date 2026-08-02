import { createAdminClient } from "@/lib/supabase/admin";
import { checkHolidaysUpToDate } from "@/lib/calendar/holidays-check";
import { syncNationalHolidays } from "@/lib/calendar/holidays-sync";
import { runCalendarEngine } from "@/lib/calendar/calendar-engine";
import { generateSuggestionsForPending } from "@/lib/calendar/generate-suggestions";

export type ResultadoJobDiario = {
  feriadosSincronizados: boolean;
  clientesProcessados: number;
  eventosDetectados: number;
  sugestoesGeradas: number;
  falhasGeracao: number;
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

  const resultado: ResultadoJobDiario = {
    feriadosSincronizados,
    clientesProcessados: deteccao.clientesProcessados,
    eventosDetectados: deteccao.eventosCriados,
    sugestoesGeradas: geracao.geradas,
    falhasGeracao: geracao.falhas,
  };

  console.log(
    `[cron] Job diário concluído (iniciado ${inicio}): ` +
      `feriados ${feriadosSincronizados ? "ressincronizados agora" : "já estavam atualizados"}; ` +
      `${resultado.clientesProcessados} cliente(s) processado(s), ` +
      `${resultado.eventosDetectados} evento(s) novo(s) detectado(s), ` +
      `${resultado.sugestoesGeradas} sugestão(ões) gerada(s), ` +
      `${resultado.falhasGeracao} falha(s) de geração.`
  );

  return resultado;
}
