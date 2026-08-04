"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addLeadActivityAction } from "@/app/crm-actions";

export type AtividadeEntry = {
  tipo: string;
  descricao: string;
  quando: string;
};

const TIPO_LABEL: Record<string, string> = {
  nota: "Nota",
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  mudanca_estagio: "Mudança de estágio",
};

// Timeline de atividades do lead (Fase 21, Etapa 3) — mesmo padrão
// visual do histórico de aprovação da Fase 7 (approved-posts.tsx):
// lista cronológica com tipo/data/descrição.
export function LeadActivityTimeline({
  leadId,
  atividades,
}: {
  leadId: string;
  atividades: AtividadeEntry[];
}) {
  const [tipo, setTipo] = useState("nota");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function registrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        await addLeadActivityAction({ leadId, tipo, descricao });
        setDescricao("");
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao registrar atividade.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={registrar}
        className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
      >
        <p className="text-sm font-medium">Nova atividade</p>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/15"
          >
            <option value="nota">Nota</option>
            <option value="ligacao">Ligação</option>
            <option value="reuniao">Reunião</option>
            <option value="email">E-mail</option>
          </select>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva a interação"
            required
            className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Salvando..." : "Adicionar"}
        </button>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </form>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
          Histórico
        </p>
        {atividades.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">Nenhuma atividade ainda.</p>
        ) : (
          <ol className="space-y-2">
            {atividades.map((entry, i) => (
              <li key={i} className="text-xs text-black/60 dark:text-white/60">
                <span className="font-medium">{TIPO_LABEL[entry.tipo] ?? entry.tipo}</span>
                {" — "}
                {entry.quando}
                <p className="mt-0.5 text-black/50 dark:text-white/50">{entry.descricao}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
