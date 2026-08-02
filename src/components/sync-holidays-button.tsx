"use client";

import { useState, useTransition } from "react";
import { syncHolidaysAction } from "@/app/calendar-actions";

export function SyncHolidaysButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function handleClick() {
    setStatus(null);
    startTransition(async () => {
      try {
        const resultado = await syncHolidaysAction();
        setStatus(
          `${resultado.inseridos} feriado(s) novo(s) sincronizado(s) (${resultado.ignorados} já existiam).`
        );
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Erro ao sincronizar feriados.");
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
        {isPending ? "Sincronizando..." : "Sincronizar feriados"}
      </button>
      {status && <p className="text-sm text-black/60 dark:text-white/60">{status}</p>}
    </div>
  );
}
