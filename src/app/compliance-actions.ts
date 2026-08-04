"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Server Actions da gestão de regras de compliance (Fase 20, Etapa 5) —
// permite que o usuário (ou um advogado contratado) mantenha a lista de
// regras atualizada sem precisar de código. Mesmo padrão das actions das
// fases anteriores.

const NICHOS = new Set(["saude", "direito"]);
const GRAVIDADES = new Set(["alta", "media", "baixa"]);

// Ativa/desativa uma regra — regra desativada some da checagem (a query
// de verificarCompliancePost filtra por ativo=true), sem perder o texto.
export async function toggleComplianceRuleAction(input: { id: string; ativo: boolean }) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("compliance_rules")
    .update({ ativo: input.ativo })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível atualizar a regra: ${error.message}`);
  }

  revalidatePath("/juridico/compliance");
}

// Adiciona uma regra nova a um nicho.
export async function createComplianceRuleAction(input: {
  nicho: string;
  regra: string;
  gravidade: string;
  fonte: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!NICHOS.has(input.nicho)) {
    throw new Error("Nicho inválido: use 'saude' ou 'direito'.");
  }
  if (!GRAVIDADES.has(input.gravidade)) {
    throw new Error("Gravidade inválida: use 'alta', 'media' ou 'baixa'.");
  }
  if (!input.regra.trim()) {
    throw new Error("Descreva a regra.");
  }

  const { error } = await supabase.from("compliance_rules").insert({
    nicho: input.nicho as "saude" | "direito",
    regra: input.regra.trim(),
    gravidade: input.gravidade as "alta" | "media" | "baixa",
    fonte: input.fonte.trim() || "Adicionada pelo usuário",
  });

  if (error) {
    throw new Error(`Não foi possível criar a regra: ${error.message}`);
  }

  revalidatePath("/juridico/compliance");
}
