import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type HolidaysCheckResult = {
  atualizado: boolean;
  anoAtual: number;
  anoSeguinte: number;
  anoAtualPresente: boolean;
  anoSeguintePresente: boolean;
};

// Verifica se special_dates (tipo 'nacional') tem cobertura do ano atual E
// do ano seguinte. Nota: TODO feriado nacional sincronizado vem com `ano`
// preenchido, não só os móveis (ver Decisões Tomadas da Fase 2 — a API
// Nager.Date retorna `fixed: false` pra todos os feriados BR) — então essa
// checagem é só sobre cobertura de anos, não sobre fixo/móvel. Reativo: roda
// toda vez que a home carrega, sem cron.
export async function checkHolidaysUpToDate(
  supabase: SupabaseClient<Database>
): Promise<HolidaysCheckResult> {
  const anoAtual = new Date().getFullYear();
  const anoSeguinte = anoAtual + 1;

  const { data, error } = await supabase
    .from("special_dates")
    .select("ano")
    .eq("tipo", "nacional")
    .in("ano", [anoAtual, anoSeguinte]);

  if (error) {
    throw new Error(`Não foi possível checar special_dates: ${error.message}`);
  }

  const anosPresentes = new Set((data ?? []).map((d) => d.ano));
  const anoAtualPresente = anosPresentes.has(anoAtual);
  const anoSeguintePresente = anosPresentes.has(anoSeguinte);

  return {
    atualizado: anoAtualPresente && anoSeguintePresente,
    anoAtual,
    anoSeguinte,
    anoAtualPresente,
    anoSeguintePresente,
  };
}
