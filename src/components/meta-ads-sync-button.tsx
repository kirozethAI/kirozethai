"use client";

import { useState, useTransition } from "react";
import { syncMetaAdSpendAction } from "@/app/ad-spend-actions";

// Disparo manual da sincronização de gasto do Meta Ads (Fase 18) — mesmo
// padrão de "Sincronizar feriados" (Fase 2/8): o cron diário já faz isso
// sozinho pra TODOS os clientes conectados, este botão existe pra testar
// sem esperar e como fallback manual.
export function MetaAdsSyncButton() {
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function sincronizar() {
    setErro("");
    setMensagem("");
    startTransition(async () => {
      try {
        const r = await syncMetaAdSpendAction();
        setMensagem(
          `${r.gastosRegistrados} gasto(s) sincronizado(s) (${r.contasProcessadas} conta(s) verificada(s), ${r.falhas} falha(s)).`
        );
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao sincronizar Meta Ads.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={sincronizar}
        disabled={pending}
        className="text-sm underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? "Sincronizando..." : "Sincronizar Meta Ads"}
      </button>
      {mensagem && <p className="text-xs text-green-600">{mensagem}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
