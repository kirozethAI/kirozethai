import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { renderStory } from "@/lib/render/templates/formatos/story";
import { renderHtmlToPngBuffer } from "@/lib/render/generate-image";
import { STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT } from "@/lib/render/templates/shared";
import { uploadPostImage, getPublicImageUrl } from "@/lib/render/upload-image";
import { getPublicLogoUrl } from "@/lib/render/upload-logo";

export type ResultadoGeracaoStory = {
  path: string;
  url: string;
};

// Gera (ou regera) a imagem em formato Story (1080x1920, Fase 12) de um
// content_calendar já aprovado. Mesmo padrão de generateImageForApprovedPost
// (Fase 3/10): busca dados, monta o template, renderiza via Puppeteer, sobe
// pro Storage — só que salva num path e em colunas separadas
// (story_imagem_gerada/story_imagem_gerada_em), independentes da imagem do
// formato post quadrado (imagem_gerada) — os dois formatos coexistem, gerar
// um não apaga nem substitui o outro.
export async function generateStoryForApprovedPost(
  supabase: SupabaseClient<Database>,
  contentCalendarId: string
): Promise<ResultadoGeracaoStory> {
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

  // Identidade visual é opcional — mesmo fallback do formato post quadrado
  // (Fase 3/4): sem client_dna configurado, o template cai pro fundo escuro
  // genérico em vez de quebrar a geração.
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

  const html = renderStory({
    texto: evento.sugestao_texto,
    nomeMarca: client.empresa ?? client.nome,
    dataEvento: evento.data_evento,
    corPrimaria: visualDna?.cor_primaria,
    corSecundaria: visualDna?.cor_secundaria,
    logoUrl: visualDna?.logo_url ? getPublicLogoUrl(visualDna.logo_url) : null,
  });

  const buffer = await renderHtmlToPngBuffer(html, STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT);
  const path = `${contentCalendarId}-story.png`;
  await uploadPostImage(supabase, path, buffer);

  const agora = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("content_calendar")
    .update({ story_imagem_gerada: path, story_imagem_gerada_em: agora })
    .eq("id", contentCalendarId);

  if (updateError) {
    throw new Error(`Não foi possível salvar o story gerado: ${updateError.message}`);
  }

  return { path, url: getPublicImageUrl(path, agora) };
}
