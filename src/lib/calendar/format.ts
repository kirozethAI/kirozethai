import { paraDataIsoBrasilia, paraHoraBrasilia } from "@/lib/format/timezone";

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// Formata uma data 'YYYY-MM-DD' como "27 de agosto", sem depender de timezone.
export function formatarDataPtBr(dataISO: string): string {
  const [, mesStr, diaStr] = dataISO.split("-");
  const mes = MESES_PT[Number(mesStr) - 1];
  const dia = Number(diaStr);
  return `${dia} de ${mes}`;
}

// Formata um timestamp ISO (ex.: content_calendar_history.created_at) como
// "27 de agosto às 14:32", convertido de verdade pro horário de Brasília
// (Fase 10 — antes desta correção, lia o horário UTC bruto da string vinda
// do banco, causando diferença de até 3h e até mudança de dia visível pro
// usuário; ver Decisões Tomadas da Fase 10).
export function formatarDataHoraPtBr(timestampISO: string): string {
  const dataParte = paraDataIsoBrasilia(timestampISO);
  const horaParte = paraHoraBrasilia(timestampISO);
  return `${formatarDataPtBr(dataParte)} às ${horaParte}`;
}
