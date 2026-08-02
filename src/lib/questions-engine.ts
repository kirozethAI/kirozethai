import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { QUESTIONS_CATALOG, isFieldEmpty } from "@/lib/questions-catalog";

type Client = SupabaseClient<Database>;

// Roda uma vez ao cadastrar um cliente novo. Gera em questions_pending uma
// pergunta pra cada campo vazio de client_dna e publica a primeira delas
// como mensagem da IA na conversa ativa do cliente — as próximas perguntas
// vão sendo reveladas uma a uma conforme o usuário responde (ver
// answerNextPendingQuestion em chat-actions.ts).
export async function generateQuestionsForNewClient(
  supabase: Client,
  clientId: string
) {
  const { data: dna, error: dnaError } = await supabase
    .from("client_dna")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (dnaError || !dna) {
    throw new Error(`Não foi possível carregar client_dna: ${dnaError?.message}`);
  }

  const camposFaltando = QUESTIONS_CATALOG.filter((entry) =>
    isFieldEmpty(dna, entry.campo)
  );

  if (camposFaltando.length === 0) return;

  const { error: insertError } = await supabase.from("questions_pending").insert(
    camposFaltando.map((entry) => ({
      client_id: clientId,
      pergunta: entry.pergunta,
      contexto: entry.contexto,
      campo_relacionado: entry.campo,
    }))
  );

  if (insertError) {
    throw new Error(`Não foi possível criar as perguntas pendentes: ${insertError.message}`);
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "ativa")
    .single();

  if (convError || !conversation) {
    throw new Error(`Não foi possível localizar a conversa ativa: ${convError?.message}`);
  }

  const primeira = camposFaltando[0];

  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    remetente: "ia",
    conteudo: primeira.pergunta,
  });

  if (messageError) {
    throw new Error(`Não foi possível publicar a primeira pergunta no chat: ${messageError.message}`);
  }
}
