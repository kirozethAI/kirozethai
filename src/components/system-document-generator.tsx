"use client";

import { useState, useTransition } from "react";
import { generateSystemDocumentAction } from "@/app/juridico-actions";
import { DocumentResultPreview, type DocumentoGerado } from "@/components/document-result-preview";

// Gera termos de uso / política de privacidade (Fase 15) — documentos do
// próprio sistema, sem cliente associado. Cada clique gera um snapshot novo
// (client_documents), então documentos antigos continuam existindo e
// baixáveis mesmo depois de gerar um novo.
export function SystemDocumentGenerator({
  templateId,
  nome,
}: {
  templateId: string;
  nome: string;
}) {
  const [documento, setDocumento] = useState<DocumentoGerado | null>(null);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function gerar() {
    setErro("");
    startTransition(async () => {
      try {
        const resultado = await generateSystemDocumentAction({ documentTemplateId: templateId });
        setDocumento(resultado);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao gerar documento.");
      }
    });
  }

  return (
    <div className="rounded border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{nome}</p>
        <button
          onClick={gerar}
          disabled={pending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {pending ? "Gerando..." : "Gerar novo"}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {documento && <DocumentResultPreview documento={documento} />}
    </div>
  );
}
