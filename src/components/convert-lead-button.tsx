"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadToClientAction } from "@/app/crm-actions";

// Botão de conversão explícita (Fase 21, Etapa 6) — disponível
// independente do estágio atual do lead. Idempotente: se o lead já foi
// convertido, a action só devolve o client_id existente (ver
// convertLeadToClient) — aqui isso vira um redirect direto pro cliente,
// sem erro nenhum.
export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function converter() {
    setErro("");
    startTransition(async () => {
      try {
        const { clientId } = await convertLeadToClientAction(leadId);
        router.push(`/clientes/${clientId}`);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao converter lead.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={converter}
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Convertendo..." : "Converter em cliente"}
      </button>
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
