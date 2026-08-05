import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  generateImageForApprovedPost,
  renderPostImageBuffer,
  type ResultadoGeracaoImagem,
} from "@/lib/render/generate-post-image";
import { uploadPostImage, getPublicImageUrl } from "@/lib/render/upload-image";
import { generatePostSuggestion } from "@/lib/groq/post-suggestion";
import { analisarImagemPost, type AnaliseNeuroScore } from "@/lib/neuroscore/analyze-image";
import { verificarCompliancePost } from "@/lib/compliance/check-content";
import { registrarHistoricoStatus } from "@/lib/calendar/history";

const NOTA_MINIMA = 7;
const MAX_TENTATIVAS = 3;

export type ResultadoLoopQualidade = ResultadoGeracaoImagem & {
  // false = a avaliação visual não pôde rodar (Groq vision indisponível
  // etc.) — a imagem ainda foi gerada normalmente (fallback pro caminho
  // simples de antes da Fase 22), só sem NeuroScore. Nunca bloqueia a
  // entrega da imagem por causa disso (ver Decisões Tomadas).
  avaliado: boolean;
  notaFinal: number | null;
  tentativas: number;
  atingiuMinimo: boolean;
};

type Candidato = {
  tentativa: number;
  texto: string;
  buffer: Buffer;
  avaliacao: AnaliseNeuroScore;
};

// Resume os pontos fracos/sugestões de uma tentativa reprovada num
// feedback curto, reaproveitado pelo MESMO mecanismo de "ajuste" que já
// existe em generatePostSuggestion (sugestaoAnterior + feedbackAjuste,
// Fase 2/3) — não é um prompt novo, é o mesmo caminho de reescrita que o
// usuário aciona no chat, só que o "pedido de ajuste" vem da avaliação
// visual em vez de uma mensagem humana.
function sintetizarFeedback(avaliacao: AnaliseNeuroScore): string {
  const pontos = avaliacao.pontosFracos.slice(0, 3).join("; ") || "sem detalhamento específico";
  const sugestoes = avaliacao.sugestoes.slice(0, 2).join("; ") || "nenhuma sugestão específica";
  return (
    `Uma avaliação visual encontrou estes pontos fracos: ${pontos}. ` +
    `Sugestões de melhoria: ${sugestoes}. Reescreva incorporando essas ` +
    `melhorias, mantendo o mesmo tema e contexto.`
  );
}

// Loop de qualidade do NeuroScore (Fase 22, Etapa 4) — substitui a
// chamada direta a generateImageForApprovedPost no fluxo de aprovação
// (handleSuggestionReply) e no fallback manual do botão "Gerar imagem"
// (calendar-actions.ts). Fluxo por tentativa (máximo 3, nunca mais):
// gera/reescreve texto → renderiza → avalia via Groq vision → nota >= 7
// encerra com sucesso; nota < 7 com tentativas restantes tenta de novo
// incorporando os pontos fracos; esgotadas as 3 tentativas sem atingir a
// nota mínima, usa a de MAIOR nota entre as testadas — nunca trava nem
// inventa nota. Se o loop inteiro falhar (ex.: Groq vision fora do ar),
// cai pro caminho simples de sempre (generateImageForApprovedPost, sem
// avaliação) — a imagem NUNCA deixa de ser gerada por causa do
// NeuroScore (ver Decisões Tomadas).
export async function generateImageWithQualityLoop(
  supabase: SupabaseClient<Database>,
  contentCalendarId: string
): Promise<ResultadoLoopQualidade> {
  try {
    const { data: evento, error: eventoError } = await supabase
      .from("content_calendar")
      .select("*")
      .eq("id", contentCalendarId)
      .single();

    if (eventoError || !evento) throw new Error(eventoError?.message ?? "Evento não encontrado.");
    if (evento.status !== "aprovado") throw new Error("Só é possível gerar imagem de um post aprovado.");
    if (!evento.sugestao_texto) throw new Error("Esse evento não tem texto de sugestão.");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("nome, empresa, segmento")
      .eq("id", evento.client_id)
      .single();
    if (clientError || !client) throw new Error(clientError?.message ?? "Cliente não encontrado.");

    const { data: dna, error: dnaError } = await supabase
      .from("client_dna")
      .select("tom_de_voz, publico_alvo, produtos, cidade")
      .eq("client_id", evento.client_id)
      .single();
    if (dnaError || !dna) throw new Error(dnaError?.message ?? "client_dna não encontrado.");

    const candidatos: Candidato[] = [];
    let textoAtual = evento.sugestao_texto;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      const { buffer } = await renderPostImageBuffer(supabase, evento, client, textoAtual);

      // Cada tentativa sobe pra um path PRÓPRIO (não o path definitivo
      // <id>.png ainda) — a Groq vision precisa de uma URL pública pra
      // buscar a imagem, e só depois de escolher a vencedora é que ela
      // é subida pro path final (ver abaixo). Evita que uma tentativa
      // reprovada fique momentaneamente "publicada" no lugar da imagem
      // oficial do post.
      const pathTentativa = `${contentCalendarId}-neuroscore-tentativa-${tentativa}.png`;
      await uploadPostImage(supabase, pathTentativa, buffer);
      const urlTentativa = getPublicImageUrl(pathTentativa, `${Date.now()}`);

      const avaliacao = await analisarImagemPost(urlTentativa);
      candidatos.push({ tentativa, texto: textoAtual, buffer, avaliacao });

      console.log(
        `[neuroscore] Evento ${contentCalendarId}, tentativa ${tentativa}: nota ${avaliacao.notaGeral}`
      );

      if (avaliacao.notaGeral >= NOTA_MINIMA) break;
      if (tentativa === MAX_TENTATIVAS) break;

      textoAtual = await generatePostSuggestion({
        client,
        dna,
        evento,
        sugestaoAnterior: textoAtual,
        feedbackAjuste: sintetizarFeedback(avaliacao),
      });
    }

    const vencedor =
      candidatos.find((c) => c.avaliacao.notaGeral >= NOTA_MINIMA) ??
      candidatos.reduce((melhor, atual) => (atual.avaliacao.notaGeral > melhor.avaliacao.notaGeral ? atual : melhor));

    const pathFinal = `${contentCalendarId}.png`;
    await uploadPostImage(supabase, pathFinal, vencedor.buffer);

    // Se a tentativa vencedora reescreveu o texto (não foi a 1ª, que
    // sempre começa com o texto JÁ aprovado no chat), atualiza
    // sugestao_texto + re-roda compliance (Fase 20, independente do
    // NeuroScore) pro texto final, e registra no histórico auditável
    // (Fase 7) que o texto foi revisado enquanto já aprovado — nunca
    // muda silenciosamente sem deixar rastro.
    const textoMudou = vencedor.texto !== evento.sugestao_texto;
    const agora = new Date().toISOString();

    if (textoMudou) {
      let complianceAlertas = evento.compliance_alertas;
      try {
        const novaChecagem = await verificarCompliancePost(supabase, client.segmento, vencedor.texto);
        if (novaChecagem !== null) complianceAlertas = novaChecagem;
      } catch (complianceErr) {
        console.warn(
          `[neuroscore] Falha ao re-checar compliance pro texto revisado do evento ${contentCalendarId}:`,
          complianceErr
        );
      }

      await supabase
        .from("content_calendar")
        .update({
          sugestao_texto: vencedor.texto,
          compliance_alertas: complianceAlertas,
          imagem_gerada: pathFinal,
          imagem_gerada_em: agora,
        })
        .eq("id", contentCalendarId);

      await registrarHistoricoStatus(supabase, {
        contentCalendarId,
        statusAnterior: "aprovado",
        statusNovo: "aprovado",
        textoNoMomento: vencedor.texto,
        origem: "neuroscore_loop",
      });
    } else {
      await supabase
        .from("content_calendar")
        .update({ imagem_gerada: pathFinal, imagem_gerada_em: agora })
        .eq("id", contentCalendarId);
    }

    const urlFinal = getPublicImageUrl(pathFinal, agora);

    await supabase.from("neuroscore_evaluations").insert({
      client_id: evento.client_id,
      origem: "post_gerado",
      content_calendar_id: contentCalendarId,
      tentativa_numero: vencedor.tentativa,
      imagem_avaliada_url: urlFinal,
      nota_geral: vencedor.avaliacao.notaGeral,
      gancho_inicial: vencedor.avaliacao.ganchoInicial,
      gatilhos_desejo: vencedor.avaliacao.gatilhosDesejo,
      fatores_retencao: vencedor.avaliacao.fatoresRetencao,
      fatores_algoritmo: vencedor.avaliacao.fatoresAlgoritmo,
      pontos_fracos: vencedor.avaliacao.pontosFracos,
      sugestoes: vencedor.avaliacao.sugestoes,
      probabilidade_conversao_estimada: vencedor.avaliacao.probabilidadeConversaoEstimada,
    });

    return {
      path: pathFinal,
      url: urlFinal,
      avaliado: true,
      notaFinal: vencedor.avaliacao.notaGeral,
      tentativas: candidatos.length,
      atingiuMinimo: vencedor.avaliacao.notaGeral >= NOTA_MINIMA,
    };
  } catch (err) {
    console.warn(
      `[neuroscore] Loop de qualidade falhou pro evento ${contentCalendarId} — caindo pro caminho simples sem avaliação:`,
      err
    );
    const resultadoSimples = await generateImageForApprovedPost(supabase, contentCalendarId);
    return { ...resultadoSimples, avaliado: false, notaFinal: null, tentativas: 0, atingiuMinimo: false };
  }
}
