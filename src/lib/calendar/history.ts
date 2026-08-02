import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type StatusContentCalendar = Database["public"]["Tables"]["content_calendar"]["Row"]["status"];

type RegistrarHistoricoInput = {
  contentCalendarId: string;
  statusAnterior: StatusContentCalendar | null;
  statusNovo: StatusContentCalendar;
  textoNoMomento: string | null;
  origem?: string;
};

// Registra uma linha de histórico auditável em content_calendar_history. Deve
// ser chamado SEMPRE DEPOIS que a mudança de status em content_calendar já foi
// confirmada com sucesso (update ou insert) — nunca antes, pra nunca registrar
// uma mudança que na verdade não aconteceu (ver Decisões Tomadas da Fase 7 em
// PROGRESS.md). Falha aqui é só logada (console.error), não propagada: o
// registro auditável não deve quebrar o fluxo principal de aprovação/ajuste,
// mesmo padrão já usado pra geração de imagem em handle-reply.ts.
export async function registrarHistoricoStatus(
  supabase: SupabaseClient<Database>,
  { contentCalendarId, statusAnterior, statusNovo, textoNoMomento, origem = "chat" }: RegistrarHistoricoInput
): Promise<void> {
  const { error } = await supabase.from("content_calendar_history").insert({
    content_calendar_id: contentCalendarId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    texto_no_momento: textoNoMomento,
    origem,
  });

  if (error) {
    console.error(
      `[calendar] Falha ao registrar histórico de status (${statusAnterior ?? "novo"} -> ${statusNovo}) pro evento ${contentCalendarId}:`,
      error
    );
  }
}
