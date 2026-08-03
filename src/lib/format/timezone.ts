// Helper único de conversão de fuso horário — América/São Paulo (Brasília),
// explícito via `timeZone` do Intl.DateTimeFormat. Não depender do fuso
// horário do processo/servidor: localhost roda no fuso do Windows do usuário
// (já UTC-3, por coincidência "parece certo"), mas a Vercel roda em UTC —
// sem conversão explícita, o mesmo código mostra horas diferentes dependendo
// de onde roda, e sempre erradas em produção (diferença de até 3h, podendo
// até mudar o dia exibido). Ver Decisões Tomadas da Fase 10.
const FUSO_BRASILIA = "America/Sao_Paulo";

// Formato "en-CA" retorna datas como YYYY-MM-DD nativamente — truque comum
// pra extrair uma data ISO já no fuso certo sem montar a string na mão.
const FORMATADOR_DATA_ISO_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_BRASILIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATADOR_HORA_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_BRASILIA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Converte um timestamp ISO (UTC, ex.: content_calendar_history.created_at)
// pra data 'YYYY-MM-DD' no fuso de Brasília.
export function paraDataIsoBrasilia(timestampISO: string): string {
  return FORMATADOR_DATA_ISO_BRASILIA.format(new Date(timestampISO));
}

// Converte um timestamp ISO (UTC) pra hora 'HH:mm' no fuso de Brasília.
export function paraHoraBrasilia(timestampISO: string): string {
  return FORMATADOR_HORA_BRASILIA.format(new Date(timestampISO));
}

// Data de "hoje" ('YYYY-MM-DD') no fuso de Brasília, não no fuso do
// processo/servidor. Usar em qualquer lugar que precise stampar "a data de
// hoje" pra exibição/registro do usuário (ex.: data_evento de um post
// avulso, Fase 5) — NÃO usar pra lógica de decisão do motor de calendário
// (runCalendarEngine, Fase 2), que deliberadamente continua no cálculo já
// estabelecido (mudar a janela de detecção é lógica de negócio, fora do
// escopo desta fase — ver Decisões Tomadas da Fase 10).
export function hojeBrasiliaISO(): string {
  return FORMATADOR_DATA_ISO_BRASILIA.format(new Date());
}
