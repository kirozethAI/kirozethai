"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateDocumentTemplateAction } from "@/app/juridico-actions";

type Template = { id: string; nome: string; conteudo_html: string };

// Edita um modelo-base (Fase 15). Documentos JÁ gerados a partir deste
// modelo não mudam retroativamente — conteudo_final é um snapshot
// independente (ver client_documents na migration). Só documentos NOVOS,
// gerados depois de salvar aqui, refletem a mudança.
export function TemplateEditForm({ template }: { template: Template }) {
  const [nome, setNome] = useState(template.nome);
  const [conteudoHtml, setConteudoHtml] = useState(template.conteudo_html);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);
    startTransition(async () => {
      try {
        await updateDocumentTemplateAction({ templateId: template.id, nome, conteudoHtml });
        setSalvo(true);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao salvar modelo.");
      }
    });
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="nome">
          Nome do modelo
        </label>
        <input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="conteudo">
          Conteúdo (HTML)
        </label>
        <textarea
          id="conteudo"
          value={conteudoHtml}
          onChange={(e) => setConteudoHtml(e.target.value)}
          rows={26}
          spellCheck={false}
          className="w-full rounded border border-black/15 bg-transparent px-3 py-2 font-mono text-xs dark:border-white/15"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {salvo && !erro && <p className="text-sm text-green-600">Modelo salvo.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Salvando..." : "Salvar modelo"}
      </button>
    </form>
  );
}
