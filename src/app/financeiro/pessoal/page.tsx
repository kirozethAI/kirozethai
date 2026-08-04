import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hojeBrasiliaISO } from "@/lib/format/timezone";
import { PersonalTransactionForm } from "@/components/personal-transaction-form";
import { PersonalTransactionList } from "@/components/personal-transaction-list";

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Soma/subtrai meses numa string "YYYY-MM" — aritmética pura de
// ano/mês, sem objeto Date (evita qualquer armadilha de fuso horário).
function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + delta;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

function rotuloDoMes(mes: string): string {
  // Dia 15 ao meio-dia UTC: qualquer fuso do mundo ainda está no mesmo
  // mês, então o rótulo nunca "escorrega" pro mês vizinho.
  const rotulo = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

// Dashboard do financeiro PESSOAL (Fase 19) — módulo isolado, sem
// nenhuma relação com o financeiro de clientes (/financeiro). Visão de 1
// mês por vez: totais, gastos por categoria (barras de proporção em CSS
// puro, sem lib de gráfico) e lista de lançamentos editável/removível.
export default async function FinanceiroPessoalPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  // Mês corrente no fuso de Brasília (não do servidor — a Vercel roda em
  // UTC, mesmo cuidado da Fase 10).
  const mesAtual = hojeBrasiliaISO().slice(0, 7);
  const mes = mesParam && MES_REGEX.test(mesParam) ? mesParam : mesAtual;

  const supabase = await createClient();

  const { data: categorias, error: erroCategorias } = await supabase
    .from("personal_categories")
    .select("id, nome, tipo, cor")
    .order("nome");

  const { data: transacoes, error: erroTransacoes } = await supabase
    .from("personal_transactions")
    .select("id, categoria_id, tipo, descricao, valor, data, recorrente")
    .gte("data", `${mes}-01`)
    .lt("data", `${somarMeses(mes, 1)}-01`)
    .order("data", { ascending: false });

  const erro = erroCategorias ?? erroTransacoes;

  const lista = transacoes ?? [];
  const totalReceitas = lista
    .filter((t) => t.tipo === "receita")
    .reduce((soma, t) => soma + t.valor, 0);
  const totalDespesas = lista
    .filter((t) => t.tipo === "despesa")
    .reduce((soma, t) => soma + t.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  // Gastos (despesas) por categoria, ordenados do maior pro menor —
  // barra de proporção relativa ao total de despesas do mês.
  const despesasPorCategoria = new Map<string, number>();
  for (const t of lista) {
    if (t.tipo !== "despesa") continue;
    despesasPorCategoria.set(
      t.categoria_id,
      (despesasPorCategoria.get(t.categoria_id) ?? 0) + t.valor
    );
  }
  const categoriaPorId = new Map((categorias ?? []).map((c) => [c.id, c]));
  const gastosPorCategoria = [...despesasPorCategoria.entries()]
    .map(([categoriaId, total]) => ({
      categoria: categoriaPorId.get(categoriaId),
      total,
      pct: totalDespesas > 0 ? (total / totalDespesas) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Financeiro pessoal</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Suas receitas e despesas pessoais — separado do faturamento dos
        clientes da agência.
      </p>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          Não foi possível carregar os dados: {erro.message}
        </p>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/financeiro/pessoal?mes=${somarMeses(mes, -1)}`}
          className="rounded border border-black/15 px-3 py-1 text-sm dark:border-white/15"
        >
          ← {rotuloDoMes(somarMeses(mes, -1))}
        </Link>
        <p className="text-sm font-semibold">{rotuloDoMes(mes)}</p>
        <Link
          href={`/financeiro/pessoal?mes=${somarMeses(mes, 1)}`}
          className="rounded border border-black/15 px-3 py-1 text-sm dark:border-white/15"
        >
          {rotuloDoMes(somarMeses(mes, 1))} →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Receitas</p>
          <p className="text-base font-semibold text-green-600">
            {formatarMoeda(totalReceitas)}
          </p>
        </div>
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Despesas</p>
          <p className="text-base font-semibold text-red-600">{formatarMoeda(totalDespesas)}</p>
        </div>
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Saldo</p>
          <p
            className={`text-base font-semibold ${
              saldo >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatarMoeda(saldo)}
          </p>
        </div>
      </div>

      {gastosPorCategoria.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Gastos por categoria
          </p>
          <ul className="space-y-2">
            {gastosPorCategoria.map(({ categoria, total, pct }) => (
              <li key={categoria?.id ?? "sem-categoria"}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{categoria?.nome ?? "Sem categoria"}</span>
                  <span className="text-black/60 dark:text-white/60">
                    {formatarMoeda(total)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-black/[.06] dark:bg-white/[.08]">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: categoria?.cor ?? "#6b7280",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <PersonalTransactionForm categorias={categorias ?? []} />
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Lançamentos de {rotuloDoMes(mes)}
      </p>
      <PersonalTransactionList transacoes={lista} categorias={categorias ?? []} />
    </main>
  );
}
