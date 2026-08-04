import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComplianceRulesManager } from "@/components/compliance-rules-manager";

// Tela de gestão das regras de compliance publicitário (Fase 20, Etapa
// 5). As regras daqui alimentam a checagem heurística que roda quando um
// texto de post é gerado pra cliente em nicho regulado (saúde/direito).
export default async function CompliancePage() {
  const supabase = await createClient();

  const { data: regras, error } = await supabase
    .from("compliance_rules")
    .select("id, nicho, regra, gravidade, fonte, ativo")
    .order("nicho", { ascending: true })
    .order("criado_em", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/juridico" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar pro Jurídico
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Compliance publicitário</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Regras usadas pra alertar quando um texto de post de cliente em
        nicho regulado (saúde/direito) pode conflitar com normas de
        publicidade profissional. O alerta nunca bloqueia a aprovação — é
        apoio à decisão.
      </p>

      <div className="mb-6 rounded border border-yellow-600/30 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-950/40 dark:text-yellow-200">
        <strong>Regras de referência — não substituem consulta a um
        profissional.</strong>{" "}
        As normas dos conselhos (CFM, CFO, OAB) mudam com frequência e têm
        nuances reais. Mantenha esta lista atualizada com orientação
        jurídica real; a checagem automática é heurística e não certifica
        conformidade.
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Não foi possível carregar as regras: {error.message}
        </p>
      )}

      <ComplianceRulesManager regras={regras ?? []} />
    </main>
  );
}
