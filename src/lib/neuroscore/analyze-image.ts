import { groqVisionCompletion } from "./groq-vision-client";

export type FatorAvaliado = { fator: string; avaliacao: string };

export type AnaliseNeuroScore = {
  notaGeral: number;
  ganchoInicial: string;
  gatilhosDesejo: FatorAvaliado[];
  fatoresRetencao: FatorAvaliado[];
  fatoresAlgoritmo: FatorAvaliado[];
  pontosFracos: string[];
  sugestoes: string[];
  probabilidadeConversaoEstimada: string;
};

// Prompt único reaproveitado pelo loop de qualidade (Etapa 4) e pela
// avaliação avulsa (Etapa 5) — mesma pergunta, mesmo formato de saída,
// independente da imagem vir de um post gerado, upload manual ou
// screenshot de landing page. Reforça explicitamente que é uma
// ESTIMATIVA HEURÍSTICA (nunca dado real de plataforma) — pedido
// explícito do escopo, repetido também na UI (nunca só no prompt).
const PROMPT = `Você avalia uma imagem (post de rede social ou landing page) sob a ótica de psicologia de persuasão e potencial de engajamento em feed. Isso é uma ESTIMATIVA HEURÍSTICA de apoio à decisão, não uma medição real de atenção nem dado estatístico de nenhuma plataforma.

Analise a imagem considerando:
- Gancho inicial: a primeira impressão captura atenção nos primeiros segundos de scroll/visualização?
- Gatilhos de desejo: presença de gatilhos de persuasão REAIS (urgência, escassez, prova social, autoridade, aspiração, curiosidade) — avalie só o que está genuinamente presente, nunca invente um gatilho que não aparece
- Fatores de retenção: elementos que mantêm o olhar na peça (hierarquia visual, contraste, legibilidade, composição)
- Fatores de algoritmo: características que HEURISTICAMENTE tendem a favorecer engajamento em feeds (legibilidade rápida, contraste, ausência de poluição visual) — não é dado real de nenhum algoritmo de plataforma, é só um palpite educado

Responda APENAS com um JSON válido, sem nenhum texto fora dele, no formato exato:
{
  "nota_geral": <número de 0 a 10, pode ter 1 casa decimal>,
  "gancho_inicial": "<avaliação curta do gancho inicial, 1 frase>",
  "gatilhos_desejo": [{"fator": "<nome do gatilho>", "avaliacao": "<presente ou ausente, e por quê, 1 frase>"}],
  "fatores_retencao": [{"fator": "<nome do fator>", "avaliacao": "<comentário curto>"}],
  "fatores_algoritmo": [{"fator": "<nome do fator>", "avaliacao": "<comentário curto>"}],
  "pontos_fracos": ["<ponto fraco 1>", "..."],
  "sugestoes": ["<sugestão de melhoria 1>", "..."],
  "probabilidade_conversao_estimada": "<baixa, média ou alta>"
}`;

function paraFatores(valor: unknown): FatorAvaliado[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      fator: typeof item.fator === "string" ? item.fator : "—",
      avaliacao: typeof item.avaliacao === "string" ? item.avaliacao : "—",
    }));
}

function paraLista(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === "string");
}

// Chama a Groq vision com o prompt padrão e faz o parsing robusto da
// resposta (extrai o primeiro bloco {...} mesmo se vier cercado de texto
// ou cerca de markdown — mesmo padrão já usado no carrossel/Fase 12 e no
// compliance/Fase 20 — e valida cada campo individualmente, sem derrubar
// a análise inteira por causa de 1 campo com shape inesperado).
export async function analisarImagemPost(imageUrl: string): Promise<AnaliseNeuroScore> {
  const resposta = await groqVisionCompletion(PROMPT, imageUrl);

  const match = resposta.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Resposta da Groq Vision sem JSON reconhecível: ${resposta.slice(0, 200)}`);
  }

  const parsed = JSON.parse(match[0]) as Record<string, unknown>;

  const notaGeral = Number(parsed.nota_geral);
  if (!Number.isFinite(notaGeral)) {
    throw new Error("Groq Vision não retornou 'nota_geral' numérica válida.");
  }

  return {
    notaGeral,
    ganchoInicial: typeof parsed.gancho_inicial === "string" ? parsed.gancho_inicial : "",
    gatilhosDesejo: paraFatores(parsed.gatilhos_desejo),
    fatoresRetencao: paraFatores(parsed.fatores_retencao),
    fatoresAlgoritmo: paraFatores(parsed.fatores_algoritmo),
    pontosFracos: paraLista(parsed.pontos_fracos),
    sugestoes: paraLista(parsed.sugestoes),
    probabilidadeConversaoEstimada:
      typeof parsed.probabilidade_conversao_estimada === "string"
        ? parsed.probabilidade_conversao_estimada
        : "não informada",
  };
}
