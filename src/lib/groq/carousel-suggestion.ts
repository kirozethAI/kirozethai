import type { Client, ClientDna } from "@/lib/supabase/types";
import { formatarDataPtBr } from "@/lib/calendar/format";
import { groqChatCompletion } from "@/lib/groq/client";

// Faixa de slides deliberadamente mais estreita que os "3 a 5" sugeridos no
// escopo (ver Decisões Tomadas da Fase 12): cada slide é um render Puppeteer
// separado e sequencial (generate-carousel.ts), e serverless já roda o
// Puppeteer de 4 a 8x mais devagar que local (Fase 3/9) — 4 como teto em vez
// de 5 reduz o pior caso de tempo total de execução, mantendo folga
// confortável dentro do maxDuration da rota (ver Decisões Tomadas).
const MIN_SLIDES = 3;
const MAX_SLIDES = 4;
const LIMITE_CARACTERES_SLIDE = 200;

const SYSTEM_PROMPT =
  "Você é um assistente de marketing que estrutura o conteúdo de um post em " +
  "um carrossel narrativo pra redes sociais, em português do Brasil. Gere " +
  `entre ${MIN_SLIDES} e ${MAX_SLIDES} slides que contam uma história com ` +
  "começo, meio e fim: um gancho forte no slide 1, desenvolvimento nos " +
  "slides do meio, e uma chamada pra ação clara no último slide. IMPORTANTE: " +
  "cada slide precisa ser uma frase ou pensamento COMPLETO, com informação " +
  "de verdade (um motivo, um dado, um detalhe concreto) — NUNCA só um " +
  "título ou manchete curta tipo 'Nosso aniversário!' ou 'Agradecemos a " +
  "todos'. Aproveite bem o espaço disponível em cada slide (até " +
  `${LIMITE_CARACTERES_SLIDE} caracteres), sem enrolação nem jargão técnico ` +
  "de marketing, mas também sem ser telegráfico demais. Responda " +
  "ESTRITAMENTE com um array JSON de strings, uma string por slide, na " +
  'ordem de exibição — ex.: ["texto completo do slide 1, com uma ideia de ' +
  'verdade", "texto completo do slide 2, desenvolvendo a próxima ideia", ' +
  '...]. Nada de texto antes ou depois do array, nada de markdown, só o ' +
  "array JSON puro.";

type ClienteEDna = {
  client: Pick<Client, "nome" | "empresa" | "segmento">;
  dna: Pick<ClientDna, "tom_de_voz" | "publico_alvo" | "produtos" | "cidade">;
};

type GerarCarrosselInput = ClienteEDna & {
  nomeEvento: string;
  dataEvento: string;
  // Post já aprovado (formato único, 280 caracteres — Fase 6): ponto de
  // partida narrativo pro carrossel, já que esse texto curto não tem
  // divisão natural em partes por si só.
  textoBase: string;
};

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

// Extrai o array JSON da resposta da Groq mesmo se vier cercado de texto ou
// cerca de código markdown (```json ... ```) — a instrução pede "só o
// array", mas LLMs nem sempre seguem à risca; pegar o primeiro bloco
// `[...]` da resposta é mais robusto que exigir que a resposta inteira seja
// JSON válido de cara.
function extrairSlides(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("Groq não retornou um array JSON de slides.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("Groq retornou um array JSON de slides malformado.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Groq retornou um array vazio ou inválido de slides.");
  }

  return parsed.map((item) => String(item).trim()).filter(Boolean);
}

// Pede à Groq pra estruturar o texto do post (já aprovado, formato único) em
// N slides narrativos pro formato Carrossel (Fase 12). Diferente de
// generatePostSuggestion/generateAdHocPostSuggestion (Fase 2/5), essa
// chamada não escreve o post do zero — ela EXPANDE um texto que já existe em
// uma sequência com começo/meio/fim, então tem prompt e parsing de resposta
// próprios (array JSON, não texto solto).
export async function generateCarouselSlides(input: GerarCarrosselInput): Promise<string[]> {
  const dnaLines = montarLinhasDna(input);
  const clienteLine = `Cliente: ${input.client.nome}${input.client.empresa ? ` (${input.client.empresa})` : ""}`;
  const eventoLine = `Data comemorativa: ${input.nomeEvento} (${formatarDataPtBr(input.dataEvento)})`;

  const userPrompt = [
    clienteLine,
    dnaLines,
    "",
    eventoLine,
    `Post original (base pra expandir em carrossel): "${input.textoBase}"`,
    "",
    "Transforme esse post em um carrossel narrativo, seguindo as instruções do sistema.",
  ].join("\n");

  const resposta = await groqChatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  return extrairSlides(resposta);
}
