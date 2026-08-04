"use client";

import { useState, useTransition, type FormEvent } from "react";
import { generateLeadProposalAction } from "@/app/crm-actions";
import { DocumentResultPreview, type DocumentoGerado } from "@/components/document-result-preview";

type PropostaExistente = { id: string; titulo: string; gerado_em: string };

// Gera proposta comercial pro lead (Fase 21, Etapa 5) — reaproveita 100%
// a infraestrutura de documentos/PDF/Word da Fase 15 (mesmo componente
// de prévia, mesmas rotas de download). Igual ao ContractGenerator
// (Fase 15), servico/valor/validade vêm de um formulário — são termos
// da proposta em si, não um dado fixo do lead.
export function LeadProposalGenerator({
  leadId,
  templateId,
  templateNome,
  segmentoSugerido,
  propostasExistentes,
}: {
  leadId: string;
  templateId: string;
  templateNome: string;
  segmentoSugerido: string;
  propostasExistentes: PropostaExistente[];
}) {
  const [servico, setServico] = useState(segmentoSugerido);
  const [valor, setValor] = useState("");
  const [validade, setValidade] = useState("15 dias");
  const [documento, setDocumento] = useState<DocumentoGerado | null>(null);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function gerar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    startTransition(async () => {
      try {
        const resultado = await generateLeadProposalAction({
          leadId,
          documentTemplateId: templateId,
          servico,
          valor,
          validade,
        });
        setDocumento(resultado);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao gerar proposta.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={gerar} className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium">{templateNome}</p>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="servicoProposta">
            Escopo do serviço
          </label>
          <input
            id="servicoProposta"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="valorProposta">
              Investimento
            </label>
            <input
              id="valorProposta"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="R$ 2.500,00/mês"
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="validadeProposta">
              Validade
            </label>
            <input
              id="validadeProposta"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Gerando..." : "Gerar proposta"}
        </button>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {documento && <DocumentResultPreview documento={documento} />}
      </form>

      {propostasExistentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Propostas já geradas
          </p>
          <ul className="space-y-1">
            {propostasExistentes.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <span>{doc.titulo}</span>
                <span className="flex gap-3">
                  <a href={`/api/documents/${doc.id}/pdf`} className="text-xs underline underline-offset-2">
                    PDF
                  </a>
                  <a href={`/api/documents/${doc.id}/docx`} className="text-xs underline underline-offset-2">
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
