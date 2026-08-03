"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { fillTemplate, getClientFillValues, getSystemFillValues } from "@/lib/documents/fill-template";

export type ResultadoDocumentoGerado = {
  id: string;
  titulo: string;
  conteudoFinal: string;
};

// Gera um documento (contrato) pra um cliente específico a partir de um
// modelo-base: preenche os placeholders com dados do cliente + os termos
// negociados (servico/valor/vigencia, vindos do formulário — Fase 15,
// Etapa 6) e salva o SNAPSHOT do HTML final em client_documents.
// `conteudo_final` não muda depois, mesmo que o modelo-base seja editado —
// ver Decisões Tomadas no PROGRESS.md e o teste da Etapa 7.
export async function generateClientDocumentAction(input: {
  clientId: string;
  documentTemplateId: string;
  servico: string;
  valor: string;
  vigencia: string;
}): Promise<ResultadoDocumentoGerado> {
  const supabase = await createSupabaseServerClient();

  const { data: template, error: templateError } = await supabase
    .from("document_templates")
    .select("nome, conteudo_html")
    .eq("id", input.documentTemplateId)
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Modelo não encontrado.");
  }

  const valores = await getClientFillValues(supabase, input.clientId, {
    servico: input.servico,
    valor: input.valor,
    vigencia: input.vigencia,
  });

  const conteudoFinal = fillTemplate(template.conteudo_html, valores);
  const titulo = `${template.nome} — ${valores.nome_cliente} — ${valores.data_atual}`;

  const { data: documento, error: insertError } = await supabase
    .from("client_documents")
    .insert({
      client_id: input.clientId,
      document_template_id: input.documentTemplateId,
      titulo,
      conteudo_final: conteudoFinal,
    })
    .select("id, titulo, conteudo_final")
    .single();

  if (insertError || !documento) {
    throw new Error(insertError?.message ?? "Não foi possível salvar o documento.");
  }

  revalidatePath(`/clientes/${input.clientId}`);

  return { id: documento.id, titulo: documento.titulo, conteudoFinal: documento.conteudo_final };
}

// Gera termos de uso ou política de privacidade (documentos do próprio
// sistema, sem client_id — Etapa 1 do escopo) a partir de um modelo-base.
export async function generateSystemDocumentAction(input: {
  documentTemplateId: string;
}): Promise<ResultadoDocumentoGerado> {
  const supabase = await createSupabaseServerClient();

  const { data: template, error: templateError } = await supabase
    .from("document_templates")
    .select("nome, conteudo_html")
    .eq("id", input.documentTemplateId)
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Modelo não encontrado.");
  }

  const valores = getSystemFillValues();
  const conteudoFinal = fillTemplate(template.conteudo_html, valores);
  const titulo = `${template.nome} — ${valores.data_atual}`;

  const { data: documento, error: insertError } = await supabase
    .from("client_documents")
    .insert({
      client_id: null,
      document_template_id: input.documentTemplateId,
      titulo,
      conteudo_final: conteudoFinal,
    })
    .select("id, titulo, conteudo_final")
    .single();

  if (insertError || !documento) {
    throw new Error(insertError?.message ?? "Não foi possível salvar o documento.");
  }

  revalidatePath("/juridico");

  return { id: documento.id, titulo: documento.titulo, conteudoFinal: documento.conteudo_final };
}

// Edita o texto de um modelo-base (contrato, termos, política) — chamado
// pela tela /juridico/modelos/[id]. `atualizado_em` é setado explicitamente
// aqui (não há trigger de banco pra essa coluna — ver a migration da
// Fase 15, Decisões Tomadas). Documentos JÁ gerados a partir deste modelo
// não são afetados: conteudo_final é um snapshot independente.
export async function updateDocumentTemplateAction(input: {
  templateId: string;
  nome: string;
  conteudoHtml: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("document_templates")
    .update({
      nome: input.nome,
      conteudo_html: input.conteudoHtml,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", input.templateId);

  if (error) {
    throw new Error(`Não foi possível salvar o modelo: ${error.message}`);
  }

  revalidatePath("/juridico");
  revalidatePath(`/juridico/modelos/${input.templateId}`);
}
