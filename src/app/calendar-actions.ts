"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { syncNationalHolidays } from "@/lib/calendar/holidays-sync";
import { runCalendarEngine } from "@/lib/calendar/calendar-engine";
import { generateSuggestionsForPending } from "@/lib/calendar/generate-suggestions";
import { generateImageForApprovedPost } from "@/lib/render/generate-post-image";

// Dispara manualmente a sincronização de feriados nacionais (ano atual +
// próximo, pra cobrir a virada do ano). Chamada pelo botão "Sincronizar
// feriados" na home — nesta fase não há cron real (ver Decisões Tomadas).
export async function syncHolidaysAction() {
  const supabase = await createSupabaseServerClient();
  const anoAtual = new Date().getFullYear();

  const resultado = await syncNationalHolidays(supabase, [anoAtual, anoAtual + 1]);

  revalidatePath("/");
  return resultado;
}

// Roda o motor de detecção de datas + geração de sugestões via Groq pra um
// cliente específico (ou todos, se clientId for omitido). Chamada pelo botão
// "Verificar datas comemorativas" na tela do cliente.
export async function checkCalendarAction(clientId?: string) {
  const supabase = await createSupabaseServerClient();

  const deteccao = await runCalendarEngine(supabase, { clientId });
  const geracao = await generateSuggestionsForPending(supabase, { clientId });

  if (clientId) {
    revalidatePath(`/clientes/${clientId}`);
  }

  return { deteccao, geracao };
}

// Gera (ou regera) a imagem de um post aprovado. A geração já roda
// automaticamente logo após a aprovação no chat (ver handleSuggestionReply
// em src/lib/calendar/handle-reply.ts) — esta action existe como fallback
// manual, exposta pelo botão "Gerar imagem" na tela do cliente, pro caso da
// geração automática falhar (ex.: Puppeteer indisponível no momento).
export async function generateImageAction(input: { contentCalendarId: string; clientId: string }) {
  const supabase = await createSupabaseServerClient();

  const resultado = await generateImageForApprovedPost(supabase, input.contentCalendarId);

  revalidatePath(`/clientes/${input.clientId}`);
  return resultado;
}
