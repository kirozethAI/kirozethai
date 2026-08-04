"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Server Actions do financeiro PESSOAL (Fase 19) — módulo isolado, sem
// nenhuma relação com clients/invoices/ad_spend. Mesmo padrão das actions
// das fases anteriores: input tipado, validação server-side, erro em
// PT-BR via throw, revalidatePath ao final.

const TIPOS_VALIDOS = new Set(["receita", "despesa"]);
const COR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type TipoTransacao = "receita" | "despesa";

function validarTipo(tipo: string): asserts tipo is TipoTransacao {
  if (!TIPOS_VALIDOS.has(tipo)) {
    throw new Error("Tipo inválido: use 'receita' ou 'despesa'.");
  }
}

// Valida os campos comuns de criação/edição de transação — categoria
// precisa existir E ser do mesmo tipo da transação (uma despesa nunca
// entra numa categoria de receita, e vice-versa).
async function validarCamposTransacao(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: { categoriaId: string; tipo: string; descricao: string; valor: number; data: string }
) {
  validarTipo(input.tipo);
  if (!input.descricao.trim()) {
    throw new Error("Descreva o lançamento.");
  }
  if (!Number.isFinite(input.valor) || !(input.valor > 0)) {
    throw new Error("O valor precisa ser maior que zero.");
  }
  if (!DATA_ISO_REGEX.test(input.data)) {
    throw new Error("Data inválida.");
  }

  const { data: categoria, error } = await supabase
    .from("personal_categories")
    .select("id, tipo")
    .eq("id", input.categoriaId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível verificar a categoria: ${error.message}`);
  }
  if (!categoria) {
    throw new Error("Categoria não encontrada.");
  }
  if (categoria.tipo !== input.tipo) {
    throw new Error(
      `A categoria escolhida é de ${categoria.tipo}, mas o lançamento é de ${input.tipo}.`
    );
  }
}

// Cria uma categoria nova (pela UI, junto do formulário de lançamento —
// "criar categoria na hora"). Unicidade de nome+tipo aplicada aqui em
// código, não por constraint no banco (mesmo padrão do resto do projeto).
export async function createPersonalCategoryAction(input: {
  nome: string;
  tipo: string;
  cor: string;
}): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();

  validarTipo(input.tipo);
  const nome = input.nome.trim();
  if (!nome) {
    throw new Error("Dê um nome pra categoria.");
  }
  if (!COR_HEX_REGEX.test(input.cor)) {
    throw new Error("Cor inválida (use o formato #rrggbb).");
  }

  const { data: existentes, error: erroBusca } = await supabase
    .from("personal_categories")
    .select("id, nome")
    .eq("tipo", input.tipo);

  if (erroBusca) {
    throw new Error(`Não foi possível verificar categorias existentes: ${erroBusca.message}`);
  }
  const duplicada = (existentes ?? []).some(
    (c) => c.nome.trim().toLowerCase() === nome.toLowerCase()
  );
  if (duplicada) {
    throw new Error(`Já existe uma categoria de ${input.tipo} chamada "${nome}".`);
  }

  const { data: criada, error } = await supabase
    .from("personal_categories")
    .insert({ nome, tipo: input.tipo, cor: input.cor, padrao: false })
    .select("id")
    .single();

  if (error || !criada) {
    throw new Error(`Não foi possível criar a categoria: ${error?.message ?? "sem retorno"}`);
  }

  revalidatePath("/financeiro/pessoal");
  return { id: criada.id };
}

// Cria um lançamento (receita ou despesa). `recorrente` é só um marcador
// visual — não há automação replicando pro mês seguinte (ver Decisões
// Tomadas da Fase 19 no PROGRESS.md).
export async function createPersonalTransactionAction(input: {
  categoriaId: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  recorrente: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  await validarCamposTransacao(supabase, input);

  const { error } = await supabase.from("personal_transactions").insert({
    categoria_id: input.categoriaId,
    tipo: input.tipo as TipoTransacao,
    descricao: input.descricao.trim(),
    valor: input.valor,
    data: input.data,
    recorrente: input.recorrente,
  });

  if (error) {
    throw new Error(`Não foi possível registrar o lançamento: ${error.message}`);
  }

  revalidatePath("/financeiro/pessoal");
}

// Edita um lançamento existente. O tipo (receita/despesa) não muda numa
// edição — pra "transformar" uma despesa em receita, exclui e recria
// (mantém o formulário de edição simples e evita estados intermediários
// de categoria incompatível).
export async function updatePersonalTransactionAction(input: {
  id: string;
  categoriaId: string;
  descricao: string;
  valor: number;
  data: string;
  recorrente: boolean;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: existente, error: erroBusca } = await supabase
    .from("personal_transactions")
    .select("id, tipo")
    .eq("id", input.id)
    .maybeSingle();

  if (erroBusca) {
    throw new Error(`Não foi possível buscar o lançamento: ${erroBusca.message}`);
  }
  if (!existente) {
    throw new Error("Lançamento não encontrado.");
  }

  await validarCamposTransacao(supabase, { ...input, tipo: existente.tipo });

  const { error } = await supabase
    .from("personal_transactions")
    .update({
      categoria_id: input.categoriaId,
      descricao: input.descricao.trim(),
      valor: input.valor,
      data: input.data,
      recorrente: input.recorrente,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível salvar o lançamento: ${error.message}`);
  }

  revalidatePath("/financeiro/pessoal");
}

// Exclui um lançamento. A confirmação acontece na UI (2 cliques) — aqui
// a exclusão é direta.
export async function deletePersonalTransactionAction(input: { id: string }) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("personal_transactions").delete().eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível excluir o lançamento: ${error.message}`);
  }

  revalidatePath("/financeiro/pessoal");
}
