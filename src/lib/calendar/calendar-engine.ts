import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Database, SpecialDate } from "@/lib/supabase/types";
import { normalize } from "@/lib/calendar/normalize";

// Quantos dias de antecedência um evento precisa estar pra virar um item
// em content_calendar. Sugestão do escopo original: 7 dias.
export const DIAS_ANTECEDENCIA = 7;

type TipoEvento =
  | "feriado_nacional"
  | "aniversario_pessoal"
  | "aniversario_empresa"
  | "data_nicho";

export type EventoCandidato = {
  client_id: string;
  data_evento: string; // YYYY-MM-DD
  tipo_evento: TipoEvento;
  nome_evento: string;
};

type ClienteParaDeteccao = Pick<
  Client,
  "id" | "nome" | "empresa" | "segmento" | "aniversario_pessoal" | "aniversario_empresa"
>;

function dataUTC(ano: number, mes1based: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes1based - 1, dia));
}

function formatarISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function mesDiaDaString(dataStr: string): { mes: number; dia: number } {
  const [, mesStr, diaStr] = dataStr.split("-");
  return { mes: Number(mesStr), dia: Number(diaStr) };
}

// Retorna a próxima ocorrência (incluindo hoje) de um dia/mês fixo, considerando
// o ano atual ou o próximo caso já tenha passado neste ano.
function proximaOcorrencia(hoje: Date, mes: number, dia: number): Date {
  const ano = hoje.getUTCFullYear();
  let candidata = dataUTC(ano, mes, dia);
  if (candidata < hoje) {
    candidata = dataUTC(ano + 1, mes, dia);
  }
  return candidata;
}

function dentroDaJanela(data: Date, hoje: Date, dias: number): boolean {
  const diffDias = Math.round((data.getTime() - hoje.getTime()) / 86_400_000);
  return diffDias >= 0 && diffDias <= dias;
}

export function detectarCandidatosParaCliente(
  cliente: ClienteParaDeteccao,
  specialDates: SpecialDate[],
  hoje: Date
): EventoCandidato[] {
  const candidatos: EventoCandidato[] = [];

  if (cliente.aniversario_pessoal) {
    const { mes, dia } = mesDiaDaString(cliente.aniversario_pessoal);
    const ocorrencia = proximaOcorrencia(hoje, mes, dia);
    if (dentroDaJanela(ocorrencia, hoje, DIAS_ANTECEDENCIA)) {
      candidatos.push({
        client_id: cliente.id,
        data_evento: formatarISO(ocorrencia),
        tipo_evento: "aniversario_pessoal",
        nome_evento: `Aniversário de ${cliente.nome}`,
      });
    }
  }

  if (cliente.aniversario_empresa) {
    const { mes, dia } = mesDiaDaString(cliente.aniversario_empresa);
    const ocorrencia = proximaOcorrencia(hoje, mes, dia);
    if (dentroDaJanela(ocorrencia, hoje, DIAS_ANTECEDENCIA)) {
      candidatos.push({
        client_id: cliente.id,
        data_evento: formatarISO(ocorrencia),
        tipo_evento: "aniversario_empresa",
        nome_evento: `Aniversário de ${cliente.empresa ?? cliente.nome}`,
      });
    }
  }

  const segmentoCliente = cliente.segmento ? normalize(cliente.segmento) : null;

  for (const data of specialDates) {
    if (data.segmento) {
      if (!segmentoCliente || normalize(data.segmento) !== segmentoCliente) continue;
    }

    let ocorrencia: Date;
    if (data.recorrente) {
      ocorrencia = proximaOcorrencia(hoje, data.mes, data.dia);
    } else {
      // Data móvel (ex.: Carnaval): só vale pro ano específico sincronizado.
      if (!data.ano) continue;
      ocorrencia = dataUTC(data.ano, data.mes, data.dia);
    }

    if (!dentroDaJanela(ocorrencia, hoje, DIAS_ANTECEDENCIA)) continue;

    candidatos.push({
      client_id: cliente.id,
      data_evento: formatarISO(ocorrencia),
      tipo_evento: data.tipo === "nacional" ? "feriado_nacional" : "data_nicho",
      nome_evento: data.nome,
    });
  }

  return candidatos;
}

export type ResultadoMotorCalendario = {
  clientesProcessados: number;
  eventosCriados: number;
};

// Roda o motor de detecção pra um cliente específico (opts.clientId) ou pra
// todos os clientes. Cria uma linha em content_calendar (status
// 'pendente_geracao') pra cada evento ainda não registrado — chamado
// manualmente nesta fase (ver Decisões Tomadas em PROGRESS.md).
export async function runCalendarEngine(
  supabase: SupabaseClient<Database>,
  opts?: { clientId?: string }
): Promise<ResultadoMotorCalendario> {
  let clientesQuery = supabase
    .from("clients")
    .select("id, nome, empresa, segmento, aniversario_pessoal, aniversario_empresa");

  if (opts?.clientId) {
    clientesQuery = clientesQuery.eq("id", opts.clientId);
  }

  const { data: clientes, error: clientesError } = await clientesQuery;
  if (clientesError) {
    throw new Error(`Não foi possível carregar clientes: ${clientesError.message}`);
  }

  const { data: specialDates, error: specialDatesError } = await supabase
    .from("special_dates")
    .select("*");
  if (specialDatesError) {
    throw new Error(`Não foi possível carregar special_dates: ${specialDatesError.message}`);
  }

  const hojeStr = new Date().toISOString().slice(0, 10);
  const hoje = new Date(`${hojeStr}T00:00:00.000Z`);

  let eventosCriados = 0;

  for (const cliente of clientes ?? []) {
    const candidatos = detectarCandidatosParaCliente(cliente, specialDates ?? [], hoje);
    if (candidatos.length === 0) continue;

    const { data: existentes, error: existentesError } = await supabase
      .from("content_calendar")
      .select("data_evento, tipo_evento, nome_evento")
      .eq("client_id", cliente.id);

    if (existentesError) {
      throw new Error(
        `Não foi possível checar eventos existentes do cliente ${cliente.id}: ${existentesError.message}`
      );
    }

    const chavesExistentes = new Set(
      (existentes ?? []).map((e) => `${e.data_evento}|${e.tipo_evento}|${e.nome_evento}`)
    );

    const novos = candidatos.filter(
      (c) => !chavesExistentes.has(`${c.data_evento}|${c.tipo_evento}|${c.nome_evento}`)
    );

    if (novos.length === 0) continue;

    const { error: insertError } = await supabase.from("content_calendar").insert(
      novos.map((c) => ({
        client_id: c.client_id,
        data_evento: c.data_evento,
        tipo_evento: c.tipo_evento,
        nome_evento: c.nome_evento,
        status: "pendente_geracao" as const,
      }))
    );

    if (insertError) {
      throw new Error(
        `Não foi possível criar eventos pro cliente ${cliente.id}: ${insertError.message}`
      );
    }

    eventosCriados += novos.length;
  }

  return { clientesProcessados: clientes?.length ?? 0, eventosCriados };
}
