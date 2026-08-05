import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat-client";
import { CheckCalendarButton } from "@/components/check-calendar-button";
import { ApprovedPosts } from "@/components/approved-posts";
import { ContractGenerator } from "@/components/contract-generator";
import { ClientBillingSection } from "@/components/client-billing-section";
import { AdSpendSection } from "@/components/ad-spend-section";
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
// async ali), por isso fica aqui. Elevado de 60 pra 120 na Fase 12 (pior
// caso do carrossel: até 4 renders + 1 chamada Groq). Elevado de novo pra
// 280 na Fase 22: o loop de qualidade do NeuroScore
// (generate-with-quality-loop.ts) pode rodar até 3 renders + 3 avaliações
// de visão + 2 regenerações de texto, todos sequenciais — o pior caso
// combinado é bem mais longo que o do carrossel. 280s ainda fica abaixo do
// teto de 300s do plano Hobby (Fase 9), com alguma margem de segurança.
export const maxDuration = 280;

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meta_conectado?: string; meta_erro?: string }>;
}) {
  const { id } = await params;
  const { meta_conectado: metaConectado, meta_erro: metaErro } = await searchParams;
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
      "id, nome_evento, sugestao_texto, imagem_gerada, imagem_gerada_em, story_imagem_gerada, story_imagem_gerada_em, carrossel_slides, carrossel_gerado_em, compliance_alertas"
    )
    .eq("client_id", id)
    .eq("status", "aprovado")
    .order("data_evento", { ascending: true });

  const approvedPostIds = (approvedPosts ?? []).map((post) => post.id);

  // NeuroScore (Fase 22) — a avaliação mais recente por post, quando
  // existir (posts gerados antes desta fase, ou gerados quando o loop de
  // qualidade caiu no fallback simples, simplesmente não têm uma linha
  // aqui — a seção some pra esses, sem quebrar nada).
  const { data: neuroscoreRows } =
    approvedPostIds.length > 0
      ? await supabase
          .from("neuroscore_evaluations")
          .select(
            "content_calendar_id, tentativa_numero, nota_geral, gancho_inicial, gatilhos_desejo, fatores_retencao, fatores_algoritmo, pontos_fracos, sugestoes, probabilidade_conversao_estimada, criado_em"
          )
          .in("content_calendar_id", approvedPostIds)
          .order("criado_em", { ascending: false })
      : { data: [] };

  type NeuroscoreRow = NonNullable<typeof neuroscoreRows>[number];
  const neuroscorePorPost = new Map<string, NeuroscoreRow>();
  for (const linha of neuroscoreRows ?? []) {
    if (linha.content_calendar_id && !neuroscorePorPost.has(linha.content_calendar_id)) {
      // Já ordenado por criado_em desc — a primeira ocorrência por post é a mais recente.
      neuroscorePorPost.set(linha.content_calendar_id, linha);
    }
  }

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
    // Snapshot da checagem de compliance (Fase 20) feito quando o texto
    // foi gerado/ajustado — permanece visível depois de aprovado, pra
    // auditoria posterior. Array vazio quando não checado ou sem alerta.
    complianceAlertas: Array.isArray(post.compliance_alertas)
      ? (post.compliance_alertas as { regra: string; gravidade: string; motivo: string }[])
      : [],
    // Resultado NeuroScore (Fase 22) mais recente pra este post, quando
    // existir — null quando o post nunca passou pelo loop de qualidade
    // (ex.: gerado antes desta fase, ou o loop caiu no fallback simples).
    neuroscore: (() => {
      const linha = neuroscorePorPost.get(post.id);
      if (!linha) return null;
      return {
        notaGeral: Number(linha.nota_geral),
        ganchoInicial: linha.gancho_inicial,
        gatilhosDesejo: Array.isArray(linha.gatilhos_desejo)
          ? (linha.gatilhos_desejo as { fator: string; avaliacao: string }[])
          : [],
        fatoresRetencao: Array.isArray(linha.fatores_retencao)
          ? (linha.fatores_retencao as { fator: string; avaliacao: string }[])
          : [],
        fatoresAlgoritmo: Array.isArray(linha.fatores_algoritmo)
          ? (linha.fatores_algoritmo as { fator: string; avaliacao: string }[])
          : [],
        pontosFracos: Array.isArray(linha.pontos_fracos) ? (linha.pontos_fracos as string[]) : [],
        sugestoes: Array.isArray(linha.sugestoes) ? (linha.sugestoes as string[]) : [],
        probabilidadeConversaoEstimada: linha.probabilidade_conversao_estimada,
        tentativaNumero: linha.tentativa_numero,
        atingiuMinimo: Number(linha.nota_geral) >= 7,
      };
    })(),
  }));

  // Módulo jurídico (Fase 15) — busca independente do resto da tela, não
  // afeta nada do fluxo de calendário/aprovação/imagem acima.
  const { data: modeloContrato } = await supabase
    .from("document_templates")
    .select("id, nome")
    .eq("tipo", "contrato")
    .limit(1)
    .maybeSingle();

  const { data: dnaServico } = await supabase
    .from("client_dna")
    .select("produtos")
    .eq("client_id", id)
    .maybeSingle();

  const { data: documentosCliente } = await supabase
    .from("client_documents")
    .select("id, titulo, status, gerado_em")
    .eq("client_id", id)
    .order("gerado_em", { ascending: false });

  // Módulo financeiro (Fase 16/17) — busca independente do resto da tela,
  // não afeta nada do fluxo de calendário/aprovação/imagem/jurídico acima.
  const { data: billingConfig } = await supabase
    .from("client_billing")
    .select("tipo_cobranca, valor_fixo, dia_vencimento")
    .eq("client_id", id)
    .maybeSingle();

  const { data: invoicesCliente } = await supabase
    .from("invoices")
    .select(
      "id, descricao, valor, data_vencimento, status, asaas_payment_id, link_pagamento, boleto_url"
    )
    .eq("client_id", id)
    .order("data_vencimento", { ascending: false });

  // Módulo de gasto com mídia paga (Fase 18) — busca independente do
  // resto da tela, não afeta nada do fluxo de calendário/aprovação/
  // imagem/jurídico/financeiro acima.
  const { data: adAccount } = await supabase
    .from("ad_accounts")
    .select("status, meta_ad_account_id, ultimo_erro")
    .eq("client_id", id)
    .eq("plataforma", "meta")
    .maybeSingle();

  const { data: adSpendEntries } = await supabase
    .from("ad_spend")
    .select("id, data, valor, origem")
    .eq("client_id", id)
    .order("data", { ascending: false });

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

      {modeloContrato && (
        <ContractGenerator
          clientId={client.id}
          templateId={modeloContrato.id}
          templateNome={modeloContrato.nome}
          servicoSugerido={dnaServico?.produtos ?? ""}
          documentosExistentes={documentosCliente ?? []}
        />
      )}

      <ClientBillingSection
        clientId={client.id}
        billingConfig={billingConfig ?? null}
        invoices={invoicesCliente ?? []}
      />

      <AdSpendSection
        clientId={client.id}
        adAccount={adAccount ?? null}
        spendEntries={adSpendEntries ?? []}
        oauthFeedback={{ conectado: metaConectado === "1", erro: metaErro ?? null }}
      />

      <ChatClient
        clientId={client.id}
        conversationId={conversation.id}
        initialMessages={messages ?? []}
      />
    </main>
  );
}
