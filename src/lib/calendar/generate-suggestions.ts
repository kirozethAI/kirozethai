import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generatePostSuggestion } from "@/lib/groq/post-suggestion";
import { formatSuggestionMessage } from "@/lib/calendar/messages";
import { registrarHistoricoStatus } from "@/lib/calendar/history";
import {
  verificarCompliancePost,
  formatComplianceWarning,
  type ComplianceAlerta,
} from "@/lib/compliance/check-content";

export type ResultadoGeracaoSugestoes = {
  total: number;
  geradas: number;
  falhas: number;
};

// Pra cada content_calendar com status 'pendente_geracao' (de um cliente
// específico ou de todos), gera o texto via Groq, salva em sugestao_texto,
// muda o status pra 'sugerido' e posta a sugestão como mensagem da IA na
// conversa ativa do cliente. Erros da API Groq (rate limit, modelo
// indisponível etc.) são capturados por evento — um evento com falha não
// derruba os outros, e a linha continua 'pendente_geracao' pra poder ser
// tentada de novo depois.
export async function generateSuggestionsForPending(
  supabase: SupabaseClient<Database>,
  opts?: { clientId?: string }
): Promise<ResultadoGeracaoSugestoes> {
  let query = supabase.from("content_calendar").select("*").eq("status", "pendente_geracao");
  if (opts?.clientId) query = query.eq("client_id", opts.clientId);

  const { data: pendentes, error } = await query;
  if (error) {
    throw new Error(`Não foi possível carregar eventos pendentes de geração: ${error.message}`);
  }

  let geradas = 0;
  let falhas = 0;

  for (const evento of pendentes ?? []) {
    try {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("nome, empresa, segmento")
        .eq("id", evento.client_id)
        .single();

      const { data: dna, error: dnaError } = await supabase
        .from("client_dna")
        .select("tom_de_voz, publico_alvo, produtos, cidade")
        .eq("client_id", evento.client_id)
        .single();

      if (clientError || !client) throw new Error(clientError?.message ?? "cliente não encontrado");
      if (dnaError || !dna) throw new Error(dnaError?.message ?? "client_dna não encontrado");

      const texto = await generatePostSuggestion({ client, dna, evento });

      // Checagem de compliance (Fase 20) — só roda pra cliente em nicho
      // regulado (retorna null sem custo pros demais). Falha aqui NUNCA
      // derruba a sugestão: é um alerta de apoio, não parte do fluxo —
      // e a ausência de alerta não significa conformidade.
      let complianceAlertas: ComplianceAlerta[] | null = null;
      try {
        complianceAlertas = await verificarCompliancePost(supabase, client.segmento, texto);
      } catch (complianceErr) {
        console.warn(
          `[compliance] Falha na checagem do evento ${evento.id} (sugestão segue sem alerta):`,
          complianceErr
        );
      }

      const { error: updateError } = await supabase
        .from("content_calendar")
        .update({ sugestao_texto: texto, status: "sugerido", compliance_alertas: complianceAlertas })
        .eq("id", evento.id);

      if (updateError) throw new Error(updateError.message);

      await registrarHistoricoStatus(supabase, {
        contentCalendarId: evento.id,
        statusAnterior: evento.status,
        statusNovo: "sugerido",
        textoNoMomento: texto,
      });

      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", evento.client_id)
        .eq("status", "ativa")
        .single();

      if (conversation) {
        const aviso =
          complianceAlertas && complianceAlertas.length > 0
            ? `\n\n${formatComplianceWarning(complianceAlertas)}`
            : "";
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          remetente: "ia",
          conteudo: formatSuggestionMessage(evento, texto) + aviso,
        });
      }

      geradas++;
    } catch (err) {
      falhas++;
      console.error(`[calendar] Falha ao gerar sugestão pro evento ${evento.id}:`, err);
    }
  }

  return { total: pendentes?.length ?? 0, geradas, falhas };
}
