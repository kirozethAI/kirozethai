import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat-client";
import { CheckCalendarButton } from "@/components/check-calendar-button";
import { ApprovedPosts } from "@/components/approved-posts";
import { getPublicImageUrl } from "@/lib/render/upload-image";
import { formatarDataHoraPtBr } from "@/lib/calendar/format";

const STATUS_LABELS: Record<string, string> = {
  pendente_geracao: "Pendente de geração",
  sugerido: "Sugerido",
  ajustado: "Ajustado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

// Server Actions chamadas a partir desta rota (sendMessageAction via
// ChatClient — pode disparar geração de imagem automática ao aprovar;
// generateImageAction/generateStoryAction/generateCarouselAction via
// ApprovedPosts) rodam Puppeteer, que é mais lento em serverless que
// localmente (ver Decisões Tomadas da Fase 9). `maxDuration` de uma Server
// Action é herdado da rota que a invoca — não pode ser declarado no próprio
// arquivo "use server" (Next rejeita qualquer export que não seja uma função
// async ali), por isso fica aqui. Elevado de 60 pra 120 na Fase 12: o
// carrossel renderiza até 4 slides em sequência (generate-carousel.ts) +
// 1 chamada Groq antes disso — 60s (calibrado só pro post único/Story, 1
// render cada) não teria folga suficiente pro pior caso do carrossel.
// 120s ainda fica bem abaixo do teto de 300s do plano Hobby (Fase 9).
export const maxDuration = 120;

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, empresa")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", id)
    .eq("status", "ativa")
    .single();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, remetente, conteudo, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const { data: approvedPosts } = await supabase
    .from("content_calendar")
    .select(
      "id, nome_evento, sugestao_texto, imagem_gerada, imagem_gerada_em, story_imagem_gerada, story_imagem_gerada_em, carrossel_slides, carrossel_gerado_em"
    )
    .eq("client_id", id)
    .eq("status", "aprovado")
    .order("data_evento", { ascending: true });

  const approvedPostIds = (approvedPosts ?? []).map((post) => post.id);

  const { data: historico } =
    approvedPostIds.length > 0
      ? await supabase
          .from("content_calendar_history")
          .select("content_calendar_id, status_novo, texto_no_momento, created_at")
          .in("content_calendar_id", approvedPostIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const historicoPorPost = new Map<
    string,
    { status: string; texto: string | null; quando: string }[]
  >();
  for (const linha of historico ?? []) {
    const lista = historicoPorPost.get(linha.content_calendar_id) ?? [];
    lista.push({
      status: STATUS_LABELS[linha.status_novo] ?? linha.status_novo,
      texto: linha.texto_no_momento,
      quando: formatarDataHoraPtBr(linha.created_at),
    });
    historicoPorPost.set(linha.content_calendar_id, lista);
  }

  const approvedPostItems = (approvedPosts ?? []).map((post) => ({
    id: post.id,
    nome_evento: post.nome_evento,
    sugestao_texto: post.sugestao_texto,
    imagemUrl: post.imagem_gerada
      ? getPublicImageUrl(post.imagem_gerada, post.imagem_gerada_em)
      : null,
    storyImagemUrl: post.story_imagem_gerada
      ? getPublicImageUrl(post.story_imagem_gerada, post.story_imagem_gerada_em)
      : null,
    carrosselImagemUrls: Array.isArray(post.carrossel_slides)
      ? (post.carrossel_slides as string[]).map((path) =>
          getPublicImageUrl(path, post.carrossel_gerado_em)
        )
      : [],
    historico: historicoPorPost.get(post.id) ?? [],
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{client.nome}</h1>
          {client.empresa && (
            <p className="text-sm text-black/60 dark:text-white/60">{client.empresa}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/clientes/${client.id}/marca`}
            className="text-sm underline underline-offset-2"
          >
            Identidade visual
          </Link>
          <CheckCalendarButton clientId={client.id} />
        </div>
      </div>

      <ApprovedPosts clientId={client.id} items={approvedPostItems} />

      <ChatClient
        clientId={client.id}
        conversationId={conversation.id}
        initialMessages={messages ?? []}
      />
    </main>
  );
}
