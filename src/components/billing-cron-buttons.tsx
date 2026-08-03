"use client";

import { useState, useTransition } from "react";
import { generateMonthlyInvoicesAction, markOverdueInvoicesAction } from "@/app/billing-actions";

// Disparo manual dos 2 jobs do cron diário (Fase 16) — mesmo padrão de
// "Sincronizar feriados" (Fase 2/8): o cron já faz isso sozinho todo dia,
// estes botões existem pra testar sem esperar e como fallback manual.
export function BillingCronButtons() {
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function gerar() {
    setErro("");
    setMensagem("");
    startTransition(async () => {
      try {
        const r = await generateMonthlyInvoicesAction();
        setMensagem(
          `${r.faturasGeradas} fatura(s) gerada(s) (${r.cobrancasProcessadas} cobrança(s) fixa(s) verificada(s)).`
        );
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao gerar faturas.");
      }
    });
  }

  function verificarAtrasos() {
    setErro("");
    setMensagem("");
    startTransition(async () => {
      try {
        const r = await markOverdueInvoicesAction();
        setMensagem(`${r.marcadasAtrasadas} fatura(s) marcada(s) como atrasada(s).`);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao verificar atrasos.");
      }
    });
  }

  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={gerar}
          disabled={pending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Processando..." : "Gerar faturas do mês"}
        </button>
        <button
          onClick={verificarAtrasos}
          disabled={pending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Processando..." : "Verificar atrasos"}
        </button>
      </div>
      {mensagem && <p className="text-sm text-green-600">{mensagem}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
