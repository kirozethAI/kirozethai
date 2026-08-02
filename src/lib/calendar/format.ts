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
// "27 de agosto às 14:32". Lê o horário direto da string UTC vinda do banco
// (sem converter pro fuso local do processo Node) — suficiente pro histórico
// auditável desta fase, que só precisa mostrar "nesse dia, nesse horário",
// não uma exibição sensível ao fuso do usuário.
export function formatarDataHoraPtBr(timestampISO: string): string {
  const dataParte = timestampISO.slice(0, 10);
  const horaParte = timestampISO.slice(11, 16);
  return `${formatarDataPtBr(dataParte)} às ${horaParte}`;
}
