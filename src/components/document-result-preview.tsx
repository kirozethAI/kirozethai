"use client";

import { montarDocumentoHtml } from "@/lib/documents/document-layout";

export type DocumentoGerado = {
  id: string;
  titulo: string;
  conteudoFinal: string;
};

// Prévia do documento gerado (Fase 15) — mesmo HTML embrulhado
// (montarDocumentoHtml) usado pra gerar o PDF de verdade, então o que
// aparece aqui é visualmente igual ao PDF baixado. Os links de download
// batem direto nas rotas de exportação (Route Handlers, não Server
// Actions — precisam devolver um arquivo com Content-Disposition, não um
// valor serializado).
export function DocumentResultPreview({ documento }: { documento: DocumentoGerado }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{documento.titulo}</p>
        <div className="flex gap-3">
          <a
            href={`/api/documents/${documento.id}/pdf`}
            className="text-sm underline underline-offset-2"
          >
            Baixar PDF
          </a>
          <a
            href={`/api/documents/${documento.id}/docx`}
            className="text-sm underline underline-offset-2"
          >
            Baixar Word
          </a>
        </div>
      </div>
      <iframe
        title={documento.titulo}
        srcDoc={montarDocumentoHtml(documento.conteudoFinal)}
        className="h-96 w-full rounded border border-black/10 bg-white dark:border-white/10"
      />
    </div>
  );
}
