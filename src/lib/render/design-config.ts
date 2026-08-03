import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  DEFAULT_DESIGN_CONFIG,
  type DesignConfig,
  type FontSizeBreakpoint,
} from "@/lib/render/templates/shared";

// Cache em memória (5 min) — evita bater no banco a cada imagem gerada
// (fila de geração pode ser bem frequente: aprovação automática + botões
// manuais de post/story/carrossel). Vive só durante o tempo de vida da
// instância serverless (cada invocação fria começa sem cache) — aceitável,
// já que o objetivo é só evitar leituras redundantes dentro de uma rajada
// de gerações, não persistir cache entre invocações.
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { config: DesignConfig; expiraEm: number } | null = null;

function isFontSizeScale(valor: unknown): valor is FontSizeBreakpoint[] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const { maxChars, size } = item as Record<string, unknown>;
      return (typeof maxChars === "number" || maxChars === null) && typeof size === "number";
    })
  );
}

// Aplica UM valor de design_config no objeto de config, só se o tipo bater
// com o esperado pra aquela chave — uma linha corrompida ou com o tipo
// errado é simplesmente ignorada (o default daquela chave específica
// continua valendo), em vez de derrubar a configuração inteira.
function aplicarValor(config: DesignConfig, chave: string, valor: unknown): void {
  switch (chave) {
    case "font_size_scale":
      if (isFontSizeScale(valor)) config.fontSizeScale = valor;
      break;
    case "gradiente_angulo":
      if (typeof valor === "number") config.gradienteAngulo = valor;
      break;
    case "gradiente_brilho_opacidade":
      if (typeof valor === "number") config.gradienteBrilhoOpacidade = valor;
      break;
    case "gradiente_vinheta_opacidade":
      if (typeof valor === "number") config.gradienteVinhetaOpacidade = valor;
      break;
    case "fundo_fallback_cor1":
      if (typeof valor === "string") config.fundoFallbackCor1 = valor;
      break;
    case "fundo_fallback_cor2":
      if (typeof valor === "string") config.fundoFallbackCor2 = valor;
      break;
    case "texto_cor_fallback":
      if (typeof valor === "string") config.textoCorFallback = valor;
      break;
    case "texto_cor_limiar_luminancia":
      if (typeof valor === "number") config.textoCorLimiarLuminancia = valor;
      break;
    case "acento_fallback_constelacao":
      if (typeof valor === "string") config.acentoFallbackConstelacao = valor;
      break;
    case "acento_fallback_estatistica":
      if (typeof valor === "string") config.acentoFallbackEstatistica = valor;
      break;
    default:
      // Chave desconhecida (ex.: de uma fase futura que este código ainda
      // não sabe interpretar) — ignorada silenciosamente, não é erro.
      break;
  }
}

// Busca design_config no banco pra montar a configuração de design usada
// pelos templates de imagem (Fase 14). Regra inegociável: a geração de
// imagem NUNCA pode falhar por causa desta configuração. Por isso:
// 1) Parte de uma CÓPIA de DEFAULT_DESIGN_CONFIG (os valores validados na
//    Fase 13) — cada chave só é sobrescrita se vier do banco com o tipo
//    certo (ver aplicarValor).
// 2) Erro de rede/Supabase na consulta → loga um aviso e devolve os
//    defaults, sem lançar exceção.
// 3) Linha individual com valor malformado → só aquela chave fica no
//    default, as outras 9 continuam vindo do banco normalmente.
export async function getDesignConfig(
  supabase: SupabaseClient<Database>
): Promise<DesignConfig> {
  const agora = Date.now();
  if (cache && cache.expiraEm > agora) {
    return cache.config;
  }

  const config: DesignConfig = { ...DEFAULT_DESIGN_CONFIG };

  try {
    const { data, error } = await supabase.from("design_config").select("chave, valor");

    if (error) {
      console.warn(
        "[design-config] Não foi possível carregar design_config, usando defaults da Fase 13:",
        error.message
      );
      return config;
    }

    for (const linha of data ?? []) {
      aplicarValor(config, linha.chave, linha.valor);
    }
  } catch (err) {
    console.warn(
      "[design-config] Erro inesperado carregando design_config, usando defaults da Fase 13:",
      err
    );
    return config;
  }

  cache = { config, expiraEm: agora + CACHE_TTL_MS };
  return config;
}

// Só pra teste/depuração manual (ex.: scripts de verificação da Fase 14) —
// força a próxima chamada a ignorar o cache em memória.
export function limparCacheDesignConfig(): void {
  cache = null;
}
