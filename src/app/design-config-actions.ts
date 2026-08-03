"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { limparCacheDesignConfig } from "@/lib/render/design-config";
import { HEX_RE } from "@/lib/render/templates/shared";

const CHAVES_COR = [
  "fundo_fallback_cor1",
  "fundo_fallback_cor2",
  "texto_cor_fallback",
  "acento_fallback_constelacao",
  "acento_fallback_estatistica",
] as const;

const CHAVES_NUMERO = [
  "gradiente_angulo",
  "gradiente_brilho_opacidade",
  "gradiente_vinheta_opacidade",
  "texto_cor_limiar_luminancia",
] as const;

function isFontSizeScaleValido(valor: unknown): boolean {
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

// Salva a configuração global de design (Fase 14), chamada pelo form em
// src/components/design-config-form.tsx. Cada chave é validada pelo tipo
// esperado ANTES de gravar — um valor inválido (ex.: cor fora do formato
// hex, escala de fonte malformada) é rejeitado com erro, em vez de gravar
// algo que só quebraria a geração de imagem depois, silenciosamente.
export async function updateDesignConfigAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const atualizacoes: { chave: string; valor: unknown }[] = [];

  for (const chave of CHAVES_COR) {
    const valor = (formData.get(chave) ?? "").toString().trim();
    if (!HEX_RE.test(valor)) {
      throw new Error(`"${chave}" precisa ser uma cor hex válida (ex.: #1f2937).`);
    }
    atualizacoes.push({ chave, valor });
  }

  for (const chave of CHAVES_NUMERO) {
    const bruto = (formData.get(chave) ?? "").toString().trim();
    const valor = Number(bruto);
    if (bruto === "" || Number.isNaN(valor)) {
      throw new Error(`"${chave}" precisa ser um número válido.`);
    }
    atualizacoes.push({ chave, valor });
  }

  const fontSizeScaleBruto = (formData.get("font_size_scale") ?? "").toString();
  let fontSizeScale: unknown;
  try {
    fontSizeScale = JSON.parse(fontSizeScaleBruto);
  } catch {
    throw new Error("A escala de fonte precisa ser um JSON válido.");
  }
  if (!isFontSizeScaleValido(fontSizeScale)) {
    throw new Error(
      'A escala de fonte precisa ser um array de objetos {"maxChars": número ou null, "size": número}.'
    );
  }
  atualizacoes.push({ chave: "font_size_scale", valor: fontSizeScale });

  for (const { chave, valor } of atualizacoes) {
    const { error } = await supabase.from("design_config").update({ valor }).eq("chave", chave);
    if (error) {
      throw new Error(`Não foi possível salvar "${chave}": ${error.message}`);
    }
  }

  // Invalida o cache em memória (Fase 14) — sem isso, a próxima geração de
  // imagem no MESMO processo/instância continuaria usando a config antiga
  // por até 5 minutos (ver src/lib/render/design-config.ts).
  limparCacheDesignConfig();

  revalidatePath("/configuracoes/design");
}
