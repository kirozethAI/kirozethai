"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveLeadStageAction } from "@/app/crm-actions";

export type EstagioComLeads = {
  id: string;
  nome: string;
  cor: string;
  tipoFinal: "nenhum" | "ganho" | "perdido";
  leads: {
    id: string;
    nome: string;
    empresa: string | null;
    valorEstimado: number | null;
    clienteConvertido: boolean;
  }[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Kanban do funil (Fase 21, Etapa 2) — colunas = pipeline_stages
// ordenados, cards = leads daquele estágio. Movimentação via select por
// card (não drag-and-drop — decisão de esforço x valor documentada no
// PROGRESS.md), disparando moveLeadStageAction a cada troca.
export function CrmKanban({
  colunas,
  todosEstagios,
}: {
  colunas: EstagioComLeads[];
  todosEstagios: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState("");
  const [movendo, setMovendo] = useState<string | null>(null);
  const [avisoConversao, setAvisoConversao] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function mover(leadId: string, pipelineStageId: string) {
    setErro("");
    setMovendo(leadId);
    startTransition(async () => {
      try {
        const resultado = await moveLeadStageAction({ leadId, pipelineStageId });
        if (resultado.convertido) {
          setAvisoConversao(leadId);
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao mover lead.");
      } finally {
        setMovendo(null);
      }
    });
  }

  return (
    <div>
      {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <div key={coluna.id} className="w-64 flex-shrink-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: coluna.cor }}
              />
              <p className="text-sm font-semibold">{coluna.nome}</p>
              <span className="text-xs text-black/40 dark:text-white/40">
                {coluna.leads.length}
              </span>
            </div>
            <div className="space-y-2">
              {coluna.leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded border border-black/10 p-3 text-sm dark:border-white/10"
                >
                  <Link
                    href={`/crm/${lead.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {lead.nome}
                  </Link>
                  {lead.empresa && (
                    <p className="text-xs text-black/50 dark:text-white/50">{lead.empresa}</p>
                  )}
                  {lead.valorEstimado !== null && (
                    <p className="text-xs text-black/60 dark:text-white/60">
                      {formatarMoeda(lead.valorEstimado)}
                    </p>
                  )}
                  {lead.clienteConvertido && (
                    <span className="mt-1 inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      Convertido em cliente
                    </span>
                  )}
                  {avisoConversao === lead.id && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                      Convertido em cliente agora.
                    </p>
                  )}
                  <select
                    value={coluna.id}
                    disabled={movendo === lead.id}
                    onChange={(e) => mover(lead.id, e.target.value)}
                    className="mt-2 w-full rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
                  >
                    {todosEstagios.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {coluna.leads.length === 0 && (
                <p className="text-xs text-black/40 dark:text-white/40">Vazio.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
