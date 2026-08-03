"use client";

import { useState, useTransition, type FormEvent } from "react";
import { generateClientDocumentAction } from "@/app/juridico-actions";
import { DocumentResultPreview, type DocumentoGerado } from "@/components/document-result-preview";

type DocumentoExistente = {
  id: string;
  titulo: string;
  status: string;
  gerado_em: string;
};

// Gera um contrato pra este cliente específico (Fase 15) a partir do
// modelo-base de tipo "contrato" — servico/valor/vigencia são termos
// negociados por contrato, por isso vêm de um formulário aqui, não de
// client_dna (que só guarda dados gerais do cliente, não os termos de
// UM contrato específico). `servicoSugerido` pré-preenche o campo com
// client_dna.produtos como ponto de partida, editável antes de gerar.
export function ContractGenerator({
  clientId,
  templateId,
  templateNome,
  servicoSugerido,
  documentosExistentes,
}: {
  clientId: string;
  templateId: string;
  templateNome: string;
  servicoSugerido: string;
  documentosExistentes: DocumentoExistente[];
}) {
  const [servico, setServico] = useState(servicoSugerido);
  const [valor, setValor] = useState("");
  const [vigencia, setVigencia] = useState("12 meses");
  const [documento, setDocumento] = useState<DocumentoGerado | null>(null);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function gerar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        const resultado = await generateClientDocumentAction({
          clientId,
          documentTemplateId: templateId,
          servico,
          valor,
          vigencia,
        });
        setDocumento(resultado);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao gerar contrato.");
      }
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
        Documentos jurídicos
      </h2>

      <div className="rounded border border-yellow-600/30 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-950/40 dark:text-yellow-200">
        Modelo de referência genérico — revise com um profissional jurídico
        antes de usar com clientes reais.
      </div>

      <form onSubmit={gerar} className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium">{templateNome}</p>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="servico">
            Serviço contratado
          </label>
          <input
            id="servico"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="valor">
              Valor
            </label>
            <input
              id="valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="R$ 2.500,00/mês"
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="vigencia">
              Vigência
            </label>
            <input
              id="vigencia"
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Gerando..." : "Gerar contrato"}
        </button>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {documento && <DocumentResultPreview documento={documento} />}
      </form>

      {documentosExistentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Documentos já gerados
          </p>
          <ul className="space-y-1">
            {documentosExistentes.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <span>{doc.titulo}</span>
                <span className="flex gap-3">
                  <a
                    href={`/api/documents/${doc.id}/pdf`}
                    className="text-xs underline underline-offset-2"
                  >
                    PDF
                  </a>
                  <a
                    href={`/api/documents/${doc.id}/docx`}
                    className="text-xs underline underline-offset-2"
                  >
                    Word
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
