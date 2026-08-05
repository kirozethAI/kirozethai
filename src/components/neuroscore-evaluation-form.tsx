"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { evaluateLandingPageAction, evaluateUploadedImageAction } from "@/app/neuroscore-actions";
import { NeuroScoreResultCard, type NeuroScoreResult } from "@/components/neuroscore-result-card";

type ClienteInfo = { id: string; nome: string; empresa: string | null };

function paraResultado(analise: {
  notaGeral: number;
  ganchoInicial: string;
  gatilhosDesejo: { fator: string; avaliacao: string }[];
  fatoresRetencao: { fator: string; avaliacao: string }[];
  fatoresAlgoritmo: { fator: string; avaliacao: string }[];
  pontosFracos: string[];
  sugestoes: string[];
  probabilidadeConversaoEstimada: string;
}): NeuroScoreResult {
  return {
    notaGeral: analise.notaGeral,
    ganchoInicial: analise.ganchoInicial,
    gatilhosDesejo: analise.gatilhosDesejo,
    fatoresRetencao: analise.fatoresRetencao,
    fatoresAlgoritmo: analise.fatoresAlgoritmo,
    pontosFracos: analise.pontosFracos,
    sugestoes: analise.sugestoes,
    probabilidadeConversaoEstimada: analise.probabilidadeConversaoEstimada,
  };
}

// Avaliação avulsa (Fase 22, Etapa 5) — upload de imagem OU URL de
// landing page, SEM loop de regeneração (não há o que regenerar em
// conteúdo externo). Cliente é opcional, só pra organizar o histórico.
export function NeuroScoreEvaluationForm({ clientes }: { clientes: ClienteInfo[] }) {
  const [modo, setModo] = useState<"upload" | "url">("upload");
  const [clientId, setClientId] = useState("");
  const [url, setUrl] = useState("");
  const [resultado, setResultado] = useState<{ imagemUrl: string; resultado: NeuroScoreResult } | null>(
    null
  );
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function avaliarUpload(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setResultado(null);
    const arquivo = fileInputRef.current?.files?.[0];
    if (!arquivo) {
      setErro("Selecione uma imagem.");
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("imagem", arquivo);
        formData.set("clientId", clientId);
        const res = await evaluateUploadedImageAction(formData);
        setResultado({ imagemUrl: res.imagemUrl, resultado: paraResultado(res.analise) });
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao avaliar a imagem.");
      }
    });
  }

  function avaliarUrl(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setResultado(null);
    startTransition(async () => {
      try {
        const res = await evaluateLandingPageAction({ url, clientId });
        setResultado({ imagemUrl: res.imagemUrl, resultado: paraResultado(res.analise) });
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao avaliar a landing page.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["upload", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setErro("");
              setResultado(null);
            }}
            className={`rounded border px-3 py-1 text-xs ${
              modo === m
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/15 dark:border-white/15"
            }`}
          >
            {m === "upload" ? "Upload de imagem" : "URL de landing page"}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="clienteAvaliacao">
          Cliente (opcional)
        </label>
        <select
          id="clienteAvaliacao"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full max-w-xs rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">Nenhum</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.empresa ?? c.nome}
            </option>
          ))}
        </select>
      </div>

      {modo === "upload" ? (
        <form onSubmit={avaliarUpload} className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="imagemAvaliacao">
              Imagem (PNG, JPG ou WEBP, até 8MB)
            </label>
            <input
              id="imagemAvaliacao"
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Avaliando..." : "Avaliar imagem"}
          </button>
        </form>
      ) : (
        <form onSubmit={avaliarUrl} className="space-y-3 rounded border border-black/10 p-4 dark:border-white/10">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="urlAvaliacao">
              URL da landing page
            </label>
            <input
              id="urlAvaliacao"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Tirando screenshot e avaliando..." : "Avaliar landing page"}
          </button>
        </form>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {resultado && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultado.imagemUrl}
            alt="Imagem avaliada"
            className="max-h-80 rounded border border-black/10 object-contain dark:border-white/10"
          />
          <NeuroScoreResultCard resultado={resultado.resultado} />
        </div>
      )}
    </div>
  );
}
