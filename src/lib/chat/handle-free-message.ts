import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { classifyFreeMessage } from "@/lib/chat/intent-classifier";
import { answerDnaQuestion } from "@/lib/chat/dna-answers";
import { generateAdHocPostSuggestion } from "@/lib/groq/post-suggestion";
import { registrarHistoricoStatus } from "@/lib/calendar/history";

type Input = {
  clientId: string;
  conversationId: string;
  texto: string;
};

const RESPOSTAS_SAUDACAO = [
  "Oi! Em que posso ajudar? Posso gerar sugestões de post, responder sobre o que sei do seu negócio, ou avisar quando tiver datas comemorativas chegando.",
  "Olá! Posso criar uma sugestão de post pra você, responder algo sobre o que já sei do seu negócio, ou ficar de olho nas datas comemorativas. É só pedir.",
];

const RESPOSTA_FORA_DE_ESCOPO =
  "Ainda não sei responder isso. Hoje eu consigo: gerar sugestões de post " +
  `(é só pedir, tipo "gera um post sobre X"), responder perguntas sobre o ` +
  "que já sei do seu negócio (meta, concorrentes, público-alvo, etc.), e " +
  "avisar quando tiver datas comemorativas chegando pra aprovar um post.";

function escolherSaudacao(): string {
  return RESPOSTAS_SAUDACAO[Math.floor(Math.random() * RESPOSTAS_SAUDACAO.length)];
}

// Mensagem de apresentação da sugestão avulsa — mesma ideia de
// formatSuggestionMessage (src/lib/calendar/messages.ts), mas sem a
// framing de "evento está chegando" (não é ligado a uma data específica).
function formatAdHocMessage(texto: string): string {
  return (
    `Aqui vai uma sugestão de post:\n\n"${texto}"\n\n` +
    `Quer aprovar, ajustar ou prefere não postar? Responda "aprovado", me diga o que mudar, ou "rejeitar".`
  );
}

async function criarConteudoAvulso(
  supabase: SupabaseClient<Database>,
  clientId: string,
  pedido: string
): Promise<string> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("nome, empresa, segmento")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "cliente não encontrado");
  }

  const { data: dna, error: dnaError } = await supabase
    .from("client_dna")
    .select("tom_de_voz, publico_alvo, produtos, cidade")
    .eq("client_id", clientId)
    .single();

  if (dnaError || !dna) {
    throw new Error(dnaError?.message ?? "client_dna não encontrado");
  }

  const texto = await generateAdHocPostSuggestion({ client, dna, pedido });

  const nomeEvento = pedido.length > 50 ? `Post avulso: ${pedido.slice(0, 50)}…` : `Post avulso: ${pedido}`;
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: novoEvento, error: insertError } = await supabase
    .from("content_calendar")
    .insert({
      client_id: clientId,
      data_evento: hoje,
      tipo_evento: "avulso",
      nome_evento: nomeEvento,
      sugestao_texto: texto,
      status: "sugerido",
    })
    .select("id")
    .single();

  if (insertError || !novoEvento) {
    throw new Error(`Não foi possível criar o post avulso: ${insertError?.message ?? "erro desconhecido"}`);
  }

  await registrarHistoricoStatus(supabase, {
    contentCalendarId: novoEvento.id,
    statusAnterior: null,
    statusNovo: "sugerido",
    textoNoMomento: texto,
  });

  return formatAdHocMessage(texto);
}

// Camada de conversa livre estruturada (Fase 5) — só é chamada quando NEM
// uma pergunta do motor de perguntas (Fase 1) NEM uma sugestão de
// calendário (Fase 2/3) estão pendentes pra esse cliente (ver
// sendMessageAction em src/app/actions.ts). Reconhece um conjunto FECHADO
// de 4 categorias via classifyFreeMessage — não é um assistente de
// propósito geral.
export async function handleFreeMessage(
  supabase: SupabaseClient<Database>,
  { clientId, conversationId, texto }: Input
): Promise<void> {
  let resposta: string;

  try {
    const intent = await classifyFreeMessage(texto);

    switch (intent) {
      case "saudacao":
        resposta = escolherSaudacao();
        break;

      case "pergunta_sobre_dna":
        resposta = (await answerDnaQuestion(supabase, clientId, texto)) ?? RESPOSTA_FORA_DE_ESCOPO;
        break;

      case "conteudo_avulso":
        resposta = await criarConteudoAvulso(supabase, clientId, texto);
        break;

      case "fora_de_escopo":
      default:
        resposta = RESPOSTA_FORA_DE_ESCOPO;
        break;
    }
  } catch (err) {
    console.error(`[chat] Falha ao processar mensagem livre do cliente ${clientId}:`, err);
    resposta = "Tive um problema pra processar isso agora. Pode tentar de novo em instantes?";
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    remetente: "ia",
    conteudo: resposta,
  });
}
