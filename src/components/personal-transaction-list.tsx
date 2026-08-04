"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  deletePersonalTransactionAction,
  updatePersonalTransactionAction,
} from "@/app/personal-finance-actions";

type CategoriaInfo = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  cor: string;
};

type TransacaoInfo = {
  id: string;
  categoria_id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  data: string;
  recorrente: boolean;
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Lista de lançamentos do período (Fase 19), cada item editável inline e
// removível com confirmação em 2 cliques ("Excluir" → "Confirmar
// exclusão?"). Cada item cuida do próprio estado (mesmo espírito da
// extração de invoice-list-item.tsx na Fase 17 — estado por item de
// lista não vaza pro componente pai).
export function PersonalTransactionList({
  transacoes,
  categorias,
}: {
  transacoes: TransacaoInfo[];
  categorias: CategoriaInfo[];
}) {
  if (transacoes.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Nenhum lançamento neste mês.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {transacoes.map((t) => (
        <TransactionItem key={t.id} transacao={t} categorias={categorias} />
      ))}
    </ul>
  );
}

function TransactionItem({
  transacao,
  categorias,
}: {
  transacao: TransacaoInfo;
  categorias: CategoriaInfo[];
}) {
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [categoriaId, setCategoriaId] = useState(transacao.categoria_id);
  const [descricao, setDescricao] = useState(transacao.descricao);
  const [valor, setValor] = useState(String(transacao.valor));
  const [data, setData] = useState(transacao.data);
  const [recorrente, setRecorrente] = useState(transacao.recorrente);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  const categoria = categorias.find((c) => c.id === transacao.categoria_id);
  // Na edição, só categorias do MESMO tipo da transação (o tipo não muda
  // numa edição — ver updatePersonalTransactionAction).
  const categoriasDoTipo = categorias.filter((c) => c.tipo === transacao.tipo);

  function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        await updatePersonalTransactionAction({
          id: transacao.id,
          categoriaId,
          descricao,
          valor: Number(valor),
          data,
          recorrente,
        });
        setEditando(false);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  function excluir() {
    setErro("");
    startTransition(async () => {
      try {
        await deletePersonalTransactionAction({ id: transacao.id });
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao excluir.");
        setConfirmandoExclusao(false);
      }
    });
  }

  if (editando) {
    return (
      <li className="rounded border border-black/10 p-3 dark:border-white/10">
        <form onSubmit={salvar} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              aria-label="Descrição"
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            />
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              aria-label="Categoria"
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            >
              {categoriasDoTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
              aria-label="Valor"
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            />
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              aria-label="Data"
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
            />
            Recorrente
          </label>
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
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="rounded border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{transacao.descricao}</p>
          <p className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
            {categoria && (
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: categoria.cor }}
              />
            )}
            {categoria?.nome ?? "Sem categoria"} · {formatarDataCurta(transacao.data)}
            {transacao.recorrente && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                Recorrente
              </span>
            )}
          </p>
        </div>
        <p
          className={`shrink-0 text-sm font-semibold ${
            transacao.tipo === "receita" ? "text-green-600" : "text-red-600"
          }`}
        >
          {transacao.tipo === "receita" ? "+" : "−"} {formatarMoeda(transacao.valor)}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {!confirmandoExclusao && (
          <>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-xs underline underline-offset-2"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="text-xs underline underline-offset-2"
            >
              Excluir
            </button>
          </>
        )}
        {confirmandoExclusao && (
          <>
            <span className="text-xs">Excluir este lançamento?</span>
            <button
              type="button"
              onClick={excluir}
              disabled={pending}
              className="text-xs font-medium text-red-600 underline underline-offset-2 disabled:opacity-50"
            >
              {pending ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              disabled={pending}
              className="text-xs underline underline-offset-2 disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </li>
  );
}
