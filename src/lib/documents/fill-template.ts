import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { escapeHtml } from "@/lib/render/templates/shared";
import { formatarDataPtBr } from "@/lib/calendar/format";
import { hojeBrasiliaISO } from "@/lib/format/timezone";

// Substitui placeholders {{chave}} no HTML do modelo pelos valores
// informados. Cada valor passa por escapeHtml (mesma função usada nos
// templates de imagem, Fase 3/10) antes de entrar no documento — um valor
// com caracteres especiais (&, <, >, aspas) não quebra a estrutura do HTML
// nem permite injeção de HTML/script via um campo de formulário (ex.: nome
// de cliente ou serviço digitado por alguém). Uma chave sem valor
// correspondente é deixada como está (`{{chave}}` visível no resultado) —
// deliberado: um placeholder esquecido fica visivelmente sinalizado no
// documento gerado, em vez de virar uma string vazia silenciosa.
export function fillTemplate(conteudoHtml: string, valores: Record<string, string>): string {
  return conteudoHtml.replace(/\{\{(\w+)\}\}/g, (match, chave: string) => {
    const valor = valores[chave];
    return valor !== undefined ? escapeHtml(valor) : match;
  });
}

const NOME_SISTEMA = "Kirozeth AI";
const EMAIL_CONTATO_PADRAO = "contato@kirozeth.ai";
const URL_SISTEMA_PADRAO = "https://kirozethaii.vercel.app";

// Valores fixos do próprio sistema — usados pra termos de uso e política de
// privacidade (Etapa 1: documentos sem client_id, são do Kirozeth AI, não
// de um cliente cadastrado). Diferente dos dados de cliente, não vêm do
// banco.
export function getSystemFillValues(): Record<string, string> {
  return {
    nome_empresa: NOME_SISTEMA,
    data_atual: formatarDataPtBr(hojeBrasiliaISO()),
    email_contato: EMAIL_CONTATO_PADRAO,
    url_sistema: URL_SISTEMA_PADRAO,
  };
}

export type DadosContratoInput = {
  servico: string;
  valor: string;
  vigencia: string;
};

// Monta os valores de preenchimento pro contrato de um cliente real:
// {{nome_cliente}} e {{cidade}} vêm do banco (clients/client_dna — mesmo
// padrão de fallback genérico dos templates de imagem, sem quebrar se
// client_dna não tiver cidade preenchida); {{servico}}/{{valor}}/
// {{vigencia}} vêm do formulário de geração (Etapa 6), já que são termos
// negociados por contrato, não um dado fixo do cadastro do cliente.
export async function getClientFillValues(
  supabase: SupabaseClient<Database>,
  clientId: string,
  dadosContrato: DadosContratoInput
): Promise<Record<string, string>> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("nome, empresa")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    throw new Error(error?.message ?? "Cliente não encontrado.");
  }

  const { data: dna } = await supabase
    .from("client_dna")
    .select("cidade")
    .eq("client_id", clientId)
    .single();

  return {
    nome_cliente: client.empresa ?? client.nome,
    servico: dadosContrato.servico,
    valor: dadosContrato.valor,
    vigencia: dadosContrato.vigencia,
    cidade: dna?.cidade ?? "[cidade]",
    data_atual: formatarDataPtBr(hojeBrasiliaISO()),
  };
}

export type DadosPropostaInput = {
  servico: string;
  valor: string;
  validade: string;
};

// Monta os valores de preenchimento pra uma proposta comercial (Fase 21):
// {{nome_lead}}/{{empresa_lead}} vêm de `leads` (o prospect ainda não é um
// cliente cadastrado, por isso não usa getClientFillValues); {{servico}}/
// {{valor}}/{{validade}} vêm do formulário de geração, mesmo raciocínio de
// getClientFillValues (são termos da proposta em si, não um dado fixo de
// cadastro); {{nome_empresa}}/{{data_atual}} reaproveitam
// getSystemFillValues (é a mesma "CONTRATADA" de qualquer documento
// gerado pelo sistema).
export async function getLeadFillValues(
  supabase: SupabaseClient<Database>,
  leadId: string,
  dadosProposta: DadosPropostaInput
): Promise<Record<string, string>> {
  const { data: lead, error } = await supabase
    .from("leads")
    .select("nome, empresa")
    .eq("id", leadId)
    .single();

  if (error || !lead) {
    throw new Error(error?.message ?? "Lead não encontrado.");
  }

  return {
    ...getSystemFillValues(),
    nome_lead: lead.nome,
    empresa_lead: lead.empresa ?? "[empresa]",
    servico: dadosProposta.servico,
    valor: dadosProposta.valor,
    validade: dadosProposta.validade,
  };
}
