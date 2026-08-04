import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraPtBr } from "@/lib/calendar/format";
import { SystemDocumentGenerator } from "@/components/system-document-generator";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  gerado: "Gerado",
  assinado: "Assinado",
};

// Tela do módulo jurídico (Fase 15) — módulo novo e independente, não mexe
// em nenhuma lógica de negócio existente (calendário, Groq, templates de
// imagem, cron). Lista os modelos-base (editáveis) e todos os documentos
// já gerados (sistema + por cliente). Geração de contrato específico fica
// na própria tela do cliente (ContractGenerator), não aqui.
export default async function JuridicoPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("document_templates")
    .select("id, tipo, nome")
    .order("tipo", { ascending: true });

  const { data: documentos } = await supabase
    .from("client_documents")
    .select("id, titulo, status, gerado_em, client_id")
    .order("gerado_em", { ascending: false });

  const clientIds = [...new Set((documentos ?? []).map((d) => d.client_id).filter(Boolean))] as string[];

  const { data: clientesRelacionados } =
    clientIds.length > 0
      ? await supabase.from("clients").select("id, nome, empresa").in("id", clientIds)
      : { data: [] };

  const nomeClientePorId = new Map(
    (clientesRelacionados ?? []).map((c) => [c.id, c.empresa ?? c.nome])
  );

  // "Modelos do sistema" (geração sem client_id, via getSystemFillValues)
  // são só termos_uso/politica_privacidade — 'contrato' é gerado na tela
  // do cliente (client_id real) e 'proposta_comercial' (Fase 21) é gerado
  // na ficha do lead (/crm/[id], com nome_lead/empresa_lead) — nenhum dos
  // 2 tem os dados que getSystemFillValues() fornece.
  const modelosSistema = (templates ?? []).filter(
    (t) => t.tipo === "termos_uso" || t.tipo === "politica_privacidade"
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Jurídico</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Contratos e documentos do sistema — módulo independente, não afeta o
        calendário, aprovação ou geração de imagens.
      </p>

      <div className="mb-6 rounded border border-yellow-600/30 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-950/40 dark:text-yellow-200">
        <strong>Atenção:</strong> os modelos abaixo são texto de referência
        genérico, não aconselhamento jurídico validado. Revise com um
        profissional qualificado antes de usar com clientes reais.
      </div>

      <div className="mb-6">
        <Link href="/juridico/compliance" className="text-sm underline underline-offset-2">
          Compliance publicitário (regras de saúde/direito) →
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-black/60 dark:text-white/60">
          Modelos-base
        </h2>
        <ul className="space-y-2">
          {(templates ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded border border-black/10 p-3 dark:border-white/10"
            >
              <div>
                <p className="text-sm font-medium">{t.nome}</p>
                <p className="text-xs text-black/50 dark:text-white/50">{t.tipo}</p>
              </div>
              <Link
                href={`/juridico/modelos/${t.id}`}
                className="text-sm underline underline-offset-2"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
          Termos de uso e política de privacidade
        </h2>
        {modelosSistema.map((t) => (
          <SystemDocumentGenerator key={t.id} templateId={t.id} nome={t.nome} />
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-black/60 dark:text-white/60">
          Documentos gerados
        </h2>
        {(documentos ?? []).length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Nenhum documento gerado ainda.
          </p>
        )}
        <ul className="space-y-2">
          {(documentos ?? []).map((doc) => (
            <li key={doc.id} className="rounded border border-black/10 p-3 dark:border-white/10">
              <p className="text-sm font-medium">{doc.titulo}</p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {doc.client_id ? nomeClientePorId.get(doc.client_id) ?? "Cliente" : "Sistema"} ·{" "}
                {STATUS_LABELS[doc.status] ?? doc.status} · {formatarDataHoraPtBr(doc.gerado_em)}
              </p>
              <div className="mt-1 flex gap-3">
                <a href={`/api/documents/${doc.id}/pdf`} className="text-xs underline underline-offset-2">
                  PDF
                </a>
                <a href={`/api/documents/${doc.id}/docx`} className="text-xs underline underline-offset-2">
                  Word
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
