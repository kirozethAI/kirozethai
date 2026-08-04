import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateQuestionsForNewClient } from "@/lib/questions-engine";

// Converte um lead num cliente de verdade (Fase 21, Etapa 6). Chamada de
// 2 lugares: automaticamente quando um lead é movido pro estágio
// tipo_final='ganho' (moveLeadStageAction) e explicitamente pelo botão
// "Converter em cliente" na ficha do lead (convertLeadToClientAction) —
// ambos passam pela MESMA função, sem duplicar a lógica.
//
// IDEMPOTENTE: se o lead JÁ tem client_id preenchido (já foi convertido
// antes), retorna o client_id existente sem criar um cliente duplicado —
// decisão explícita pedida no escopo. Isso cobre tanto o caso de
// clicar "Converter" 2x quanto o de mover um lead já convertido de volta
// pro estágio de ganho (ex.: reaberto e refechado).
export async function convertLeadToClient(
  supabase: SupabaseClient<Database>,
  leadId: string
): Promise<{ clientId: string; jaConvertido: boolean }> {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, nome, empresa, segmento, client_id")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(leadError?.message ?? "Lead não encontrado.");
  }

  if (lead.client_id) {
    return { clientId: lead.client_id, jaConvertido: true };
  }

  // Insere em `clients` — o trigger handle_new_client() (Fase 1,
  // INTOCADO) cria client_dna + conversation ativa automaticamente.
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      nome: lead.nome,
      empresa: lead.empresa,
      segmento: lead.segmento,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error(`Não foi possível criar o cliente a partir do lead: ${clientError?.message}`);
  }

  // Mesma função usada por createClientAction (Fase 1) — não duplica a
  // lógica do motor de perguntas, só reaproveita.
  await generateQuestionsForNewClient(supabase, client.id);

  const { error: updateError } = await supabase
    .from("leads")
    .update({ client_id: client.id, atualizado_em: new Date().toISOString() })
    .eq("id", leadId);

  if (updateError) {
    throw new Error(`Cliente criado, mas não foi possível vincular o lead: ${updateError.message}`);
  }

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    tipo: "nota",
    descricao: "Lead convertido em cliente.",
  });

  return { clientId: client.id, jaConvertido: false };
}
