"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { generateQuestionsForNewClient } from "@/lib/questions-engine";
import { isJsonbField, type CampoDna } from "@/lib/questions-catalog";
import { handleSuggestionReply } from "@/lib/calendar/handle-reply";
import { handleFreeMessage } from "@/lib/chat/handle-free-message";
import type { Database } from "@/lib/supabase/types";

type ClientDnaUpdate = Database["public"]["Tables"]["client_dna"]["Update"];

function toNullIfEmpty(value: FormDataEntryValue | null): string | null {
  const str = (value ?? "").toString().trim();
  return str.length === 0 ? null : str;
}

export async function createClientAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const nome = (formData.get("nome") ?? "").toString().trim();
  if (!nome) {
    throw new Error("Nome é obrigatório.");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      nome,
      empresa: toNullIfEmpty(formData.get("empresa")),
      segmento: toNullIfEmpty(formData.get("segmento")),
      aniversario_pessoal: toNullIfEmpty(formData.get("aniversario_pessoal")),
      aniversario_empresa: toNullIfEmpty(formData.get("aniversario_empresa")),
    })
    .select("id")
    .single();

  if (error || !client) {
    throw new Error(`Não foi possível criar o cliente: ${error?.message}`);
  }

  // O trigger handle_new_client() já criou client_dna + conversation ativa.
  await generateQuestionsForNewClient(supabase, client.id);

  revalidatePath("/");
  redirect(`/clientes/${client.id}`);
}

function wrapAnswerForField(campo: CampoDna, resposta: string): unknown {
  if (isJsonbField(campo)) {
    return campo === "concorrentes" ? [resposta] : { observacao: resposta };
  }
  if (campo === "ticket_medio" || campo === "margem") {
    const numero = Number(resposta.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(numero) ? numero : null;
  }
  return resposta;
}

// Envia uma mensagem do usuário no chat. Se houver uma pergunta pendente mais
// antiga, usa a resposta pra atualizar client_dna e marcar a pergunta como
// respondida, e revela a próxima pergunta pendente (se existir) como nova
// mensagem da IA.
export async function sendMessageAction(input: {
  clientId: string;
  conversationId: string;
  conteudo: string;
}) {
  const { clientId, conversationId, conteudo } = input;
  const texto = conteudo.trim();
  if (!texto) return;

  const supabase = await createSupabaseServerClient();

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    remetente: "usuario",
    conteudo: texto,
  });

  if (msgError) {
    throw new Error(`Não foi possível enviar a mensagem: ${msgError.message}`);
  }

  const { data: pergunta, error: pergError } = await supabase
    .from("questions_pending")
    .select("*")
    .eq("client_id", clientId)
    .eq("respondida", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pergError) {
    throw new Error(`Não foi possível checar perguntas pendentes: ${pergError.message}`);
  }

  if (pergunta && pergunta.campo_relacionado) {
    const campo = pergunta.campo_relacionado as CampoDna;

    const dnaUpdate: ClientDnaUpdate = { [campo]: wrapAnswerForField(campo, texto) };

    const { error: updateDnaError } = await supabase
      .from("client_dna")
      .update(dnaUpdate)
      .eq("client_id", clientId);

    if (updateDnaError) {
      throw new Error(`Não foi possível atualizar client_dna: ${updateDnaError.message}`);
    }

    const { error: updateQError } = await supabase
      .from("questions_pending")
      .update({ respondida: true, resposta: texto })
      .eq("id", pergunta.id);

    if (updateQError) {
      throw new Error(`Não foi possível marcar a pergunta como respondida: ${updateQError.message}`);
    }

    const { data: proxima } = await supabase
      .from("questions_pending")
      .select("pergunta")
      .eq("client_id", clientId)
      .eq("respondida", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (proxima) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        remetente: "ia",
        conteudo: proxima.pergunta,
      });
    }
  } else {
    // Nenhuma pergunta do motor de perguntas pendente — a mensagem pode ser
    // uma resposta (aprovar/ajustar/rejeitar) a uma sugestão de post do
    // calendário comemorativo (Fase 2). Se não havia sugestão pendente
    // também, cai na camada de conversa livre estruturada (Fase 5).
    const consumidaPelaSugestao = await handleSuggestionReply(supabase, {
      clientId,
      conversationId,
      texto,
    });

    if (!consumidaPelaSugestao) {
      await handleFreeMessage(supabase, { clientId, conversationId, texto });
    }
  }

  revalidatePath(`/clientes/${clientId}`);
}
