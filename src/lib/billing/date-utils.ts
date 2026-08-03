// Utilitários de data pro módulo financeiro (Fase 16) — todos em UTC
// explícito (Date.UTC/getUTC*), mesmo cuidado da Fase 10 com fuso horário
// (evita o mesmo tipo de bug de "dia errado" já corrigido lá). Datas são
// strings YYYY-MM-DD (mesmo formato de content_calendar.data_evento e
// invoices.data_vencimento).

// Último dia do mês (1-indexado: mes=1 é janeiro) — usado pra "clampar"
// dia_vencimento em meses mais curtos (ex.: dia_vencimento=31 em fevereiro
// vira 28 ou 29, dependendo do ano bissexto).
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// Calcula a data de vencimento deste mês (referenciaISO) pro dia
// configurado em client_billing.dia_vencimento, ajustando pro último dia
// do mês se ele for mais curto que o dia configurado.
export function calcularVencimentoDoMes(diaVencimento: number, referenciaISO: string): string {
  const [ano, mes] = referenciaISO.split("-").map(Number);
  const diaClamp = Math.min(diaVencimento, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaClamp).padStart(2, "0")}`;
}

// N dias antes de uma data (usado pra janela de antecedência de geração —
// ver DIAS_ANTECEDENCIA_GERACAO em generate-monthly-invoices.ts).
export function diasAntes(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

// Primeiro dia do mês seguinte ao de uma data — usado pra montar a faixa
// [início do mês, início do próximo mês) na checagem de "já existe fatura
// pra este mês".
export function primeiroDiaProximoMes(dataISO: string): string {
  const [ano, mes] = dataISO.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

export function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}
