import type { Client, ClientDna } from "@/lib/supabase/types";
import { formatarDataPtBr } from "@/lib/calendar/format";
import { groqChatCompletion } from "@/lib/groq/client";

// Limite de caracteres pedido no prompt. Calibrado com base na capacidade
// real do template de imagem (src/lib/render/post-template.ts): mesmo o
// bucket de fonte mais generoso do pickFontSize (≤400 caracteres → 34px)
// comporta bem mais que isso dentro da área de texto (880x680px, line-height
// 1.4) — 280 caracteres deixa margem de sobra mesmo se a Groq passar um
// pouco do pedido, ao mesmo tempo que força um estilo de legenda curta de
// post de rede social em vez de um texto corrido de vários parágrafos (ver
// Problemas Encontrados da Fase 5 — foi isso que cortou na imagem).
const LIMITE_CARACTERES_POST = 280;

const SYSTEM_PROMPT =
  "Você é um assistente de marketing que escreve sugestões de post pra redes " +
  "sociais em português do Brasil, no estilo de legenda de post: direto, " +
  "natural, 1 a 3 frases curtas — nunca um texto corrido de vários " +
  `parágrafos. Use no máximo ${LIMITE_CARACTERES_POST} caracteres no total; ` +
  "esse texto vai dentro de uma imagem quadrada, não numa legenda extensa " +
  "de rede social. Sem jargão técnico de marketing. Pode usar emoji ou " +
  "hashtag leve se combinar com o tom de voz do cliente, sem exagerar. " +
  "Devolva só o texto do post, pronto pra publicar — sem explicações, sem " +
  "aspas ao redor do texto.";

type ClienteEDna = {
  client: Pick<Client, "nome" | "empresa" | "segmento">;
  dna: Pick<ClientDna, "tom_de_voz" | "publico_alvo" | "produtos" | "cidade">;
};

type EventoParaPrompt = {
  nome_evento: string;
  data_evento: string;
};

type GerarSugestaoInput = ClienteEDna & {
  evento: EventoParaPrompt;
  // Presentes só quando é um pedido de ajuste sobre uma sugestão já existente.
  sugestaoAnterior?: string;
  feedbackAjuste?: string;
};

// Reaproveitada tanto pra sugestões ligadas a um evento de calendário
// (generatePostSuggestion) quanto pra pedidos avulsos no chat livre
// (generateAdHocPostSuggestion, Fase 5) — mesmo bloco de contexto do
// cliente em ambos os prompts.
function montarLinhasDna({ client, dna }: ClienteEDna): string {
  return [
    dna.tom_de_voz && `Tom de voz da marca: ${dna.tom_de_voz}`,
    dna.publico_alvo && `Público-alvo: ${dna.publico_alvo}`,
    dna.produtos && `Produtos/serviços: ${dna.produtos}`,
    client.segmento && `Segmento: ${client.segmento}`,
    dna.cidade && `Cidade: ${dna.cidade}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function montarClienteLine({ client }: ClienteEDna): string {
  return `Cliente: ${client.nome}${client.empresa ? ` (${client.empresa})` : ""}`;
}

// Reforça o limite de novo no user prompt (além do system prompt) — LLMs
// seguem restrições de tamanho de forma mais confiável quando o número
// aparece mais de uma vez, perto da instrução final.
const LEMBRETE_LIMITE = `Máximo ${LIMITE_CARACTERES_POST} caracteres, estilo legenda curta de post.`;

// Monta o prompt com o DNA do cliente + o evento e pede uma sugestão de post
// via Groq. Se sugestaoAnterior + feedbackAjuste forem passados, pede uma
// reescrita incorporando o ajuste pedido pelo usuário no chat.
export async function generatePostSuggestion(input: GerarSugestaoInput): Promise<string> {
  const dnaLines = montarLinhasDna(input);
  const clienteLine = montarClienteLine(input);
  const eventoLine = `Data comemorativa: ${input.evento.nome_evento} (${formatarDataPtBr(input.evento.data_evento)})`;

  let userPrompt = [
    clienteLine,
    dnaLines,
    "",
    eventoLine,
    "",
    "Escreva uma sugestão de post pra essa data, alinhada com o perfil do cliente acima.",
    LEMBRETE_LIMITE,
  ].join("\n");

  if (input.sugestaoAnterior && input.feedbackAjuste) {
    userPrompt +=
      `\n\nVersão anterior do post:\n"${input.sugestaoAnterior}"` +
      `\n\nO cliente pediu o seguinte ajuste: "${input.feedbackAjuste}"` +
      `\n\nReescreva o post incorporando esse ajuste. ${LEMBRETE_LIMITE}`;
  }

  return groqChatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);
}

type GerarAdHocInput = ClienteEDna & {
  pedido: string;
};

// Variação de generatePostSuggestion pra pedidos avulsos feitos no chat
// livre (Fase 5) — não está ligada a uma data comemorativa do calendário,
// então o prompt usa o pedido literal do cliente como briefing em vez de
// "Data comemorativa: X".
export async function generateAdHocPostSuggestion(input: GerarAdHocInput): Promise<string> {
  const dnaLines = montarLinhasDna(input);
  const clienteLine = montarClienteLine(input);

  const userPrompt = [
    clienteLine,
    dnaLines,
    "",
    `Pedido do cliente: "${input.pedido}"`,
    "",
    "Escreva uma sugestão de post atendendo esse pedido, alinhada com o perfil do cliente acima.",
    LEMBRETE_LIMITE,
  ].join("\n");

  return groqChatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);
}
