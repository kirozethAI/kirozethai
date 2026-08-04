"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  generateImageAction,
  generateStoryAction,
  generateCarouselAction,
} from "@/app/calendar-actions";

export type HistoricoEntry = {
  status: string;
  texto: string | null;
  quando: string;
};

export type ComplianceAlertaEntry = {
  regra: string;
  gravidade: string;
  motivo: string;
};

export type ApprovedPostItem = {
  id: string;
  nome_evento: string;
  sugestao_texto: string | null;
  imagemUrl: string | null;
  storyImagemUrl: string | null;
  carrosselImagemUrls: string[];
  historico: HistoricoEntry[];
  complianceAlertas: ComplianceAlertaEntry[];
};

const GRAVIDADE_LABEL: Record<string, string> = {
  alta: "gravidade alta",
  media: "gravidade média",
  baixa: "gravidade baixa",
};

// Os 3 formatos (Fase 12) são independentes entre si — gerar um não afeta
// nem substitui os outros. O usuário "escolhe o formato" simplesmente
// clicando o botão da seção que quer (ver Decisões Tomadas da Fase 12,
// Opção C do escopo).
type Formato = "post" | "story" | "carrossel";

const FORMATO_LABEL: Record<Formato, string> = {
  post: "Post quadrado",
  story: "Story",
  carrossel: "Carrossel",
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

  function chave(id: string, formato: Formato) {
    return `${id}:${formato}`;
  }

  function gerar(id: string, formato: Formato) {
    const key = chave(id, formato);
    setErros((atual) => ({ ...atual, [key]: "" }));
    setGerando(key);
    startTransition(async () => {
      try {
        if (formato === "post") {
          await generateImageAction({ contentCalendarId: id, clientId });
        } else if (formato === "story") {
          await generateStoryAction({ contentCalendarId: id, clientId });
        } else {
          await generateCarouselAction({ contentCalendarId: id, clientId });
        }
      } catch (err) {
        setErros((atual) => ({
          ...atual,
          [key]:
            err instanceof Error
              ? err.message
              : `Erro ao gerar ${FORMATO_LABEL[formato].toLowerCase()}.`,
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

          {/* Alerta de compliance (Fase 20) — snapshot da checagem feita
              quando o texto foi gerado; não some depois de aprovado, de
              propósito (auditoria posterior). Apoio à decisão, nunca
              certificação de conformidade. */}
          {item.complianceAlertas.length > 0 && (
            <div className="mb-3 rounded border border-yellow-600/30 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-950/40 dark:text-yellow-200">
              <p className="mb-1 font-medium">
                ⚠️ Este texto tinha alerta de compliance publicitário quando foi sugerido:
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {item.complianceAlertas.map((alerta, i) => (
                  <li key={i}>
                    {alerta.regra} ({GRAVIDADE_LABEL[alerta.gravidade] ?? alerta.gravidade}):{" "}
                    {alerta.motivo}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-yellow-800/80 dark:text-yellow-300/80">
                Alerta automático de apoio à decisão — não substitui revisão profissional.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <FormatoSection
              label={FORMATO_LABEL.post}
              gerado={Boolean(item.imagemUrl)}
              gerando={gerando === chave(item.id, "post")}
              erro={erros[chave(item.id, "post")]}
              onGerar={() => gerar(item.id, "post")}
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imagemUrl ?? undefined}
                  alt={item.nome_evento}
                  className="h-24 w-24 rounded object-cover"
                />
                <a
                  href={item.imagemUrl ?? undefined}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-2"
                >
                  Baixar imagem
                </a>
              </div>
            </FormatoSection>

            <FormatoSection
              label={FORMATO_LABEL.story}
              gerado={Boolean(item.storyImagemUrl)}
              gerando={gerando === chave(item.id, "story")}
              erro={erros[chave(item.id, "story")]}
              onGerar={() => gerar(item.id, "story")}
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.storyImagemUrl ?? undefined}
                  alt={`${item.nome_evento} (story)`}
                  className="h-32 w-[72px] rounded object-cover"
                />
                <a
                  href={item.storyImagemUrl ?? undefined}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-2"
                >
                  Baixar story
                </a>
              </div>
            </FormatoSection>

            <FormatoSection
              label={FORMATO_LABEL.carrossel}
              gerado={item.carrosselImagemUrls.length > 0}
              gerando={gerando === chave(item.id, "carrossel")}
              erro={erros[chave(item.id, "carrossel")]}
              onGerar={() => gerar(item.id, "carrossel")}
            >
              <div className="flex gap-3 overflow-x-auto">
                {item.carrosselImagemUrls.map((url, i) => (
                  <div key={url} className="flex flex-shrink-0 flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${item.nome_evento} (slide ${i + 1})`}
                      className="h-24 w-24 rounded object-cover"
                    />
                    <a
                      href={url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-2"
                    >
                      Slide {i + 1}
                    </a>
                  </div>
                ))}
              </div>
            </FormatoSection>
          </div>

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

// Cada seção de formato tem sua própria prévia + botão "Gerar" — antes de
// gerado, mostra só o botão (mesmo padrão do post quadrado original); depois
// de gerado, mostra a prévia (não reexibe o botão, mesmo comportamento que
// já existia pro post único antes da Fase 12).
function FormatoSection({
  label,
  gerado,
  gerando,
  erro,
  onGerar,
  children,
}: {
  label: string;
  gerado: boolean;
  gerando: boolean;
  erro?: string;
  onGerar: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {label}
      </p>
      {gerado ? (
        children
      ) : (
        <button
          onClick={onGerar}
          disabled={gerando}
          className="rounded border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/15"
        >
          {gerando ? "Gerando..." : `Gerar ${label.toLowerCase()}`}
        </button>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
