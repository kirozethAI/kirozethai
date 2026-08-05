"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { analisarImagemPost, type AnaliseNeuroScore } from "@/lib/neuroscore/analyze-image";
import {
  uploadEvaluationImage,
  getPublicEvaluationImageUrl,
} from "@/lib/neuroscore/upload-evaluation-image";
import { screenshotUrlToPngBuffer } from "@/lib/neuroscore/screenshot-url";
import { validarUrlPublica } from "@/lib/neuroscore/validate-url";

const IMAGEM_MAX_BYTES = 8 * 1024 * 1024; // 8MB
const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type ResultadoAvaliacaoAvulsa = {
  id: string;
  imagemUrl: string;
  analise: AnaliseNeuroScore;
};

async function salvarAvaliacao(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    origem: "upload_manual" | "landing_page";
    clientId: string | null;
    imagemUrl: string;
    urlOriginal: string | null;
    analise: AnaliseNeuroScore;
  }
): Promise<ResultadoAvaliacaoAvulsa> {
  const { data, error } = await supabase
    .from("neuroscore_evaluations")
    .insert({
      client_id: input.clientId,
      origem: input.origem,
      content_calendar_id: null,
      tentativa_numero: 1,
      imagem_avaliada_url: input.imagemUrl,
      url_original: input.urlOriginal,
      nota_geral: input.analise.notaGeral,
      gancho_inicial: input.analise.ganchoInicial,
      gatilhos_desejo: input.analise.gatilhosDesejo,
      fatores_retencao: input.analise.fatoresRetencao,
      fatores_algoritmo: input.analise.fatoresAlgoritmo,
      pontos_fracos: input.analise.pontosFracos,
      sugestoes: input.analise.sugestoes,
      probabilidade_conversao_estimada: input.analise.probabilidadeConversaoEstimada,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível salvar a avaliação.");
  }

  revalidatePath("/neuroscore");

  return { id: data.id, imagemUrl: input.imagemUrl, analise: input.analise };
}

// Avaliação avulsa de uma imagem enviada manualmente (Fase 22, Etapa 5) —
// SEM loop de regeneração (não tem o que regenerar, é conteúdo externo),
// só avalia e mostra o resultado com todas as dimensões.
export async function evaluateUploadedImageAction(
  formData: FormData
): Promise<ResultadoAvaliacaoAvulsa> {
  const supabase = await createSupabaseServerClient();

  const imagem = formData.get("imagem");
  if (!(imagem instanceof File) || imagem.size === 0) {
    throw new Error("Selecione uma imagem.");
  }
  if (imagem.size > IMAGEM_MAX_BYTES) {
    throw new Error("A imagem é muito grande — o limite é 8MB.");
  }
  const extensao = EXTENSAO_POR_TIPO[imagem.type];
  if (!extensao) {
    throw new Error("Formato não suportado — envie PNG, JPG ou WEBP.");
  }

  const clientId = (formData.get("clientId") ?? "").toString() || null;

  const buffer = Buffer.from(await imagem.arrayBuffer());
  const path = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
  await uploadEvaluationImage(supabase, path, buffer, imagem.type);
  const imagemUrl = getPublicEvaluationImageUrl(path);

  const analise = await analisarImagemPost(imagemUrl);

  return salvarAvaliacao(supabase, {
    origem: "upload_manual",
    clientId,
    imagemUrl,
    urlOriginal: null,
    analise,
  });
}

// Avaliação avulsa de uma landing page via URL (Fase 22, Etapa 5) — tira
// um screenshot real (Puppeteer, reaproveitando o mesmo motor de browser
// da Fase 3/15) e avalia esse screenshot. Também sem loop de regeneração.
export async function evaluateLandingPageAction(input: {
  url: string;
  clientId: string;
}): Promise<ResultadoAvaliacaoAvulsa> {
  const supabase = await createSupabaseServerClient();

  const url = validarUrlPublica(input.url);
  const clientId = input.clientId || null;

  const buffer = await screenshotUrlToPngBuffer(url.toString());
  const path = `landing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  await uploadEvaluationImage(supabase, path, buffer, "image/png");
  const imagemUrl = getPublicEvaluationImageUrl(path);

  const analise = await analisarImagemPost(imagemUrl);

  return salvarAvaliacao(supabase, {
    origem: "landing_page",
    clientId,
    imagemUrl,
    urlOriginal: url.toString(),
    analise,
  });
}
