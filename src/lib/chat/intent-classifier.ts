import { groqChatCompletion } from "@/lib/groq/client";
import { normalize } from "@/lib/calendar/normalize";

// Categorias FECHADAS — este não é um assistente de propósito geral.
// Qualquer coisa que não se encaixe claramente numa das outras três cai em
// 'fora_de_escopo'.
export type Intent = "conteudo_avulso" | "pergunta_sobre_dna" | "saudacao" | "fora_de_escopo";

const SAUDACOES = [
  "oi",
  "ola",
  "opa",
  "eae",
  "e ai",
  "bom dia",
  "boa tarde",
  "boa noite",
  "tudo bem",
  "tudo bom",
  "como vai",
  "beleza",
  "salve",
  "fala",
];

// Checagem por palavra-chave ANTES de chamar a Groq — economiza uma
// chamada de API pros casos óbvios de cumprimento/small talk.
function isSaudacao(texto: string): boolean {
  const normalizado = normalize(texto).replace(/[!?.,]/g, "").trim();
  if (normalizado.length === 0 || normalizado.length > 40) return false;
  return SAUDACOES.some((s) => normalizado === s || normalizado.startsWith(`${s} `));
}

const SYSTEM_PROMPT = `Você classifica mensagens de clientes de uma agência de marketing em UMA categoria fechada. Categorias:

- conteudo_avulso: pedido pra gerar um post ou conteúdo novo, fora do calendário automático (ex.: "gera um post de parabéns pra mim", "faz uma sugestão pra hoje", "cria uma imagem sobre a promoção")
- pergunta_sobre_dna: pergunta sobre informação que já deveria estar cadastrada do próprio negócio do cliente (ex.: "qual minha meta?", "quem são meus concorrentes?", "quando é meu aniversário?")
- saudacao: cumprimento ou conversa informal sem pedido real
- fora_de_escopo: qualquer coisa que não se encaixe claramente nas categorias acima

Responda SOMENTE com o nome exato de uma dessas quatro categorias (conteudo_avulso, pergunta_sobre_dna, saudacao, ou fora_de_escopo). Nada mais — sem explicação, sem pontuação extra, sem aspas.`;

// Classifica uma mensagem livre do chat (fora dos fluxos estruturados de
// perguntas de DNA e sugestões de calendário) numa das 4 categorias
// fechadas. 'saudacao' é resolvida por palavra-chave sem gastar chamada de
// API; as outras 3 usam a Groq com temperature=0 (tarefa de classificação,
// não geração criativa) e um prompt que pede só o nome da categoria.
export async function classifyFreeMessage(texto: string): Promise<Intent> {
  if (isSaudacao(texto)) return "saudacao";

  const resposta = await groqChatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: texto },
    ],
    { temperature: 0 }
  );

  const normalizada = normalize(resposta);

  if (normalizada.includes("conteudo_avulso") || normalizada.includes("conteudo avulso")) {
    return "conteudo_avulso";
  }
  if (normalizada.includes("pergunta_sobre_dna") || normalizada.includes("pergunta sobre dna")) {
    return "pergunta_sobre_dna";
  }
  if (normalizada.includes("saudacao")) return "saudacao";

  return "fora_de_escopo";
}
