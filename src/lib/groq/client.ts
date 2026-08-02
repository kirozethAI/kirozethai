const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

type GroqRole = "system" | "user" | "assistant";

export type GroqMessage = {
  role: GroqRole;
  content: string;
};

type GroqChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

// Chama o endpoint de chat completions da Groq (compatível com a API da
// OpenAI). O nome do modelo NUNCA é hardcoded aqui — vem de GROQ_MODEL, pra
// não quebrar quando a Groq depreciar um modelo.
export async function groqChatCompletion(
  messages: GroqMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;

  if (!apiKey) throw new Error("GROQ_API_KEY não configurada em .env.local.");
  if (!model) throw new Error("GROQ_MODEL não configurada em .env.local.");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Groq API respondeu ${res.status}: ${corpo}`);
  }

  const json = (await res.json()) as GroqChatCompletionResponse;
  const conteudo = json.choices?.[0]?.message?.content;

  if (!conteudo) {
    throw new Error("Groq API não retornou conteúdo na resposta.");
  }

  return conteudo.trim();
}
