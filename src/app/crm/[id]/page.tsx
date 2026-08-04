import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraPtBr } from "@/lib/calendar/format";
import { LeadActivityTimeline } from "@/components/lead-activity-timeline";
import { LeadProposalGenerator } from "@/components/lead-proposal-generator";
import { ConvertLeadButton } from "@/components/convert-lead-button";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Ficha do lead (Fase 21, Etapa 3) — dados, timeline de atividades,
// geração de proposta comercial (Etapa 5) e conversão em cliente
// (Etapa 6, explícita — o gatilho automático fica na movimentação de
// estágio no Kanban).
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, nome, empresa, telefone, email, segmento, origem, valor_estimado, pipeline_stage_id, client_id, criado_em"
    )
    .eq("id", id)
    .single();

  if (!lead) notFound();

  const { data: estagioAtual } = await supabase
    .from("pipeline_stages")
    .select("nome, cor")
    .eq("id", lead.pipeline_stage_id)
    .maybeSingle();

  const { data: atividades } = await supabase
    .from("lead_activities")
    .select("tipo, descricao, criado_em")
    .eq("lead_id", id)
    .order("criado_em", { ascending: true });

  const atividadeItems = (atividades ?? []).map((a) => ({
    tipo: a.tipo,
    descricao: a.descricao,
    quando: formatarDataHoraPtBr(a.criado_em),
  }));

  // Proposta comercial (Etapa 5) — reaproveita document_templates
  // (Fase 15). Se o modelo de proposta ainda não existe (migration não
  // rodada), a seção some silenciosamente, sem quebrar o resto da ficha.
  const { data: modeloProposta } = await supabase
    .from("document_templates")
    .select("id, nome")
    .eq("tipo", "proposta_comercial")
    .limit(1)
    .maybeSingle();

  const { data: propostasExistentes } = await supabase
    .from("client_documents")
    .select("id, titulo, gerado_em")
    .eq("lead_id", id)
    .order("gerado_em", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/crm" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar pro funil
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{lead.nome}</h1>
          {lead.empresa && (
            <p className="text-sm text-black/60 dark:text-white/60">{lead.empresa}</p>
          )}
        </div>
        {estagioAtual && (
          <span
            className="rounded px-2 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: estagioAtual.cor }}
          >
            {estagioAtual.nome}
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded border border-black/10 p-4 text-sm dark:border-white/10">
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">Telefone</p>
          <p>{lead.telefone ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">E-mail</p>
          <p>{lead.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">Segmento</p>
          <p>{lead.segmento ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">Origem</p>
          <p>{lead.origem ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">Valor estimado</p>
          <p>{lead.valor_estimado !== null ? formatarMoeda(lead.valor_estimado) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">Cadastrado em</p>
          <p>{formatarDataHoraPtBr(lead.criado_em)}</p>
        </div>
      </div>

      <div className="mb-6">
        {lead.client_id ? (
          <Link
            href={`/clientes/${lead.client_id}`}
            className="inline-block rounded border border-green-600/30 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-300"
          >
            Já convertido — ver cliente →
          </Link>
        ) : (
          <ConvertLeadButton leadId={lead.id} />
        )}
      </div>

      {modeloProposta && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
            Proposta comercial
          </h2>
          <LeadProposalGenerator
            leadId={lead.id}
            templateId={modeloProposta.id}
            templateNome={modeloProposta.nome}
            segmentoSugerido={lead.segmento ?? ""}
            propostasExistentes={propostasExistentes ?? []}
          />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">Atividades</h2>
        <LeadActivityTimeline leadId={lead.id} atividades={atividadeItems} />
      </div>
    </main>
  );
}
