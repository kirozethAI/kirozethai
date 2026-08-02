import { formatarDataPtBr } from "@/lib/calendar/format";
import { normalize } from "@/lib/calendar/normalize";

type EventoParaMensagem = {
  nome_evento: string;
  data_evento: string;
};

// Mensagem que a IA posta no chat quando uma sugestão é gerada (ou ajustada).
export function formatSuggestionMessage(evento: EventoParaMensagem, texto: string): string {
  const dataFormatada = formatarDataPtBr(evento.data_evento);
  return (
    `${evento.nome_evento} está chegando (${dataFormatada}). Aqui vai uma sugestão de post:\n\n` +
    `"${texto}"\n\n` +
    `Quer aprovar, ajustar ou prefere não postar? Responda "aprovado", me diga o que mudar, ou "rejeitar".`
  );
}

const PALAVRAS_APROVACAO = [
  "aprovado",
  "aprovo",
  "aprovar",
  "aprova",
  "sim",
  "ok",
  "pode postar",
  "gostei",
  "perfeito",
  "confirmado",
  "beleza",
];

const PALAVRAS_REJEICAO = [
  "rejeitar",
  "rejeito",
  "rejeitado",
  "nao",
  "não",
  "descartar",
  "descartado",
  "nao gostei",
  "não gostei",
  "não quero postar",
  "nao quero postar",
];

export type RespostaSugestao = "aprovado" | "rejeitado" | "ajuste";

// Interpreta a resposta livre do usuário no chat pra uma sugestão pendente.
// Qualquer coisa que não seja claramente aprovação ou rejeição é tratada como
// feedback de ajuste (ver Decisões Tomadas em PROGRESS.md).
export function parseSuggestionReply(texto: string): RespostaSugestao {
  const normalizado = normalize(texto);

  if (PALAVRAS_APROVACAO.some((p) => normalizado === normalize(p))) return "aprovado";
  if (PALAVRAS_REJEICAO.some((p) => normalizado === normalize(p))) return "rejeitado";

  return "ajuste";
}
