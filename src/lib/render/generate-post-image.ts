import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentCalendar, Client, Database } from "@/lib/supabase/types";
import { pickRandomTemplate } from "@/lib/render/templates";
import { renderHtmlToPngBuffer } from "@/lib/render/generate-image";
import { uploadPostImage, getPublicImageUrl } from "@/lib/render/upload-image";
import { getPublicLogoUrl } from "@/lib/render/upload-logo";
import { getDesignConfig } from "@/lib/render/design-config";

export type ResultadoGeracaoImagem = {
  path: string;
  url: string;
};

export type BufferRenderizado = {
  buffer: Buffer;
  templateId: string;
};

// Monta o template + renderiza via Puppeteer pro texto de um evento — SEM
// subir pro Storage nem tocar o banco. Extraído de
// generateImageForApprovedPost na Fase 22 pra ser reaproveitado pelo loop
// de qualidade do NeuroScore (generate-with-quality-loop.ts), que precisa
// renderizar VÁRIAS imagens candidatas (uma por tentativa) antes de
// decidir qual sobe pro path definitivo — sem essa extração, a lógica de
// template/identidade visual/design config teria que ser duplicada ali.
// `textoOverride` permite renderizar um texto diferente do salvo em
// `evento.sugestao_texto` (é o que o loop usa pra testar variantes);
// default é o texto do próprio evento, preservando o comportamento
// exato de antes da Fase 22 pra quem não passa esse parâmetro.
export async function renderPostImageBuffer(
  supabase: SupabaseClient<Database>,
  evento: Pick<ContentCalendar, "client_id" | "sugestao_texto" | "data_evento">,
  client: Pick<Client, "nome" | "empresa">,
  textoOverride?: string
): Promise<BufferRenderizado> {
  // Identidade visual é opcional — se a consulta falhar ou o cliente nunca
  // configurou marca, seguimos com o fallback genérico do template em vez
  // de quebrar a geração da imagem (que é o essencial).
  const { data: visualDna, error: visualDnaError } = await supabase
    .from("client_dna")
    .select("cor_primaria, cor_secundaria, logo_url")
    .eq("client_id", evento.client_id)
    .single();

  if (visualDnaError) {
    console.warn(
      `[render] Não foi possível carregar a identidade visual do cliente ${evento.client_id}, usando fallback:`,
      visualDnaError.message
    );
  }

  // Configuração de design (Fase 14) — busca uma vez por render; se falhar
  // por qualquer motivo, getDesignConfig já devolve os defaults hardcoded
  // da Fase 13 sozinha (nunca lança exceção), então a geração nunca quebra
  // por causa dela.
  const designConfig = await getDesignConfig(supabase);

  const template = pickRandomTemplate();
  const html = template.render({
    texto: textoOverride ?? evento.sugestao_texto ?? "",
    nomeMarca: client.empresa ?? client.nome,
    dataEvento: evento.data_evento,
    corPrimaria: visualDna?.cor_primaria,
    corSecundaria: visualDna?.cor_secundaria,
    logoUrl: visualDna?.logo_url ? getPublicLogoUrl(visualDna.logo_url) : null,
    designConfig,
  });

  const buffer = await renderHtmlToPngBuffer(html);
  return { buffer, templateId: template.id };
}

// Gera (ou regera) a imagem de um content_calendar já aprovado: monta o
// template HTML com o texto + dados do cliente, renderiza via Puppeteer,
// sobe pro Storage e salva o path em content_calendar.imagem_gerada.
// Comportamento IDÊNTICO ao de antes da Fase 22 (só a montagem/render
// virou a função renderPostImageBuffer acima, reaproveitada aqui) — quem
// já chamava esta função (botão manual "Gerar imagem", ver
// calendar-actions.ts) não precisa de nenhuma mudança.
export async function generateImageForApprovedPost(
  supabase: SupabaseClient<Database>,
  contentCalendarId: string
): Promise<ResultadoGeracaoImagem> {
  const { data: evento, error: eventoError } = await supabase
    .from("content_calendar")
    .select("*")
    .eq("id", contentCalendarId)
    .single();

  if (eventoError || !evento) {
    throw new Error(eventoError?.message ?? "Evento não encontrado.");
  }
  if (evento.status !== "aprovado") {
    throw new Error("Só é possível gerar imagem de um post aprovado.");
  }
  if (!evento.sugestao_texto) {
    throw new Error("Esse evento não tem texto de sugestão.");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("nome, empresa")
    .eq("id", evento.client_id)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "Cliente não encontrado.");
  }

  const { buffer, templateId } = await renderPostImageBuffer(supabase, evento, client);
  console.log(`[render] Template escolhido pro evento ${contentCalendarId}: "${templateId}"`);

  const path = `${contentCalendarId}.png`;
  await uploadPostImage(supabase, path, buffer);

  const { error: updateError } = await supabase
    .from("content_calendar")
    .update({ imagem_gerada: path, imagem_gerada_em: new Date().toISOString() })
    .eq("id", contentCalendarId);

  if (updateError) {
    throw new Error(`Não foi possível salvar a imagem gerada: ${updateError.message}`);
  }

  return { path, url: getPublicImageUrl(path) };
}
