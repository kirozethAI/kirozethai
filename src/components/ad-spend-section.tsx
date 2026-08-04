"use client";

import { useState, useTransition, type FormEvent } from "react";
import { registerManualAdSpendAction } from "@/app/ad-spend-actions";

type AdAccountInfo = {
  status: "conectado" | "desconectado" | "erro";
  meta_ad_account_id: string | null;
  ultimo_erro: string | null;
} | null;

type SpendEntry = {
  id: string;
  data: string;
  valor: number;
  origem: "api" | "manual";
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Soma os lançamentos dos últimos `diasAtras` dias (inclusive hoje), ou
// TODOS se `diasAtras` for null — usado pros 4 totais do dashboard
// (Etapa 5: dia/semana/mês/total consolidado).
function somarUltimosDias(entries: SpendEntry[], diasAtras: number | null): number {
  if (diasAtras === null) return entries.reduce((soma, e) => soma + e.valor, 0);
  const limite = new Date();
  limite.setDate(limite.getDate() - diasAtras);
  const limiteISO = limite.toISOString().slice(0, 10);
  return entries.filter((e) => e.data >= limiteISO).reduce((soma, e) => soma + e.valor, 0);
}

function somarMesAtual(entries: SpendEntry[]): number {
  const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
  return entries.filter((e) => e.data.startsWith(mesAtual)).reduce((soma, e) => soma + e.valor, 0);
}

// Seção "Gasto com mídia paga" na tela do cliente (Fase 18) — status da
// conexão Meta Ads + botão conectar/reconectar, totais por período
// (dia/7 dias/mês/total), formulário de entrada manual (SEMPRE visível,
// com ou sem conexão ativa — Etapa 4) e lista dos lançamentos recentes
// com badge de origem (API do Meta vs. manual).
export function AdSpendSection({
  clientId,
  adAccount,
  spendEntries,
  oauthFeedback,
}: {
  clientId: string;
  adAccount: AdAccountInfo;
  spendEntries: SpendEntry[];
  oauthFeedback: { conectado: boolean; erro: string | null };
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function registrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    startTransition(async () => {
      try {
        await registerManualAdSpendAction({ clientId, data, valor: Number(valor) });
        setValor("");
        setSalvo(true);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao registrar gasto.");
      }
    });
  }

  const totalHoje = somarUltimosDias(spendEntries, 0);
  const total7Dias = somarUltimosDias(spendEntries, 7);
  const totalMes = somarMesAtual(spendEntries);
  const totalGeral = somarUltimosDias(spendEntries, null);

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
        Gasto com mídia paga
      </h2>

      {oauthFeedback.conectado && (
        <p className="rounded border border-green-600/30 bg-green-50 p-2 text-sm text-green-800 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-300">
          Meta Ads conectado com sucesso.
        </p>
      )}
      {oauthFeedback.erro && (
        <p className="rounded border border-red-600/30 bg-red-50 p-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300">
          Falha ao conectar Meta Ads: {oauthFeedback.erro}
        </p>
      )}

      <div className="rounded border border-black/10 p-4 dark:border-white/10">
        {adAccount?.status === "conectado" && (
          <p className="text-sm">
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Conectado
            </span>{" "}
            conta {adAccount.meta_ad_account_id}
          </p>
        )}
        {adAccount?.status === "erro" && (
          <div className="space-y-1 text-sm">
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
              Erro na conexão
            </span>
            {adAccount.ultimo_erro && (
              <p className="text-xs text-red-700 dark:text-red-400">{adAccount.ultimo_erro}</p>
            )}
          </div>
        )}
        {(!adAccount || adAccount.status === "desconectado") && (
          <p className="text-sm text-black/60 dark:text-white/60">Meta Ads não conectado.</p>
        )}
        <a
          href={`/api/oauth/meta/connect?clientId=${clientId}`}
          className="mt-2 inline-block rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/15"
        >
          {adAccount?.status ? "Reconectar Meta Ads" : "Conectar Meta Ads"}
        </a>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded border border-black/10 p-2 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Hoje</p>
          <p className="text-sm font-semibold">{formatarMoeda(totalHoje)}</p>
        </div>
        <div className="rounded border border-black/10 p-2 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">7 dias</p>
          <p className="text-sm font-semibold">{formatarMoeda(total7Dias)}</p>
        </div>
        <div className="rounded border border-black/10 p-2 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Mês</p>
          <p className="text-sm font-semibold">{formatarMoeda(totalMes)}</p>
        </div>
        <div className="rounded border border-black/10 p-2 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50">Total</p>
          <p className="text-sm font-semibold">{formatarMoeda(totalGeral)}</p>
        </div>
      </div>

      <form
        onSubmit={registrar}
        className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10"
      >
        <p className="text-sm font-medium">Registrar gasto manual</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="dataGasto">
              Data
            </label>
            <input
              id="dataGasto"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="valorGasto">
              Valor
            </label>
            <input
              id="valorGasto"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Registrando..." : "Registrar gasto"}
        </button>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {salvo && !erro && <p className="text-sm text-green-600">Gasto registrado.</p>}
      </form>

      {spendEntries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Lançamentos recentes
          </p>
          <ul className="space-y-1">
            {spendEntries.slice(0, 15).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
              >
                <span>{formatarDataCurta(entry.data)}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      entry.origem === "api"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {entry.origem === "api" ? "Meta Ads" : "Manual"}
                  </span>
                  {formatarMoeda(entry.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
