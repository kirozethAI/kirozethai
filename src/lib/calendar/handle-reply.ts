import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generatePostSuggestion } from "@/lib/groq/post-suggestion";
import { formatSuggestionMessage, parseSuggestionReply } from "@/lib/calendar/messages";
import { generateImageForApprovedPost } from "@/lib/render/generate-post-image";
import { registrarHistoricoStatus } from "@/lib/calendar/history";
import {
  verificarCompliancePost,
  formatComplianceWarning,
  type ComplianceAlerta,
} from "@/lib/compliance/check-content";

type Input = {
  clientId: string;
  conversationId: string;
  texto: string;
};

// Se houver uma sugestão de post pendente de decisão (status 'sugerido' ou
// 'ajustado') pra esse cliente, interpreta a resposta do usuário no chat:
// aprovação, rejeição, ou (qualquer outra coisa) pedido de ajuste — nesse
// caso a sugestão é regerada via Groq com o feedback do usuário. Retorna
// true se consumiu a mensagem (havia sugestão pendente), false caso
// contrário — quem chama decide o que fazer no caso "não consumiu".
export async function handleSuggestionReply(
  supabase: SupabaseClient<Database>,
  { clientId, conversationId, texto }: Input
): Promise<boolean> {
  const { data: pendente, error: pendenteError } = await supabase
    .from("content_calendar")
    .select("*")
    .eq("client_id", clientId)
    .in("status", ["sugerido", "ajustado"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pendenteError) {
    throw new Error(`Não foi possível checar sugestões pendentes: ${pendenteError.message}`);
  }

  if (!pendente) return false;

  const decisao = parseSuggestionReply(texto);

  if (decisao === "aprovado") {
    const { error } = await supabase
      .from("content_calendar")
      .update({ status: "aprovado" })
      .eq("id", pendente.id);
    if (error) throw new Error(`Não foi possível aprovar a sugestão: ${error.message}`);

    await registrarHistoricoStatus(supabase, {
      contentCalendarId: pendente.id,
      statusAnterior: pendente.status,
      statusNovo: "aprovado",
      textoNoMomento: pendente.sugestao_texto,
    });

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      remetente: "ia",
      conteudo: "Show, aprovado! Já marquei esse post como pronto pra publicar.",
    });

    // Gera a imagem automaticamente após aprovar. Falha aqui não deve
    // quebrar o fluxo de aprovação — o usuário ainda tem o botão "Gerar
    // imagem" na tela do cliente como retry manual (ver ApprovedPosts).
    try {
      await generateImageForApprovedPost(supabase, pendente.id);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        remetente: "ia",
        conteudo:
          'Já gerei a imagem desse post também — dá pra baixar na tela do cliente, na seção "Posts aprovados".',
      });
    } catch (err) {
      console.error(`[render] Falha ao gerar imagem automaticamente pro evento ${pendente.id}:`, err);
    }

    return true;
  }

  if (decisao === "rejeitado") {
    const { error } = await supabase
      .from("content_calendar")
      .update({ status: "rejeitado" })
      .eq("id", pendente.id);
    if (error) throw new Error(`Não foi possível rejeitar a sugestão: ${error.message}`);

    await registrarHistoricoStatus(supabase, {
      contentCalendarId: pendente.id,
      statusAnterior: pendente.status,
      statusNovo: "rejeitado",
      textoNoMomento: pendente.sugestao_texto,
    });

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      remetente: "ia",
      conteudo: "Sem problema, descartei essa sugestão.",
    });
    return true;
  }

  // Ajuste: regera o texto via Groq usando o feedback do usuário.
  try {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("nome, empresa, segmento")
      .eq("id", clientId)
      .single();

    const { data: dna, error: dnaError } = await supabase
      .from("client_dna")
      .select("tom_de_voz, publico_alvo, produtos, cidade")
      .eq("client_id", clientId)
      .single();

    if (clientError || !client) throw new Error(clientError?.message ?? "cliente não encontrado");
    if (dnaError || !dna) throw new Error(dnaError?.message ?? "client_dna não encontrado");

    const novoTexto = await generatePostSuggestion({
      client,
      dna,
      evento: pendente,
      sugestaoAnterior: pendente.sugestao_texto ?? undefined,
      feedbackAjuste: texto,
    });

    // Checagem de compliance (Fase 20) no texto AJUSTADO também — o texto
    // novo substitui o anterior, então o snapshot de alertas acompanha
    // (um ajuste pode tanto resolver um alerta quanto introduzir um).
    // Falha aqui nunca derruba o ajuste.
    let complianceAlertas: ComplianceAlerta[] | null = null;
    try {
      complianceAlertas = await verificarCompliancePost(supabase, client.segmento, novoTexto);
    } catch (complianceErr) {
      console.warn(
        `[compliance] Falha na checagem do ajuste da sugestão ${pendente.id} (segue sem alerta):`,
        complianceErr
      );
    }

    const { error: updateError } = await supabase
      .from("content_calendar")
      .update({
        sugestao_texto: novoTexto,
        status: "ajustado",
        compliance_alertas: complianceAlertas,
      })
      .eq("id", pendente.id);
    if (updateError) throw new Error(updateError.message);

    await registrarHistoricoStatus(supabase, {
      contentCalendarId: pendente.id,
      statusAnterior: pendente.status,
      statusNovo: "ajustado",
      textoNoMomento: novoTexto,
    });

    const aviso =
      complianceAlertas && complianceAlertas.length > 0
        ? `\n\n${formatComplianceWarning(complianceAlertas)}`
        : "";
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      remetente: "ia",
      conteudo: formatSuggestionMessage(pendente, novoTexto) + aviso,
    });
  } catch (err) {
    console.error(`[calendar] Falha ao ajustar sugestão ${pendente.id}:`, err);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      remetente: "ia",
      conteudo:
        "Não consegui gerar o ajuste agora (problema temporário na geração de texto). " +
        "Pode tentar de novo em instantes?",
    });
  }

  return true;
}
