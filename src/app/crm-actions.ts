"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { convertLeadToClient } from "@/lib/crm/convert-lead";
import { fillTemplate, getLeadFillValues } from "@/lib/documents/fill-template";

// Server Actions do módulo de CRM (Fase 21) — módulo isolado, conectado
// no resto do sistema só no ponto de conversão lead→cliente
// (convertLeadToClient). Mesmo padrão das actions das fases anteriores.

const TIPOS_ATIVIDADE_MANUAL = new Set(["nota", "ligacao", "reuniao", "email"]);

// ---------- Leads ----------

export async function createLeadAction(input: {
  nome: string;
  empresa: string;
  telefone: string;
  email: string;
  segmento: string;
  origem: string;
  valorEstimado: string;
  pipelineStageId: string;
}) {
  const supabase = await createSupabaseServerClient();

  const nome = input.nome.trim();
  if (!nome) {
    throw new Error("Nome é obrigatório.");
  }
  if (!input.pipelineStageId) {
    throw new Error("Escolha um estágio inicial.");
  }

  const valorEstimado = input.valorEstimado.trim() ? Number(input.valorEstimado) : null;
  if (valorEstimado !== null && !(valorEstimado >= 0)) {
    throw new Error("Valor estimado inválido.");
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      nome,
      empresa: input.empresa.trim() || null,
      telefone: input.telefone.trim() || null,
      email: input.email.trim() || null,
      segmento: input.segmento.trim() || null,
      origem: input.origem.trim() || null,
      valor_estimado: valorEstimado,
      pipeline_stage_id: input.pipelineStageId,
    })
    .select("id")
    .single();

  if (error || !lead) {
    throw new Error(`Não foi possível criar o lead: ${error?.message}`);
  }

  revalidatePath("/crm");
  redirect(`/crm/${lead.id}`);
}

// Move um lead pra outro estágio (Etapa 2) — usada tanto no Kanban quanto
// na ficha do lead. Registra automaticamente uma lead_activities
// 'mudanca_estagio', e se o estágio de DESTINO for tipo_final='ganho',
// dispara a conversão em cliente automaticamente (Etapa 6) — sem exigir
// um segundo clique separado do usuário.
export async function moveLeadStageAction(input: { leadId: string; pipelineStageId: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, pipeline_stage_id")
    .eq("id", input.leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(leadError?.message ?? "Lead não encontrado.");
  }

  const { data: estagioAtual } = await supabase
    .from("pipeline_stages")
    .select("nome")
    .eq("id", lead.pipeline_stage_id)
    .maybeSingle();

  const { data: estagioNovo, error: estagioError } = await supabase
    .from("pipeline_stages")
    .select("nome, tipo_final")
    .eq("id", input.pipelineStageId)
    .single();

  if (estagioError || !estagioNovo) {
    throw new Error(estagioError?.message ?? "Estágio de destino não encontrado.");
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ pipeline_stage_id: input.pipelineStageId, atualizado_em: new Date().toISOString() })
    .eq("id", input.leadId);

  if (updateError) {
    throw new Error(`Não foi possível mover o lead: ${updateError.message}`);
  }

  await supabase.from("lead_activities").insert({
    lead_id: input.leadId,
    tipo: "mudanca_estagio",
    descricao: `${estagioAtual?.nome ?? "—"} → ${estagioNovo.nome}`,
  });

  let conversao: { clientId: string; jaConvertido: boolean } | null = null;
  if (estagioNovo.tipo_final === "ganho") {
    conversao = await convertLeadToClient(supabase, input.leadId);
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${input.leadId}`);

  return { convertido: conversao !== null, clientId: conversao?.clientId ?? null };
}

// Conversão explícita (botão "Converter em cliente" na ficha do lead) —
// funciona independente do estágio atual, e é idempotente (ver
// convertLeadToClient): repetir a ação num lead já convertido não cria
// um 2º cliente, só devolve o client_id já existente.
export async function convertLeadToClientAction(leadId: string) {
  const supabase = await createSupabaseServerClient();
  const resultado = await convertLeadToClient(supabase, leadId);

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);

  return resultado;
}

export async function addLeadActivityAction(input: { leadId: string; tipo: string; descricao: string }) {
  const supabase = await createSupabaseServerClient();

  if (!TIPOS_ATIVIDADE_MANUAL.has(input.tipo)) {
    throw new Error("Tipo de atividade inválido.");
  }
  if (!input.descricao.trim()) {
    throw new Error("Descreva a atividade.");
  }

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: input.leadId,
    tipo: input.tipo as "nota" | "ligacao" | "reuniao" | "email",
    descricao: input.descricao.trim(),
  });

  if (error) {
    throw new Error(`Não foi possível registrar a atividade: ${error.message}`);
  }

  revalidatePath(`/crm/${input.leadId}`);
}

// ---------- Proposta comercial (Etapa 5, reaproveita a infra da Fase 15) ----------

export type ResultadoPropostaGerada = {
  id: string;
  titulo: string;
  conteudoFinal: string;
};

export async function generateLeadProposalAction(input: {
  leadId: string;
  documentTemplateId: string;
  servico: string;
  valor: string;
  validade: string;
}): Promise<ResultadoPropostaGerada> {
  const supabase = await createSupabaseServerClient();

  const { data: template, error: templateError } = await supabase
    .from("document_templates")
    .select("nome, conteudo_html")
    .eq("id", input.documentTemplateId)
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Modelo não encontrado.");
  }

  const valores = await getLeadFillValues(supabase, input.leadId, {
    servico: input.servico,
    valor: input.valor,
    validade: input.validade,
  });

  const conteudoFinal = fillTemplate(template.conteudo_html, valores);
  const titulo = `${template.nome} — ${valores.nome_lead} — ${valores.data_atual}`;

  const { data: documento, error: insertError } = await supabase
    .from("client_documents")
    .insert({
      client_id: null,
      lead_id: input.leadId,
      document_template_id: input.documentTemplateId,
      titulo,
      conteudo_final: conteudoFinal,
    })
    .select("id, titulo, conteudo_final")
    .single();

  if (insertError || !documento) {
    throw new Error(insertError?.message ?? "Não foi possível salvar a proposta.");
  }

  revalidatePath(`/crm/${input.leadId}`);

  return { id: documento.id, titulo: documento.titulo, conteudoFinal: documento.conteudo_final };
}

// ---------- Gestão de estágios (Etapa 4) ----------

export async function createPipelineStageAction(input: { nome: string; cor: string; tipoFinal: string }) {
  const supabase = await createSupabaseServerClient();

  const nome = input.nome.trim();
  if (!nome) {
    throw new Error("Dê um nome pro estágio.");
  }

  const { data: ultimo } = await supabase
    .from("pipeline_stages")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("pipeline_stages").insert({
    nome,
    cor: input.cor,
    tipo_final: (input.tipoFinal || "nenhum") as "nenhum" | "ganho" | "perdido",
    ordem: (ultimo?.ordem ?? 0) + 1,
  });

  if (error) {
    throw new Error(`Não foi possível criar o estágio: ${error.message}`);
  }

  revalidatePath("/crm/estagios");
  revalidatePath("/crm");
}

export async function updatePipelineStageAction(input: {
  id: string;
  nome: string;
  cor: string;
  tipoFinal: string;
}) {
  const supabase = await createSupabaseServerClient();

  const nome = input.nome.trim();
  if (!nome) {
    throw new Error("Dê um nome pro estágio.");
  }

  const { error } = await supabase
    .from("pipeline_stages")
    .update({
      nome,
      cor: input.cor,
      tipo_final: input.tipoFinal as "nenhum" | "ganho" | "perdido",
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível salvar o estágio: ${error.message}`);
  }

  revalidatePath("/crm/estagios");
  revalidatePath("/crm");
}

export async function togglePipelineStageAction(input: { id: string; ativo: boolean }) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("pipeline_stages")
    .update({ ativo: input.ativo })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível atualizar o estágio: ${error.message}`);
  }

  revalidatePath("/crm/estagios");
  revalidatePath("/crm");
}

// Reordena um estágio trocando sua `ordem` com a do vizinho na direção
// pedida — mais simples que drag-and-drop (mesmo raciocínio do escopo
// pra movimentação de lead no Kanban: esforço x valor) e determinístico
// o bastante pra uma lista pequena de estágios.
export async function reorderPipelineStageAction(input: { id: string; direcao: "cima" | "baixo" }) {
  const supabase = await createSupabaseServerClient();

  const { data: estagios, error } = await supabase
    .from("pipeline_stages")
    .select("id, ordem")
    .order("ordem", { ascending: true });

  if (error || !estagios) {
    throw new Error(error?.message ?? "Não foi possível carregar os estágios.");
  }

  const indiceAtual = estagios.findIndex((e) => e.id === input.id);
  if (indiceAtual === -1) {
    throw new Error("Estágio não encontrado.");
  }

  const indiceVizinho = input.direcao === "cima" ? indiceAtual - 1 : indiceAtual + 1;
  if (indiceVizinho < 0 || indiceVizinho >= estagios.length) {
    return; // já está na ponta, não faz nada
  }

  const atual = estagios[indiceAtual];
  const vizinho = estagios[indiceVizinho];

  const { error: erro1 } = await supabase
    .from("pipeline_stages")
    .update({ ordem: vizinho.ordem })
    .eq("id", atual.id);
  const { error: erro2 } = await supabase
    .from("pipeline_stages")
    .update({ ordem: atual.ordem })
    .eq("id", vizinho.id);

  if (erro1 || erro2) {
    throw new Error(`Não foi possível reordenar: ${erro1?.message ?? erro2?.message}`);
  }

  revalidatePath("/crm/estagios");
  revalidatePath("/crm");
}
