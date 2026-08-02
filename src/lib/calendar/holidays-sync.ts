import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type NagerHoliday = {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
};

async function fetchNationalHolidays(ano: number): Promise<NagerHoliday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/BR`);
  if (!res.ok) {
    throw new Error(`Nager.Date respondeu ${res.status} pro ano ${ano}`);
  }
  return res.json();
}

export type ResultadoSyncFeriados = {
  inseridos: number;
  ignorados: number;
};

// Sincroniza feriados nacionais BR pra special_dates. Chamada manualmente
// nesta fase (sem cron real ainda — ver Decisões Tomadas em PROGRESS.md).
// Feriados fixos (Nager `fixed: true`, ex.: Natal) viram linhas recorrentes
// (mes/dia, sem ano). Feriados móveis (ex.: Carnaval) viram linhas
// não-recorrentes específicas do ano sincronizado.
export async function syncNationalHolidays(
  supabase: SupabaseClient<Database>,
  anos: number[]
): Promise<ResultadoSyncFeriados> {
  const { data: existentes, error: existentesError } = await supabase
    .from("special_dates")
    .select("nome, mes, dia, ano")
    .eq("tipo", "nacional");

  if (existentesError) {
    throw new Error(`Não foi possível carregar special_dates existentes: ${existentesError.message}`);
  }

  const chavesExistentes = new Set(
    (existentes ?? []).map((e) => `${e.nome}|${e.mes}|${e.dia}|${e.ano ?? "null"}`)
  );

  const novasLinhas: Database["public"]["Tables"]["special_dates"]["Insert"][] = [];
  let ignorados = 0;

  for (const ano of anos) {
    const feriados = await fetchNationalHolidays(ano);

    for (const feriado of feriados) {
      const [, mesStr, diaStr] = feriado.date.split("-");
      const mes = Number(mesStr);
      const dia = Number(diaStr);
      const anoLinha = feriado.fixed ? null : ano;
      const chave = `${feriado.localName}|${mes}|${dia}|${anoLinha ?? "null"}`;

      if (chavesExistentes.has(chave)) {
        ignorados++;
        continue;
      }
      chavesExistentes.add(chave);

      novasLinhas.push({
        nome: feriado.localName,
        tipo: "nacional",
        mes,
        dia,
        segmento: null,
        recorrente: feriado.fixed,
        ano: anoLinha,
      });
    }
  }

  if (novasLinhas.length === 0) {
    return { inseridos: 0, ignorados };
  }

  const { error: insertError } = await supabase.from("special_dates").insert(novasLinhas);
  if (insertError) {
    throw new Error(`Não foi possível salvar feriados sincronizados: ${insertError.message}`);
  }

  return { inseridos: novasLinhas.length, ignorados };
}
