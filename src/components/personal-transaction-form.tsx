"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createPersonalCategoryAction,
  createPersonalTransactionAction,
} from "@/app/personal-finance-actions";

type CategoriaInfo = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  cor: string;
};

// Valor sentinela no select de categoria que revela os campos de "criar
// categoria nova na hora" (nome + cor) — no submit, a categoria é criada
// primeiro e o lançamento entra nela em seguida.
const NOVA_CATEGORIA = "__nova__";

// "Hoje" no fuso local do NAVEGADOR (o usuário está no Brasil) — o truque
// "en-CA" retorna YYYY-MM-DD nativamente, mesmo padrão de
// hojeBrasiliaISO() do servidor (Fase 10), só que client-side.
function hojeLocalISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

// Formulário de lançamento do financeiro pessoal (Fase 19) — receita ou
// despesa, com seleção de categoria filtrada pelo tipo escolhido e opção
// de criar uma categoria nova sem sair do formulário.
export function PersonalTransactionForm({ categorias }: { categorias: CategoriaInfo[] }) {
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [categoriaId, setCategoriaId] = useState("");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaCategoriaCor, setNovaCategoriaCor] = useState("#6b7280");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeLocalISO());
  const [recorrente, setRecorrente] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  function trocarTipo(novoTipo: "receita" | "despesa") {
    setTipo(novoTipo);
    // A categoria selecionada deixa de valer quando o tipo muda (uma
    // categoria de despesa não serve pra uma receita).
    setCategoriaId("");
  }

  function registrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    startTransition(async () => {
      try {
        let categoriaFinal = categoriaId;
        if (categoriaId === NOVA_CATEGORIA) {
          const criada = await createPersonalCategoryAction({
            nome: novaCategoriaNome,
            tipo,
            cor: novaCategoriaCor,
          });
          categoriaFinal = criada.id;
        }
        if (!categoriaFinal) {
          throw new Error("Escolha uma categoria.");
        }
        await createPersonalTransactionAction({
          categoriaId: categoriaFinal,
          tipo,
          descricao,
          valor: Number(valor),
          data,
          recorrente,
        });
        setDescricao("");
        setValor("");
        setRecorrente(false);
        if (categoriaId === NOVA_CATEGORIA) {
          setCategoriaId("");
          setNovaCategoriaNome("");
        }
        setSalvo(true);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao registrar lançamento.");
      }
    });
  }

  return (
    <form
      onSubmit={registrar}
      className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
    >
      <p className="text-sm font-medium">Novo lançamento</p>

      <div className="flex gap-2">
        {(["despesa", "receita"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => trocarTipo(t)}
            className={`rounded border px-3 py-1 text-xs ${
              tipo === t
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/15 dark:border-white/15"
            }`}
          >
            {t === "despesa" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="categoriaLancamento">
          Categoria
        </label>
        <select
          id="categoriaLancamento"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          required
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">Escolha…</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
          <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
        </select>
      </div>

      {categoriaId === NOVA_CATEGORIA && (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="novaCategoriaNome">
              Nome da categoria nova
            </label>
            <input
              id="novaCategoriaNome"
              type="text"
              value={novaCategoriaNome}
              onChange={(e) => setNovaCategoriaNome(e.target.value)}
              required
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="novaCategoriaCor">
              Cor
            </label>
            <input
              id="novaCategoriaCor"
              type="color"
              value={novaCategoriaCor}
              onChange={(e) => setNovaCategoriaCor(e.target.value)}
              className="h-9 w-14 rounded border border-black/15 bg-transparent dark:border-white/15"
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="descricaoLancamento">
          Descrição
        </label>
        <input
          id="descricaoLancamento"
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="valorLancamento">
            Valor
          </label>
          <input
            id="valorLancamento"
            type="number"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="dataLancamento">
            Data
          </label>
          <input
            id="dataLancamento"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={recorrente}
          onChange={(e) => setRecorrente(e.target.checked)}
        />
        Recorrente (se repete todo mês — só marcação visual, sem lançamento automático)
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
      >
        {pending ? "Registrando..." : "Registrar lançamento"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {salvo && !erro && <p className="text-sm text-green-600">Lançamento registrado.</p>}
    </form>
  );
}
