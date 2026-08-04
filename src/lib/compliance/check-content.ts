import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { groqChatCompletion } from "@/lib/groq/client";
import { detectarNichoRegulado, NICHO_LABEL, type NichoRegulado } from "./detect-niche";

// Fase 20 — checagem heurística de compliance publicitário via Groq.
// É APOIO À DECISÃO: sinaliza possível conflito pro usuário revisar
// antes de aprovar, nunca bloqueia nada e nunca certifica conformidade
// (a ausência de alerta NÃO significa que o texto está conforme).

export type ComplianceAlerta = {
  regra: string;
  gravidade: "alta" | "media" | "baixa";
  motivo: string;
};

type RegraAtiva = {
  regra: string;
  gravidade: "alta" | "media" | "baixa";
};

const GRAVIDADE_LABEL: Record<ComplianceAlerta["gravidade"], string> = {
  alta: "gravidade alta",
  media: "gravidade média",
  baixa: "gravidade baixa",
};

// Checagem semântica via Groq contra uma lista de regras já carregada.
// Semântica (não busca de palavra-chave) porque violações são sutis —
// "resultado garantido" aparece de muitas formas diferentes ("sucesso
// certo", "você VAI conseguir", "100% de aprovação"...). temperature=0,
// mesmo racional do classificador de intenção da Fase 5 (tarefa de
// decisão, não de criação).
export async function checarTextoContraRegras(
  texto: string,
  nicho: NichoRegulado,
  regras: RegraAtiva[]
): Promise<ComplianceAlerta[]> {
  if (regras.length === 0) return [];

  const listaRegras = regras.map((r, i) => `${i + 1}. ${r.regra}`).join("\n");

  const resposta = await groqChatCompletion(
    [
      {
        role: "system",
        content:
          `Você verifica se um texto de post de rede social de um profissional de ${NICHO_LABEL[nicho]} ` +
          `pode conflitar com regras de publicidade profissional. Isso é um ALERTA heurístico de apoio, ` +
          `não um parecer jurídico.\n` +
          `Aponte uma regra SOMENTE quando o texto tiver um conflito claro ou provável com ela — ` +
          `não aponte por precaução vaga nem invente problema onde não há. Um texto informativo comum ` +
          `deve resultar em nenhuma violação.\n` +
          `Responda APENAS com JSON válido, sem nenhum texto fora dele, no formato exato:\n` +
          `{"violacoes":[{"regra":<numero da regra violada>,"motivo":"<explicação curta, 1 frase, em português>"}]}\n` +
          `Se nenhuma regra for violada, responda {"violacoes":[]}.`,
      },
      {
        role: "user",
        content: `Regras:\n${listaRegras}\n\nTexto do post:\n"""${texto}"""`,
      },
    ],
    { temperature: 0 }
  );

  // Parsing robusto: extrai o primeiro bloco {...} mesmo se a resposta
  // vier cercada de texto ou cerca de markdown (mesmo padrão do parsing
  // do carrossel, Fase 12). Item inválido (número fora da faixa, motivo
  // não-string) é descartado individualmente, sem derrubar os demais.
  const match = resposta.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Resposta da Groq sem JSON reconhecível: ${resposta.slice(0, 200)}`);
  }

  const parsed = JSON.parse(match[0]) as { violacoes?: unknown };
  if (!Array.isArray(parsed.violacoes)) {
    throw new Error("Resposta da Groq sem o array 'violacoes'.");
  }

  const alertas: ComplianceAlerta[] = [];
  for (const item of parsed.violacoes) {
    if (typeof item !== "object" || item === null) continue;
    const { regra, motivo } = item as { regra?: unknown; motivo?: unknown };
    const indice = typeof regra === "number" ? regra - 1 : -1;
    if (indice < 0 || indice >= regras.length) continue;
    alertas.push({
      regra: regras[indice].regra,
      gravidade: regras[indice].gravidade,
      motivo: typeof motivo === "string" ? motivo.slice(0, 300) : "possível conflito identificado",
    });
  }
  return alertas;
}

// Ponto de entrada usado nos 3 lugares que geram texto de sugestão
// (calendário/avulso/ajuste). Retorna:
// - null  → cliente FORA de nicho regulado: nenhuma consulta ao banco e
//           nenhuma chamada à Groq acontece (zero custo/latência extra —
//           regra explícita do escopo), e nada é gravado como "checado"
// - []    → checado, sem alerta (não gera ruído na mensagem)
// - [...] → alertas encontrados
export async function verificarCompliancePost(
  supabase: SupabaseClient<Database>,
  segmento: string | null,
  texto: string
): Promise<ComplianceAlerta[] | null> {
  const nicho = detectarNichoRegulado(segmento);
  if (!nicho) return null;

  const { data: regras, error } = await supabase
    .from("compliance_rules")
    .select("regra, gravidade")
    .eq("nicho", nicho)
    .eq("ativo", true);

  if (error) {
    throw new Error(`Não foi possível carregar as regras de compliance: ${error.message}`);
  }

  return checarTextoContraRegras(texto, nicho, (regras ?? []) as RegraAtiva[]);
}

// Bloco de aviso anexado à mensagem do chat quando a checagem encontra
// possível violação. Sempre reforça que é apoio à decisão, não veredito.
export function formatComplianceWarning(alertas: ComplianceAlerta[]): string {
  const linhas = alertas
    .map((a) => `- ${a.regra} (${GRAVIDADE_LABEL[a.gravidade]}): ${a.motivo}`)
    .join("\n");
  return (
    `⚠️ Alerta de compliance publicitário — este texto pode não estar de acordo com:\n` +
    `${linhas}\n` +
    `Isso é um alerta automático de apoio à decisão, não uma avaliação jurídica — revise antes de aprovar.`
  );
}
