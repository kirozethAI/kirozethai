"use client";

import { useState, useTransition } from "react";
import { generateImageAction } from "@/app/calendar-actions";

export type HistoricoEntry = {
  status: string;
  texto: string | null;
  quando: string;
};

export type ApprovedPostItem = {
  id: string;
  nome_evento: string;
  sugestao_texto: string | null;
  imagemUrl: string | null;
  historico: HistoricoEntry[];
};

export function ApprovedPosts({
  clientId,
  items,
}: {
  clientId: string;
  items: ApprovedPostItem[];
}) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function gerar(id: string) {
    setErros((atual) => ({ ...atual, [id]: "" }));
    setGerando(id);
    startTransition(async () => {
      try {
        await generateImageAction({ contentCalendarId: id, clientId });
      } catch (err) {
        setErros((atual) => ({
          ...atual,
          [id]: err instanceof Error ? err.message : "Erro ao gerar imagem.",
        }));
      } finally {
        setGerando(null);
      }
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
        Posts aprovados
      </h2>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded border border-black/10 p-4 dark:border-white/10"
        >
          <p className="mb-1 text-sm font-medium">{item.nome_evento}</p>
          {item.sugestao_texto && (
            <p className="mb-3 text-sm text-black/60 dark:text-white/60">
              {item.sugestao_texto}
            </p>
          )}

          {item.imagemUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imagemUrl}
                alt={item.nome_evento}
                className="h-24 w-24 rounded object-cover"
              />
              <a
                href={item.imagemUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-2"
              >
                Baixar imagem
              </a>
            </div>
          ) : (
            <button
              onClick={() => gerar(item.id)}
              disabled={gerando === item.id}
              className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
            >
              {gerando === item.id ? "Gerando imagem..." : "Gerar imagem"}
            </button>
          )}

          {erros[item.id] && (
            <p className="mt-2 text-sm text-red-600">{erros[item.id]}</p>
          )}

          {item.historico.length > 0 && (
            <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
                Histórico de aprovação
              </p>
              <ol className="space-y-2">
                {item.historico.map((entry, i) => (
                  <li key={i} className="text-xs text-black/60 dark:text-white/60">
                    <span className="font-medium">{entry.status}</span>
                    {" — "}
                    {entry.quando}
                    {entry.texto && (
                      <p className="mt-0.5 italic text-black/50 dark:text-white/50">
                        &ldquo;{entry.texto}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
