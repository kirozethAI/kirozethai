import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateCarouselSlides } from "@/lib/groq/carousel-suggestion";
import { renderCarrosselSlide } from "@/lib/render/templates/formatos/carrossel";
import { renderHtmlToPngBuffer } from "@/lib/render/generate-image";
import { uploadPostImage, getPublicImageUrl } from "@/lib/render/upload-image";
import { getPublicLogoUrl } from "@/lib/render/upload-logo";

export type ResultadoGeracaoCarrossel = {
  paths: string[];
  urls: string[];
};

// Gera (ou regera) o carrossel (Fase 12) de um content_calendar já aprovado:
// 1) pede à Groq pra estruturar o texto do post em N slides narrativos
// (generateCarouselSlides); 2) renderiza CADA slide como uma imagem
// 1080x1080 separada (mesmo motor de render dos outros formatos), numerada;
// 3) sobe todas pro Storage numa pasta própria por post
// (carrossel/<id>/slide-NN.png, mesmo bucket "post-images" — não criamos
// bucket novo, o path em subpasta já é suficiente) e salva o array de paths
// em content_calendar.carrossel_slides. Se falhar no meio do loop, os slides
// já enviados ficam órfãos no Storage (custo desprezível) mas
// carrossel_slides só é gravado no fim — sem estado parcial/inconsistente no
// banco; o usuário só vê "não gerado" e pode tentar de novo.
export async function generateCarouselForApprovedPost(
  supabase: SupabaseClient<Database>,
  contentCalendarId: string
): Promise<ResultadoGeracaoCarrossel> {
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
    .select("nome, empresa, segmento")
    .eq("id", evento.client_id)
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message ?? "Cliente não encontrado.");
  }

  // Uma única consulta cobre tanto o DNA de texto (pro prompt da Groq)
  // quanto a identidade visual (pro template) — mesma tabela client_dna dos
  // outros formatos. Opcional: sem client_dna configurado, cai pro fallback
  // (texto sem contexto extra de marca, template com cor genérica) em vez
  // de quebrar.
  const { data: dna, error: dnaError } = await supabase
    .from("client_dna")
    .select("tom_de_voz, publico_alvo, produtos, cidade, cor_primaria, cor_secundaria, logo_url")
    .eq("client_id", evento.client_id)
    .single();

  if (dnaError) {
    console.warn(
      `[render] Não foi possível carregar client_dna do cliente ${evento.client_id}, usando fallback:`,
      dnaError.message
    );
  }

  const slides = await generateCarouselSlides({
    client,
    dna: dna ?? { tom_de_voz: null, publico_alvo: null, produtos: null, cidade: null },
    nomeEvento: evento.nome_evento,
    dataEvento: evento.data_evento,
    textoBase: evento.sugestao_texto,
  });

  const logoUrl = dna?.logo_url ? getPublicLogoUrl(dna.logo_url) : null;
  const totalSlides = slides.length;
  const paths: string[] = [];

  for (let i = 0; i < totalSlides; i++) {
    const html = renderCarrosselSlide({
      texto: slides[i],
      nomeMarca: client.empresa ?? client.nome,
      dataEvento: evento.data_evento,
      corPrimaria: dna?.cor_primaria,
      corSecundaria: dna?.cor_secundaria,
      logoUrl,
      indiceSlide: i + 1,
      totalSlides,
    });

    const buffer = await renderHtmlToPngBuffer(html);
    const numero = String(i + 1).padStart(2, "0");
    const path = `carrossel/${contentCalendarId}/slide-${numero}.png`;
    await uploadPostImage(supabase, path, buffer);
    paths.push(path);
  }

  const agora = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("content_calendar")
    .update({ carrossel_slides: paths, carrossel_gerado_em: agora })
    .eq("id", contentCalendarId);

  if (updateError) {
    throw new Error(`Não foi possível salvar o carrossel gerado: ${updateError.message}`);
  }

  return { paths, urls: paths.map((path) => getPublicImageUrl(path, agora)) };
}
