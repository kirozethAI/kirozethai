import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraPtBr } from "@/lib/calendar/format";
import { NeuroScoreEvaluationForm } from "@/components/neuroscore-evaluation-form";

// maxDuration explícito (mesmo raciocínio da Fase 9/15): a avaliação de
// landing page roda Puppeteer (screenshotUrlToPngBuffer) + a chamada de
// visão da Groq — serverless roda Puppeteer mais devagar que local, 60s
// dá folga suficiente sem chegar perto do teto de 300s do Hobby.
export const maxDuration = 60;

const ORIGEM_LABEL: Record<string, string> = {
  upload_manual: "Upload manual",
  landing_page: "Landing page",
};

// Tela de avaliação NeuroScore avulsa (Fase 22, Etapa 5) — upload de
// imagem ou URL de landing page, sem loop de regeneração. Módulo
// independente, não mexe em nada do fluxo de aprovação de posts (esse
// fluxo usa o loop de qualidade automaticamente, ver
// src/lib/neuroscore/generate-with-quality-loop.ts).
export default async function NeuroScorePage() {
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome, empresa")
    .order("nome", { ascending: true });

  const { data: historico, error } = await supabase
    .from("neuroscore_evaluations")
    .select("id, origem, imagem_avaliada_url, url_original, nota_geral, client_id, criado_em")
    .in("origem", ["upload_manual", "landing_page"])
    .order("criado_em", { ascending: false })
    .limit(30);

  const nomeClientePorId = new Map((clientes ?? []).map((c) => [c.id, c.empresa ?? c.nome]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">NeuroScore — Avaliação avulsa</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Avalie uma imagem (post, anúncio, criativo) ou uma landing page via
        URL. Estimativa heurística de IA — apoio à decisão, não medição
        real de atenção.
      </p>

      <div className="mb-6">
        <NeuroScoreEvaluationForm clientes={clientes ?? []} />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Não foi possível carregar o histórico: {error.message}
        </p>
      )}

      {(historico ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Histórico de avaliações avulsas
          </p>
          <ul className="space-y-2">
            {(historico ?? []).map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded border border-black/10 p-3 text-sm dark:border-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    {ORIGEM_LABEL[h.origem] ?? h.origem}
                    {h.url_original && (
                      <span className="text-black/50 dark:text-white/50"> — {h.url_original}</span>
                    )}
                  </p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {h.client_id ? nomeClientePorId.get(h.client_id) ?? "Cliente" : "Sem cliente"} ·{" "}
                    {formatarDataHoraPtBr(h.criado_em)}
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold">{Number(h.nota_geral).toFixed(1)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
