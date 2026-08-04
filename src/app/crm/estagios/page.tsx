import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PipelineStagesManager } from "@/components/pipeline-stages-manager";

export default async function PipelineStagesPage() {
  const supabase = await createClient();

  const { data: estagios, error } = await supabase
    .from("pipeline_stages")
    .select("id, nome, ordem, cor, tipo_final, ativo")
    .order("ordem", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <Link href="/crm" className="mb-4 text-sm underline underline-offset-2">
        ← Voltar pro funil
      </Link>

      <h1 className="mb-1 text-lg font-semibold">Estágios do funil</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Crie, reordene e edite os estágios do seu funil. Um estágio marcado
        como &ldquo;Ganho&rdquo; converte automaticamente o lead em cliente
        assim que ele é movido pra lá.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Não foi possível carregar os estágios: {error.message}
        </p>
      )}

      <PipelineStagesManager estagios={estagios ?? []} />
    </main>
  );
}
