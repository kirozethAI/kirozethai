import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { pickRandomTemplate } from "@/lib/render/templates";
import { renderHtmlToPngBuffer } from "@/lib/render/generate-image";
import { uploadPostImage, getPublicImageUrl } from "@/lib/render/upload-image";
import { getPublicLogoUrl } from "@/lib/render/upload-logo";

export type ResultadoGeracaoImagem = {
  path: string;
  url: string;
};

// Gera (ou regera) a imagem de um content_calendar já aprovado: monta o
// template HTML com o texto + dados do cliente, renderiza via Puppeteer,
// sobe pro Storage e salva o path em content_calendar.imagem_gerada.
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

  const template = pickRandomTemplate();
  const html = template.render({
    texto: evento.sugestao_texto,
    nomeMarca: client.empresa ?? client.nome,
    dataEvento: evento.data_evento,
    corPrimaria: visualDna?.cor_primaria,
    corSecundaria: visualDna?.cor_secundaria,
    logoUrl: visualDna?.logo_url ? getPublicLogoUrl(visualDna.logo_url) : null,
  });

  console.log(`[render] Template escolhido pro evento ${contentCalendarId}: "${template.id}"`);

  const buffer = await renderHtmlToPngBuffer(html);
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
