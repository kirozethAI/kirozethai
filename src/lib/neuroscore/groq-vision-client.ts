const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Retry com backoff só pra 429 (rate limit) — achado real da Etapa 7: o
// modelo de visão tem um limite baixo de tokens/minuto no tier gratuito
// (8000 TPM observado), e cada imagem sozinha consome uma fração grande
// disso — o loop de qualidade (até 3 chamadas de visão em sequência,
// Etapa 4) esbarra nisso com facilidade. Sem retry, a 2ª ou 3ª tentativa
// do loop falharia com frequência real, não só em teoria. `Retry-After`
// (se a API mandar) ou a mensagem de erro ("Please try again em Xs") dão
// o tempo de espera; sem nenhum dos dois, um default fixo. Só 429 tem
// retry — qualquer outro erro (401, 500, imagem inválida) propaga na
// hora, sem re-tentar (não faz sentido re-tentar um erro que não é de
// limite de taxa).
const MAX_TENTATIVAS_RATE_LIMIT = 2;
const ESPERA_PADRAO_MS = 15000;

function extrairEsperaMs(corpo: string, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const segundos = Number(retryAfterHeader);
    if (Number.isFinite(segundos)) return Math.ceil(segundos * 1000);
  }
  const match = corpo.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000) + 500; // +500ms de folga
  return ESPERA_PADRAO_MS;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cliente de visão da Groq (Fase 22) — separado de src/lib/groq/client.ts
// porque o endpoint de vision usa um formato de `content` multimodal
// (array de blocos texto+imagem, imagem via URL pública) e
// `response_format: json_object`, diferente do chat de texto puro que
// groqChatCompletion (Fase 2) já cobre; nenhuma alteração feita naquele
// arquivo. Modelo SEMPRE via env var (GROQ_VISION_MODEL), nunca
// hardcoded — modelos de visão da Groq são rotulados "preview" e trocam
// com frequência (confirmado em console.groq.com/docs/vision no momento
// da implementação: qwen/qwen3.6-27b), mesmo cuidado já tomado com
// GROQ_MODEL desde a Fase 2.
export async function groqVisionCompletion(prompt: string, imageUrl: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_VISION_MODEL;

  if (!apiKey) throw new Error("GROQ_API_KEY não configurada em .env.local.");
  if (!model) throw new Error("GROQ_VISION_MODEL não configurada em .env.local.");

  for (let tentativa = 0; ; tentativa++) {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const conteudo = json.choices?.[0]?.message?.content;

      if (!conteudo) {
        throw new Error("Groq Vision API não retornou conteúdo na resposta.");
      }

      return conteudo.trim();
    }

    const corpo = await res.text();

    if (res.status === 429 && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
      const esperaMs = extrairEsperaMs(corpo, res.headers.get("retry-after"));
      console.warn(
        `[neuroscore] Groq Vision rate limit (tentativa ${tentativa + 1}/${MAX_TENTATIVAS_RATE_LIMIT}) — esperando ${esperaMs}ms antes de tentar de novo.`
      );
      await esperar(esperaMs);
      continue;
    }

    throw new Error(`Groq Vision API respondeu ${res.status}: ${corpo}`);
  }
}
