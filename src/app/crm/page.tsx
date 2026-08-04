import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CrmKanban, type EstagioComLeads } from "@/components/crm-kanban";

// Tela do módulo de CRM (Fase 21) — módulo novo e independente, não mexe
// em nenhuma lógica de negócio existente. Visualização Kanban: colunas =
// pipeline_stages ativos ordenados, cards = leads daquele estágio.
export default async function CrmPage() {
  const supabase = await createClient();

  const { data: estagiosAtivos, error: erroEstagios } = await supabase
    .from("pipeline_stages")
    .select("id, nome, cor, tipo_final")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const { data: todosEstagios } = await supabase
    .from("pipeline_stages")
    .select("id, nome")
    .order("ordem", { ascending: true });

  const { data: leads, error: erroLeads } = await supabase
    .from("leads")
    .select("id, nome, empresa, valor_estimado, pipeline_stage_id, client_id")
    .order("criado_em", { ascending: false });

  const erro = erroEstagios ?? erroLeads;

  const colunas: EstagioComLeads[] = (estagiosAtivos ?? []).map((estagio) => ({
    id: estagio.id,
    nome: estagio.nome,
    cor: estagio.cor,
    tipoFinal: estagio.tipo_final,
    leads: (leads ?? [])
      .filter((l) => l.pipeline_stage_id === estagio.id)
      .map((l) => ({
        id: l.id,
        nome: l.nome,
        empresa: l.empresa,
        valorEstimado: l.valor_estimado,
        clienteConvertido: l.client_id !== null,
      })),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">CRM — Funil de vendas</h1>
        <div className="flex items-center gap-4">
          <Link href="/crm/estagios" className="text-sm underline underline-offset-2">
            Gerenciar estágios
          </Link>
          <Link
            href="/crm/novo"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Novo lead
          </Link>
        </div>
      </div>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          Não foi possível carregar o funil: {erro.message}
        </p>
      )}

      {colunas.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nenhum estágio ativo — configure em{" "}
          <Link href="/crm/estagios" className="underline underline-offset-2">
            gestão de estágios
          </Link>
          .
        </p>
      ) : (
        <CrmKanban colunas={colunas} todosEstagios={todosEstagios ?? []} />
      )}
    </main>
  );
}
