"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createPipelineStageAction,
  reorderPipelineStageAction,
  togglePipelineStageAction,
  updatePipelineStageAction,
} from "@/app/crm-actions";

type EstagioInfo = {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo_final: "nenhum" | "ganho" | "perdido";
  ativo: boolean;
};

const TIPO_FINAL_LABEL: Record<string, string> = {
  nenhum: "Nenhum",
  ganho: "Ganho (converte em cliente)",
  perdido: "Perdido",
};

// Gestão de estágios do funil (Fase 21, Etapa 4) — criar, editar,
// reordenar (troca de `ordem` com o vizinho, mesmo raciocínio de
// simplicidade da movimentação de lead no Kanban) e ativar/desativar.
// Estágio nunca é excluído por aqui (ver Decisões Tomadas).
export function PipelineStagesManager({ estagios }: { estagios: EstagioInfo[] }) {
  const [erro, setErro] = useState("");

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {estagios.map((estagio, i) => (
          <StageRow
            key={estagio.id}
            estagio={estagio}
            isPrimeiro={i === 0}
            isUltimo={i === estagios.length - 1}
            onErro={setErro}
          />
        ))}
      </ul>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <NewStageForm />
    </div>
  );
}

function StageRow({
  estagio,
  isPrimeiro,
  isUltimo,
  onErro,
}: {
  estagio: EstagioInfo;
  isPrimeiro: boolean;
  isUltimo: boolean;
  onErro: (msg: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(estagio.nome);
  const [cor, setCor] = useState(estagio.cor);
  const [tipoFinal, setTipoFinal] = useState(estagio.tipo_final);
  const [pending, startTransition] = useTransition();

  function salvar(e: FormEvent) {
    e.preventDefault();
    onErro("");
    startTransition(async () => {
      try {
        await updatePipelineStageAction({ id: estagio.id, nome, cor, tipoFinal });
        setEditando(false);
      } catch (err) {
        onErro(err instanceof Error ? err.message : "Erro ao salvar estágio.");
      }
    });
  }

  function mover(direcao: "cima" | "baixo") {
    onErro("");
    startTransition(async () => {
      try {
        await reorderPipelineStageAction({ id: estagio.id, direcao });
      } catch (err) {
        onErro(err instanceof Error ? err.message : "Erro ao reordenar.");
      }
    });
  }

  function alternarAtivo() {
    onErro("");
    startTransition(async () => {
      try {
        await togglePipelineStageAction({ id: estagio.id, ativo: !estagio.ativo });
      } catch (err) {
        onErro(err instanceof Error ? err.message : "Erro ao atualizar estágio.");
      }
    });
  }

  if (editando) {
    return (
      <li className="rounded border border-black/10 p-3 dark:border-white/10">
        <form onSubmit={salvar} className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            />
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-9 w-14 rounded border border-black/15 bg-transparent dark:border-white/15"
            />
          </div>
          <select
            value={tipoFinal}
            onChange={(e) => setTipoFinal(e.target.value as EstagioInfo["tipo_final"])}
            className="w-full rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          >
            {Object.entries(TIPO_FINAL_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-black/15 px-3 py-1 text-xs disabled:opacity-50 dark:border-white/15"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded border border-black/15 px-3 py-1 text-xs dark:border-white/15"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded border border-black/10 p-3 dark:border-white/10 ${
        estagio.ativo ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: estagio.cor }}
        />
        <div>
          <p className="text-sm font-medium">{estagio.nome}</p>
          <p className="text-xs text-black/50 dark:text-white/50">
            {TIPO_FINAL_LABEL[estagio.tipo_final]}
            {!estagio.ativo && " · desativado"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => mover("cima")}
          disabled={pending || isPrimeiro}
          className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-30 dark:border-white/15"
          aria-label="Mover pra cima"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => mover("baixo")}
          disabled={pending || isUltimo}
          className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-30 dark:border-white/15"
          aria-label="Mover pra baixo"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/15"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={alternarAtivo}
          disabled={pending}
          className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
        >
          {estagio.ativo ? "Desativar" : "Ativar"}
        </button>
      </div>
    </li>
  );
}

function NewStageForm() {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");
  const [tipoFinal, setTipoFinal] = useState<EstagioInfo["tipo_final"]>("nenhum");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        await createPipelineStageAction({ nome, cor, tipoFinal });
        setNome("");
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao criar estágio.");
      }
    });
  }

  return (
    <form onSubmit={criar} className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm font-medium">Novo estágio</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do estágio"
          required
          className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        />
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-9 w-14 rounded border border-black/15 bg-transparent dark:border-white/15"
        />
      </div>
      <select
        value={tipoFinal}
        onChange={(e) => setTipoFinal(e.target.value as EstagioInfo["tipo_final"])}
        className="w-full rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
      >
        {Object.entries(TIPO_FINAL_LABEL).map(([valor, label]) => (
          <option key={valor} value={valor}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
      >
        {pending ? "Criando..." : "Adicionar estágio"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </form>
  );
}
