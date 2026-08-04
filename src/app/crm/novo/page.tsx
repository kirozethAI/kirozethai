import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewLeadForm } from "@/components/new-lead-form";

export default async function NovoLeadPage() {
  const supabase = await createClient();

  const { data: estagios } = await supabase
    .from("pipeline_stages")
    .select("id, nome")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-6">
      <Link href="/crm" className="mb-4 inline-block text-sm underline underline-offset-2">
        ← Voltar
      </Link>
      <h1 className="mb-6 text-lg font-semibold">Novo lead</h1>

      {(estagios ?? []).length === 0 ? (
        <p className="text-sm text-red-600">
          Nenhum estágio de funil ativo — crie um em{" "}
          <Link href="/crm/estagios" className="underline underline-offset-2">
            gestão de estágios
          </Link>{" "}
          antes de cadastrar um lead.
        </p>
      ) : (
        <NewLeadForm estagios={estagios ?? []} />
      )}
    </main>
  );
}
