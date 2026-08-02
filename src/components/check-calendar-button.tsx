"use client";

import { useState, useTransition } from "react";
import { checkCalendarAction } from "@/app/calendar-actions";

export function CheckCalendarButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function handleClick() {
    setStatus(null);
    startTransition(async () => {
      try {
        const { deteccao, geracao } = await checkCalendarAction(clientId);
        if (deteccao.eventosCriados === 0 && geracao.total === 0) {
          setStatus("Nenhuma data comemorativa nos próximos dias.");
        } else {
          setStatus(
            `${deteccao.eventosCriados} evento(s) detectado(s), ${geracao.geradas} sugestão(ões) gerada(s) no chat` +
              (geracao.falhas > 0 ? ` (${geracao.falhas} falha(s) — veja o console do servidor)` : ".")
          );
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Erro ao verificar o calendário.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-black/15 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"
      >
        {isPending ? "Verificando..." : "Verificar datas comemorativas"}
      </button>
      {status && <p className="text-sm text-black/60 dark:text-white/60">{status}</p>}
    </div>
  );
}
